/**
 * Customer 대시보드 v5 — 실데이터 액세스 (appdb, public 스키마).
 *
 * 데이터는 DATABASE_URL(appdb)에서 pg 로 읽는다(인증은 Supabase 별개). tenant 격리는
 * 여기 쿼리 레이어의 WHERE tenant_slug 로 처리(appdb 는 RLS 없음, 서버 trusted).
 * 현재는 데모 단일 테넌트(정민 카페). 실제 멀티테넌시 전환 시 tenantSlug 를 세션에서 주입.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { DEV_AUTH_COOKIE, devAuthCookieValid } from '@/lib/dev-auth';

/**
 * 팀/dev 뷰어가 자체 테넌트 없을 때 보는 기본 데모 테넌트.
 * 'team-semicolon' (마이그 013 시드) 로 변경 — 세미콜론 팀 자체 데모 데이터.
 * 'jeongmin-cafe' 는 별도 시드로 남아 있어 어드민 테넌트 스위처에서 선택 가능.
 */
export const DEMO_TENANT = 'team-semicolon';

/**
 * 현재 세션 사용자 → 테넌트 slug 해석 (멀티테넌시, B).
 *
 * Supabase 세션 user.id 를 tenants.owner_user_id 로 매핑한다. 세션이 없거나
 * 매핑된 테넌트가 없으면 DEMO_TENANT 로 폴백한다 — 지금은 /my* 가 공개 mock
 * 쇼케이스이기 때문(미들웨어 public 경로). 실 auth + 가입 온보딩이 준비되면
 * 폴백을 제거하고 미들웨어 public 경로도 함께 닫아 재-게이팅한다.
 */
export async function resolveTenantSlug(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return DEMO_TENANT;
    const { rows } = await query<{ slug: string }>(
      `select slug from public.tenants where owner_user_id = $1 order by created_at limit 1`,
      [user.id],
    );
    return rows[0]?.slug ?? DEMO_TENANT;
  } catch {
    return DEMO_TENANT;
  }
}

/**
 * 실 소유 테넌트만 해석 (데모 폴백 없음). 세션 없거나 소유 테넌트 없으면 null.
 * /dashboard(실 제품)와 /demo(더미) 를 가르는 기준 — /demo 는 DEMO_TENANT 를 직접 넘긴다.
 */
export async function resolveOwnedTenantSlug(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { rows } = await query<{ slug: string }>(
      `select slug from public.tenants where owner_user_id = $1 order by created_at limit 1`,
      [user.id],
    );
    return rows[0]?.slug ?? null;
  } catch {
    return null;
  }
}

/**
 * 우리 팀(운영팀 admin) 또는 dev 매직키 뷰어인지 — 고객 대시보드 "미리보기" 허용 대상.
 * 팀 모드 토글(운영팀 ↔ 고객)로 admin 이 고객 화면을 데모 테넌트로 들여다볼 수 있게 한다.
 * 어드민 테넌트 스위처 API 도 이 가드를 재사용.
 */
export async function isTeamOrDevViewer(): Promise<boolean> {
  try {
    const c = await cookies();
    if (devAuthCookieValid(c.get(DEV_AUTH_COOKIE)?.value)) return true;
  } catch {
    /* cookies unavailable */
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    return data?.role === 'admin';
  } catch {
    return false;
  }
}

const ADMIN_TENANT_COOKIE = 'semo-admin-tenant';

/** 어드민/dev 뷰어가 스위처로 골라둔 테넌트 slug 쿠키. 형식 검증 후 반환. */
async function readAdminTenantOverride(): Promise<string | null> {
  try {
    const c = await cookies();
    const v = c.get(ADMIN_TENANT_COOKIE)?.value;
    return v && /^[a-z0-9-]{2,64}$/i.test(v) ? v : null;
  } catch {
    return null;
  }
}

