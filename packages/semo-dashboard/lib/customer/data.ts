/**
 * Customer 대시보드 v5 — 실데이터 액세스 (appdb, public 스키마).
 *
 * 데이터는 DATABASE_URL(appdb)에서 pg 로 읽는다(인증은 Supabase 별개). tenant 격리는
 * 여기 쿼리 레이어의 WHERE tenant_slug 로 처리(appdb 는 RLS 없음, 서버 trusted).
 * 현재는 데모 단일 테넌트(정민 카페). 실제 멀티테넌시 전환 시 tenantSlug 를 세션에서 주입.
 */
import { query } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const DEMO_TENANT = 'jeongmin-cafe';

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