async function tenantExists(slug: string): Promise<boolean> {
  try {
    const { rows } = await query<{ ok: boolean }>(
      `select true as ok from public.tenants where slug = $1 limit 1`,
      [slug],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * 실 제품 /dashboard 게이트.
 * - 어드민/dev 가 스위처 쿠키로 임의 테넌트 골라뒀고 그게 존재 → 그 테넌트(어드민 inspect).
 * - 소유 테넌트 있음 → 그 테넌트(실데이터).
 * - 없지만 팀 admin/dev → 데모 테넌트(team-semicolon)로 미리보기.
 * - 그 외(테넌트 없는 일반 사용자) → 온보딩(/dashboard/start).
 * 서버 컴포넌트에서만 호출. RLS 없으므로 어드민 가드는 isTeamOrDevViewer 가 책임.
 */
export async function requireOwnedTenantSlug(): Promise<string> {
  const override = await readAdminTenantOverride();
  if (override && (await isTeamOrDevViewer()) && (await tenantExists(override))) {
    return override;
  }
  const slug = await resolveOwnedTenantSlug();
  if (slug) return slug;
  if (await isTeamOrDevViewer()) return DEMO_TENANT;
  redirect('/dashboard/start');
}

/** 어드민 테넌트 스위처용 최소 뷰. 호출자(/api/admin/tenants)가 권한 가드 책임. */
export interface TenantSummary {
  slug: string;
  displayName: string;
  tenantType: string;
  planSlug: string;
  owned: boolean;
}
export async function listTenants(): Promise<TenantSummary[]> {
  try {
    const { rows } = await query<{
      slug: string;
      display_name: string;
      tenant_type: string;
      plan_slug: string;
      owned: boolean;
    }>(
      `select slug, display_name, tenant_type, plan_slug, owner_user_id is not null as owned
         from public.tenants order by created_at`,
    );
    return rows.map((r) => ({
      slug: r.slug,
      displayName: r.display_name,
      tenantType: r.tenant_type,
      planSlug: r.plan_slug,
      owned: r.owned,
    }));
  } catch {
    return [];
  }
}

/**
 * 가입 사용자 → 테넌트 보장 (T67). 소유 테넌트가 있으면 그 slug, 없으면 생성(+무료 구독).
 * 가입 직후 /api/my/tenant/ensure 에서 호출. resolveTenantSlug 는 순수 읽기로 유지하고
 * 생성은 여기서만 (내부 팀원이 /my 를 들러도 테넌트가 생기지 않도록 분리).
 */
export async function ensureTenantForUser(userId: string, email?: string | null): Promise<string> {
  const slug = `t-${userId.replace(/-/g, '').slice(0, 12)}`;
  const name = email ? `${email.split('@')[0]}의 가게` : '내 가게';
  // Race-safe ensure (Codex 리뷰): partial UNIQUE on owner_user_id (마이그 014) + ON CONFLICT
  // DO NOTHING + UNION ALL fallback select. /auth/callback 과 PersonaSelect 가 동시에 호출돼도
  // 단 하나의 행만 만들어지고 두 호출 모두 동일 slug 반환.
  const { rows } = await query<{ slug: string }>(
    `with attempt as (
       insert into public.tenants (slug, display_name, tenant_type, owner_user_id, plan_slug)
       values ($1, $2, 'personal', $3, 'free')
       on conflict do nothing
       returning slug
     )
     select slug from attempt
     union all
     select slug from public.tenants where owner_user_id = $3 order by created_at limit 1`,
    [slug, name, userId],
  );
  const resolved = rows[0]?.slug ?? slug;
  await query(
    `insert into public.subscriptions (tenant_id, plan_slug, status)
     select id, 'free', 'active' from public.tenants where slug = $1
     on conflict (tenant_id) do nothing`,
    [resolved],
  );
  return resolved;
}

/** agents.jsx 의 AGENT 객체와 동일 shape + install 정보(todaySummary/state). */
export interface CustomerAgent {
  id: string;
  name: string;
  role: string;
  dept: string | null;
  color: string | null;
  accent: string | null;
  accessoryKind: string | null;
  bio: string | null;
  skills: string[];
  integrations: string[];
  rating: number | null;
  employers: number;
  priceTier: string;
  todaySummary?: string | null;
  state?: string;
}

interface InstallRow {
  agent_slug: string;
  display_name: string;
  role_label: string;
  dept: string | null;
  color: string | null;
  accent: string | null;
  accessory_kind: string | null;
  bio: string | null;
  skills: string[] | null;
  integrations: string[] | null;
  rating: string | null;
  employers: number;
  price_tier: string;
  today_summary: string | null;
  avatar_state: string;
}

function toAgent(r: InstallRow): CustomerAgent {
  return {
    id: r.agent_slug,
    name: r.display_name,
    role: r.role_label,
    dept: r.dept,
    color: r.color,
    accent: r.accent,
    accessoryKind: r.accessory_kind,
    bio: r.bio,
    skills: r.skills ?? [],
    integrations: r.integrations ?? [],
    rating: r.rating != null ? Number(r.rating) : null,
    employers: r.employers,
    priceTier: r.price_tier,
    todaySummary: r.today_summary,
    state: r.avatar_state,
  };
}

/** 테넌트가 채용(install)한 직원 목록. 비어있거나 오류면 빈 배열(화면이 mock 폴백). */
export async function getInstalledAgents(
  tenantSlug: string = DEMO_TENANT,
): Promise<CustomerAgent[]> {
  try {
    const { rows } = await query<InstallRow>(
      `select l.agent_slug, l.display_name, l.role_label, l.dept, l.color, l.accent,
              l.accessory_kind, l.bio, l.skills, l.integrations, l.rating, l.employers, l.price_tier,
              i.today_summary, i.avatar_state
         from public.agent_installs i
         join public.agent_listings l on l.id = i.listing_id
         join public.tenants t on t.id = i.tenant_id
        where t.slug = $1 and i.install_status = 'active'
        order by i.installed_at`,
      [tenantSlug],
    );
    return rows.map(toAgent);
  } catch {
    return [];
  }
}

/** 라이브러리 카탈로그(고객 노출 + 승인된 것만). */
export async function getLibraryListings(): Promise<CustomerAgent[]> {
  try {
    const { rows } = await query<InstallRow>(
      `select agent_slug, display_name, role_label, dept, color, accent, accessory_kind,
              bio, skills, integrations, rating, employers, price_tier,
              null::text as today_summary, 'idle' as avatar_state
         from public.agent_listings
        where audience = 'customer' and review_status = 'approved'
        order by employers desc`,
    );
    return rows.map(toAgent);
  } catch {
    return [];
  }
}

/** 라이브러리 상세 — slug 단건. 없으면 null(화면이 mock 폴백). */
export async function getListingBySlug(slug: string): Promise<CustomerAgent | null> {
  try {
    const { rows } = await query<InstallRow>(
      `select agent_slug, display_name, role_label, dept, color, accent, accessory_kind,
              bio, skills, integrations, rating, employers, price_tier,
              null::text as today_summary, 'idle' as avatar_state
         from public.agent_listings
        where agent_slug = $1 and audience = 'customer'
        limit 1`,
      [slug],
    );
    return rows[0] ? toAgent(rows[0]) : null;
  } catch {
    return null;
  }
}

// ─── Home (/my) 실데이터 ──────────────────────────────────────────────
// agent_activity → 활동 피드, agent_installs → "지금 일하고 있어요", 집계 → 상단 stats.
// nudges 는 전용 테이블이 없어 빈 배열 반환(화면이 mock 폴백) — 후속(approvals 테이블) 필요.

/** 활동 피드용 경량 agent(아바타 렌더에 필요한 표시 필드만). */
export interface ActivityAgent {
  id: string;
  name: string;
  role: string;
  color: string | null;
  accent: string | null;
  accessoryKind: string | null;
}

export interface ActivityItem {
  id: string;
  agent: ActivityAgent | null;
  verb: string;
  target: string | null;
  detail: string | null;
  status: string | null;
  isAi: boolean;
  occurredAt: string;
  timeAgo: string;
  bucket: string;
}

interface ActivityRow {
  id: string;
  agent_slug: string | null;
  display_name: string | null;
  role_label: string | null;
  color: string | null;
  accent: string | null;
  accessory_kind: string | null;
  verb: string;
  target: string | null;
  detail: string | null;
  status: string | null;
  is_ai: boolean;
  occurred_at: string | Date;
}

function relTime(occurredAt: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - occurredAt.getTime()) / 60000));
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const sameDay = occurredAt.toDateString() === new Date().toDateString();
  const hh = String(occurredAt.getHours()).padStart(2, '0');
  const mm = String(occurredAt.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  return `어제 ${hh}:${mm}`;
}

function bucketOf(occurredAt: Date): string {
  const mins = (Date.now() - occurredAt.getTime()) / 60000;
  const sameDay = occurredAt.toDateString() === new Date().toDateString();
  if (mins < 15) return '방금 전';
  if (sameDay) return '오늘';
  return '어제';
}

/** 테넌트의 활동 피드(최신순). 비면 빈 배열(화면 mock 폴백). */
export async function getActivity(
  tenantSlug: string = DEMO_TENANT,
  limit = 30,
): Promise<ActivityItem[]> {
  try {
    const { rows } = await query<ActivityRow>(
      `select a.id, l.agent_slug, l.display_name, l.role_label, l.color, l.accent, l.accessory_kind,
              a.verb, a.target, a.detail, a.status, a.is_ai, a.occurred_at
         from public.agent_activity a
         join public.tenants t on t.id = a.tenant_id
         left join public.agent_listings l on l.id = a.listing_id
        where t.slug = $1
        order by a.occurred_at desc
        limit $2`,
      [tenantSlug, limit],
    );
    return rows.map((r) => {
      const occurred = r.occurred_at instanceof Date ? r.occurred_at : new Date(r.occurred_at);
      return {
        id: r.id,
        agent: r.agent_slug
          ? {
              id: r.agent_slug,
              name: r.display_name ?? r.agent_slug,
              role: r.role_label ?? '',
              color: r.color,
              accent: r.accent,
              accessoryKind: r.accessory_kind,
            }
          : null,
        verb: r.verb,
        target: r.target,
        detail: r.detail,
        status: r.status,
        isAi: r.is_ai,
        occurredAt: occurred.toISOString(),
        timeAgo: relTime(occurred),
        bucket: bucketOf(occurred),
      };
    });
  } catch {
    return [];
  }
}

export interface HomeStats {
  todayResponses: number;
  newKnowledge: number;
  workingCount: number;
}

/** Home 상단 집계. appdb 에 매출은 없어 화면이 매출 카드는 mock 유지. */
export async function getHomeStats(tenantSlug: string = DEMO_TENANT): Promise<HomeStats | null> {
  try {
    const { rows } = await query<{
      today_responses: string;
      new_knowledge: string;
      working_count: string;
    }>(
      `select
         (select count(*) from public.agent_activity a join public.tenants t on t.id=a.tenant_id
            where t.slug=$1 and a.occurred_at::date = now()::date) as today_responses,
         (select count(*) from public.agent_activity a join public.tenants t on t.id=a.tenant_id
            where t.slug=$1 and a.target is not null and a.occurred_at >= now() - interval '7 days') as new_knowledge,
         (select count(*) from public.agent_installs i join public.tenants t on t.id=i.tenant_id
            where t.slug=$1 and i.avatar_state='working') as working_count`,
      [tenantSlug],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      todayResponses: Number(r.today_responses),
      newKnowledge: Number(r.new_knowledge),
      workingCount: Number(r.working_count),
    };
  } catch {
    return null;
  }
}

export interface NudgeItem {
  id: string;
  agent: ActivityAgent | null;
  title: string;
  detail: string | null;
}

/**
 * 사장님 결정 대기(nudges). 현재 appdb 에 승인/결정 대기 전용 테이블이 없어
 * 빈 배열 반환 → 화면이 mock 폴백. 후속: approvals/decisions 테이블 도입 시
 * tenantSlug 로 조회. (지금은 인자 불필요.)
 */
export async function getNudges(): Promise<NudgeItem[]> {
  return [];
}

// ─── KB 그래프(/my/knowledge) 실데이터 ────────────────────────────────
// "가게 지식" 그래프는 테넌트의 agent_activity 에서 만든다(직원=허브, 활동 target=지식 노드,
// 엣지=직원→지식). 고객 지식은 SEMO 내부 semo.knowledge_base 와 별개이므로 그쪽 스키마는
// 건드리지 않는다(공유 production KB 보호). react-force-graph-2d 가 이 shape 를 그대로 소비.

export interface GraphNode {
  id: string;
  name: string;
  kind: 'agent' | 'knowledge';
  color: string;
  val: number;
}
export interface GraphLink {
  source: string;
  target: string;
}
export interface KnowledgeGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphRow {
  agent_slug: string | null;
  display_name: string | null;
  accent: string | null;
  target: string | null;
}

/**
 * 테넌트 활동에서 지식 그래프 구성. 비면 빈 그래프(화면이 mock SVG 폴백).
 * 색은 canvas(react-force-graph)에서 CSS 변수가 안 먹으므로 listing.accent(hex)를 쓴다.
 */
export async function getKnowledgeGraph(
  tenantSlug: string = DEMO_TENANT,
  limit = 200,
): Promise<KnowledgeGraph> {
  try {
    const { rows } = await query<GraphRow>(
      `select l.agent_slug, l.display_name, l.accent, a.target
         from public.agent_activity a
         join public.tenants t on t.id = a.tenant_id
         left join public.agent_listings l on l.id = a.listing_id
        where t.slug = $1
        order by a.occurred_at desc
        limit $2`,
      [tenantSlug, limit],
    );
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const seenLink = new Set<string>();
    for (const r of rows) {
      const agentColor = r.accent ?? '#6E5BD1';
      const agentId = r.agent_slug ? `agent:${r.agent_slug}` : null;
      if (agentId && !nodes.has(agentId)) {
        nodes.set(agentId, {
          id: agentId,
          name: r.display_name ?? r.agent_slug ?? '직원',
          kind: 'agent',
          color: agentColor,
          val: 6,
        });
      }
      if (r.target) {
        const kbId = `kb:${r.target}`;
        if (!nodes.has(kbId)) {
          nodes.set(kbId, {
            id: kbId,
            name: r.target,
            kind: 'knowledge',
            color: agentColor,
            val: 3,
          });
        }
        if (agentId) {
          const lk = `${agentId}->${kbId}`;
          if (!seenLink.has(lk)) {
            seenLink.add(lk);
            links.push({ source: agentId, target: kbId });
          }
        }
      }
    }
    return { nodes: Array.from(nodes.values()), links };
  } catch {
    return { nodes: [], links: [] };
  }
}

// ─── 결제/구독(/my/plan) 실데이터 ─────────────────────────────────────
// 데이터 모델만 실데이터로 구동(플랜 카탈로그/구독/사용량/청구이력). 실제 결제 실행
// (포트원 V2 결제창·빌링키, 팝빌 세금계산서)은 merchant 크리덴셜 필요 → 별도 통합 레이어에서
// 처리하고 payment_events 에 적재한다(여기서는 그 적재 결과를 읽기만).

export interface PlanTier {
  slug: string;
  name: string;
  priceKrw: number;
  period: string;
  blurb: string | null;
  features: Array<[string, string | boolean]>;
  recommended: boolean;
  current: boolean;
}
export interface UsageMeter {
  metric: string;
  label: string;
  used: number;
  limit: number | null;
}
export interface Invoice {
  label: string;
  amountKrw: number;
  status: string;
  occurredAt: string;
}
export interface BillingData {
  currentPlan: PlanTier | null;
  nextBillingAt: string | null;
  paymentMethod: { brand?: string; last4?: string; holder?: string; exp?: string } | null;
  plans: PlanTier[];
  usage: UsageMeter[];
  invoices: Invoice[];
}

const USAGE_LABELS: Record<string, string> = {
  ai_responses: 'AI 응대',
  kb_storage_mb: '가게 지식 용량',
  employees: '채용 중인 직원',
};

/** 테넌트 결제 현황. 비거나 오류면 null(화면이 mock 폴백). */
export async function getBilling(tenantSlug: string = DEMO_TENANT): Promise<BillingData | null> {
  try {
    const [planRes, subRes, usageRes, invRes] = await Promise.all([
      query<{
        slug: string;
        name: string;
        price_krw: number;
        period: string;
        blurb: string | null;
        features: Array<[string, string | boolean]>;
        recommended: boolean;
      }>(
        `select slug, name, price_krw, period, blurb, features, recommended from public.plans order by sort`,
      ),
      query<{
        plan_slug: string;
        next_billing_at: string | Date | null;
        payment_method: BillingData['paymentMethod'];
      }>(
        `select s.plan_slug, s.next_billing_at, s.payment_method
           from public.subscriptions s join public.tenants t on t.id = s.tenant_id
          where t.slug = $1 limit 1`,
        [tenantSlug],
      ),
      query<{ metric: string; used: number; limit_val: number | null }>(
        `select u.metric, u.used, u.limit_val
           from public.usage_meters u join public.tenants t on t.id = u.tenant_id
          where t.slug = $1 order by u.period_start desc, u.metric`,
        [tenantSlug],
      ),
      query<{
        invoice_label: string | null;
        amount_krw: number;
        status: string;
        occurred_at: string | Date;
      }>(
        `select pe.invoice_label, pe.amount_krw, pe.status, pe.occurred_at
           from public.payment_events pe join public.tenants t on t.id = pe.tenant_id
          where t.slug = $1 order by pe.occurred_at desc limit 12`,
        [tenantSlug],
      ),
    ]);

    if (planRes.rows.length === 0) return null;
    const currentSlug = subRes.rows[0]?.plan_slug ?? null;
    const plans: PlanTier[] = planRes.rows.map((p) => ({
      slug: p.slug,
      name: p.name,
      priceKrw: p.price_krw,
      period: p.period,
      blurb: p.blurb,
      features: Array.isArray(p.features) ? p.features : [],
      recommended: p.recommended,
      current: p.slug === currentSlug,
    }));
    const seen = new Set<string>();
    const usage: UsageMeter[] = [];
    for (const u of usageRes.rows) {
      if (seen.has(u.metric)) continue;
      seen.add(u.metric);
      usage.push({
        metric: u.metric,
        label: USAGE_LABELS[u.metric] ?? u.metric,
        used: u.used,
        limit: u.limit_val,
      });
    }
    const nb = subRes.rows[0]?.next_billing_at;
    return {
      currentPlan: plans.find((p) => p.current) ?? null,
      nextBillingAt: nb ? (nb instanceof Date ? nb.toISOString() : nb) : null,
      paymentMethod: subRes.rows[0]?.payment_method ?? null,
      plans,
      usage,
      invoices: invRes.rows.map((r) => ({
        label: r.invoice_label ?? '청구서',
        amountKrw: r.amount_krw,
        status: r.status,
        occurredAt: r.occurred_at instanceof Date ? r.occurred_at.toISOString() : r.occurred_at,
      })),
    };
  } catch {
    return null;
  }
}
