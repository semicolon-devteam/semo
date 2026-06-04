/**
 * customer-runtime — 고객(테넌트) 에이전트를 기존 serve-worker 엔진으로 실행 가능하게 잇는 브릿지.
 *
 * 설계: docs/superpowers/specs/2026-06-04-customer-dynamic-delegation-design.md
 *
 * 핵심: public.agent_installs(고객 마켓 설치) ↔ ${DB_SCHEMA}.bot_status(런타임 identity) 프로젝션.
 *   프로젝션하면 기존 runtime serve / mailbox-supervisor / bot_commitments 워크큐 /
 *   대시보드 큐 / OutboxReader 가 변경 없이 customer 에이전트를 처리한다.
 *
 * 해소(resolve): 요청 → 테넌트 풀 → 라이브러리 → none(2-B 생성).
 */
import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getPool } from '../database';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

function mailboxDir(botId: string): string {
  const base = process.env.SEMO_MAILBOX_DIR ?? path.join(os.homedir(), '.semo', 'mailbox');
  return path.join(base, botId);
}

export interface ProjectedAgent {
  botId: string;
  tenantSlug: string;
  agentSlug: string;
  displayName: string;
  roleLabel: string | null;
  hostKind: string;
}

export interface ProjectOptions {
  /** 실행 호스트. MVP 기본 ollama-cli(무인증·프로필 불필요). 실배포는 web 가능 호스트로 override. */
  hostKind?: string;
  ollamaModel?: string;
}

/** customer 에이전트의 런타임 bot_id 규약 — 테넌트+에이전트로 안정적·가독. */
export function customerBotId(tenantSlug: string, agentSlug: string): string {
  return `ag-${tenantSlug}-${agentSlug}`;
}

interface InstallRow {
  install_id: string;
  instance_name: string | null;
  tenant_id: string;
  tenant_slug: string;
  tenant_display_name: string | null;
  listing_id: string;
  agent_slug: string;
  display_name: string;
  role_label: string | null;
  bio: string | null;
  short_desc: string | null;
  dept: string | null;
  skills: unknown;
  persona_template: string | null;
  persona_override: string | null;
}

/** 라이브러리 템플릿/고객 override 의 플레이스홀더를 테넌트 정보로 치환. */
function fillPlaceholders(text: string, row: InstallRow): string {
  const company = row.tenant_display_name || row.tenant_slug;
  return text
    .replace(/\{회사명\}/g, company)
    .replace(/\{회사\}/g, company)
    .replace(/\{tenant\}/gi, company);
}

/**
 * 설치된 customer 에이전트의 런타임 soul 해소:
 * 고객 override > 라이브러리 persona_template > listing 메타 합성. (커스터마이즈 우선)
 */
export function resolveCustomerSoul(row: InstallRow): string {
  if (row.persona_override && row.persona_override.trim()) {
    return fillPlaceholders(row.persona_override, row);
  }
  if (row.persona_template && row.persona_template.trim()) {
    return fillPlaceholders(row.persona_template, row);
  }
  return buildCustomerSoul(row);
}

function skillsText(skills: unknown): string {
  if (Array.isArray(skills)) return skills.map((s) => String(s)).join(', ');
  if (skills && typeof skills === 'object') return Object.values(skills).map(String).join(', ');
  return skills ? String(skills) : '';
}

/** listing 메타로 런타임 persona(soul_md) 합성. */
export function buildCustomerSoul(row: {
  display_name: string;
  role_label: string | null;
  bio: string | null;
  short_desc: string | null;
  dept: string | null;
  tenant_slug: string;
  skills: unknown;
}): string {
  const skills = skillsText(row.skills);
  const intro = row.bio || row.short_desc || '';
  return [
    `당신은 "${row.display_name}"(${row.role_label || '직원'})${row.dept ? ` · ${row.dept}` : ''}.`,
    intro,
    skills ? `보유 스킬: ${skills}.` : '',
    `테넌트 "${row.tenant_slug}"의 직원으로서 고객 요청을 정확하고 친절하게 처리하고, 결과를 간결히 보고한다.`,
    `요청 범위를 벗어나는 일은 하지 않으며, 확인이 필요하면 명확히 묻는다.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function loadInstall(installId: string): Promise<InstallRow | null> {
  const pool = getPool();
  const r = await pool.query<InstallRow>(
    `SELECT i.id AS install_id, i.instance_name, i.persona_override,
            t.id AS tenant_id, t.slug AS tenant_slug, t.display_name AS tenant_display_name,
            l.id AS listing_id, l.agent_slug, l.display_name, l.role_label,
            l.bio, l.short_desc, l.dept, l.skills, l.persona_template
     FROM public.agent_installs i
     JOIN public.tenants t ON t.id = i.tenant_id
     JOIN public.agent_listings l ON l.id = i.listing_id
     WHERE i.id = $1 AND i.install_status = 'active'`,
    [installId],
  );
  return r.rows[0] ?? null;
}

/**
 * agent_install → ${DB_SCHEMA}.bot_status + agent_personas 프로젝션. 멱등(ON CONFLICT).
 * 반환: 런타임 식별자. 이걸로 `runtime serve --bot <botId>` 실행 가능.
 */
export async function projectInstallToBotStatus(
  installId: string,
  opts: ProjectOptions = {},
): Promise<ProjectedAgent | null> {
  const pool = getPool();
  const row = await loadInstall(installId);
  if (!row) return null;

  const botId = customerBotId(row.tenant_slug, row.agent_slug);
  const hostKind = opts.hostKind ?? 'ollama-cli';
  const config: Record<string, unknown> = {
    host_kind: hostKind,
    audience: 'customer',
    tenant_id: row.tenant_id,
    tenant_slug: row.tenant_slug,
    listing_id: row.listing_id,
    install_id: row.install_id,
    agent_slug: row.agent_slug,
    serve_worker_enabled: 'true',
    use_persona_envelope: true,
  };
  if (hostKind === 'ollama-cli') config.ollama_model = opts.ollamaModel ?? 'qwen2.5:0.5b';

  await pool.query(
    `INSERT INTO ${DB_SCHEMA}.bot_status (bot_id, name, role, status, config)
     VALUES ($1, $2, $3, 'online', $4::jsonb)
     ON CONFLICT (bot_id) DO UPDATE
       SET name = EXCLUDED.name,
           role = EXCLUDED.role,
           config = ${DB_SCHEMA}.bot_status.config || EXCLUDED.config,
           synced_at = now()`,
    [botId, row.instance_name || row.display_name, row.role_label, JSON.stringify(config)],
  );

  const soul = resolveCustomerSoul(row);
  const nickname = row.instance_name || row.display_name; // 고객이 정한 닉네임 우선
  await pool.query(
    `INSERT INTO ${DB_SCHEMA}.agent_personas (slug, display_name, soul_md, version, status, updated_by, created_at, updated_at)
     VALUES ($1, $2, $3, 1, 'active', 'customer-projection', now(), now())
     ON CONFLICT (slug) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           soul_md = EXCLUDED.soul_md,
           version = ${DB_SCHEMA}.agent_personas.version + 1,
           updated_at = now()`,
    [botId, nickname, soul],
  );

  return {
    botId,
    tenantSlug: row.tenant_slug,
    agentSlug: row.agent_slug,
    displayName: nickname,
    roleLabel: row.role_label,
    hostKind,
  };
}

/** 테넌트의 모든 active install 을 프로젝션. */
export async function projectAllActiveInstalls(
  tenantSlug?: string,
  opts: ProjectOptions = {},
): Promise<ProjectedAgent[]> {
  const pool = getPool();
  const r = await pool.query<{ id: string }>(
    `SELECT i.id FROM public.agent_installs i
     JOIN public.tenants t ON t.id = i.tenant_id
     WHERE i.install_status = 'active' AND ($1::text IS NULL OR t.slug = $1)`,
    [tenantSlug ?? null],
  );
  const out: ProjectedAgent[] = [];
  for (const { id } of r.rows) {
    const p = await projectInstallToBotStatus(id, opts);
    if (p) out.push(p);
  }
  return out;
}

// ── 해소(resolution) ──────────────────────────────────────────────────────

export interface RequestIntent {
  /** 요청에서 추출한 키워드(역할/스킬/도메인). 규칙기반 매칭용. */
  keywords: string[];
}

export interface AgentMatch {
  source: 'tenant-pool' | 'library' | 'none';
  score: number;
  installId?: string;
  listingId?: string;
  agentSlug?: string;
  displayName?: string;
  roleLabel?: string | null;
}

interface CandidateRow {
  install_id?: string;
  listing_id: string;
  agent_slug: string;
  display_name: string;
  role_label: string | null;
  short_desc: string | null;
  dept: string | null;
  skills: unknown;
}

/** 후보 에이전트 ↔ 요청 의도 매칭 점수(0~1). 규칙기반: 키워드 적중률. */
export function scoreAgent(row: CandidateRow, intent: RequestIntent): number {
  if (!intent.keywords.length) return 0;
  const hay = [
    row.agent_slug,
    row.display_name,
    row.role_label,
    row.short_desc,
    row.dept,
    skillsText(row.skills),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  let hits = 0;
  for (const kw of intent.keywords) if (hay.includes(kw.toLowerCase())) hits++;
  return hits / intent.keywords.length;
}

const MATCH_THRESHOLD = 0.34; // 키워드 3개 중 1개 이상

/**
 * 요청에 맞는 에이전트 해소: (1) 테넌트 풀 → (2) 라이브러리 → (3) none(2-B 생성 신호).
 */
export async function resolveAgentForRequest(
  tenantSlug: string,
  intent: RequestIntent,
): Promise<AgentMatch> {
  const pool = getPool();

  const poolRes = await pool.query<CandidateRow>(
    `SELECT i.id AS install_id, l.id AS listing_id, l.agent_slug, l.display_name,
            l.role_label, l.short_desc, l.dept, l.skills
     FROM public.agent_installs i
     JOIN public.tenants t ON t.id = i.tenant_id
     JOIN public.agent_listings l ON l.id = i.listing_id
     WHERE t.slug = $1 AND i.install_status = 'active'`,
    [tenantSlug],
  );
  const bestPool = poolRes.rows
    .map((r) => ({ r, score: scoreAgent(r, intent) }))
    .sort((a, b) => b.score - a.score)[0];
  if (bestPool && bestPool.score >= MATCH_THRESHOLD) {
    return {
      source: 'tenant-pool',
      score: bestPool.score,
      installId: bestPool.r.install_id,
      listingId: bestPool.r.listing_id,
      agentSlug: bestPool.r.agent_slug,
      displayName: bestPool.r.display_name,
      roleLabel: bestPool.r.role_label,
    };
  }

  const libRes = await pool.query<CandidateRow>(
    `SELECT id AS listing_id, agent_slug, display_name, role_label, short_desc, dept, skills
     FROM public.agent_listings
     WHERE audience = 'customer' AND review_status = 'approved'`,
  );
  const bestLib = libRes.rows
    .map((r) => ({ r, score: scoreAgent(r, intent) }))
    .sort((a, b) => b.score - a.score)[0];
  if (bestLib && bestLib.score >= MATCH_THRESHOLD) {
    return {
      source: 'library',
      score: bestLib.score,
      listingId: bestLib.r.listing_id,
      agentSlug: bestLib.r.agent_slug,
      displayName: bestLib.r.display_name,
      roleLabel: bestLib.r.role_label,
    };
  }

  return { source: 'none', score: bestPool?.score ?? 0 };
}

// ── 2-B: plain 템플릿 신규 생성 ────────────────────────────────────────────

export interface CreateAgentSpec {
  agentSlug: string; // 예: 'researcher'
  displayName: string; // 예: '리서처'
  roleLabel: string; // 예: '웹 조사·분석 직원'
  shortDesc?: string;
  skills?: string[];
  hostKind?: string;
  ollamaModel?: string;
}

export interface CreatedAgent extends ProjectedAgent {
  listingId: string;
  installId: string;
  notifiedAdmin: boolean;
}

/**
 * 2-B: 적합 에이전트가 없을 때 plain 템플릿으로 신규 생성.
 *   - agent_listings(draft/customer) upsert + agent_installs(tenant) + bot_status 프로젝션
 *   - 플랫폼 제공자 인지용: listing.review_status='draft', visibility='draft' (어드민이 라이브러리 등록 판단)
 */
export async function createPlainAgent(
  tenantSlug: string,
  spec: CreateAgentSpec,
): Promise<CreatedAgent> {
  const pool = getPool();
  const t = await pool.query<{ id: string }>(`SELECT id FROM public.tenants WHERE slug = $1`, [
    tenantSlug,
  ]);
  const tenantId = t.rows[0]?.id;
  if (!tenantId) throw new Error(`tenant not found: ${tenantSlug}`);

  const listing = await pool.query<{ id: string }>(
    `INSERT INTO public.agent_listings
       (agent_slug, display_name, role_label, short_desc, skills, audience, review_status, visibility)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'customer', 'draft', 'private')
     ON CONFLICT (agent_slug) DO UPDATE
       SET display_name = EXCLUDED.display_name, role_label = EXCLUDED.role_label,
           short_desc = EXCLUDED.short_desc, skills = EXCLUDED.skills
     RETURNING id`,
    [
      spec.agentSlug,
      spec.displayName,
      spec.roleLabel,
      spec.shortDesc ?? null,
      JSON.stringify(spec.skills ?? []),
    ],
  );
  const listingId = listing.rows[0].id;

  const install = await pool.query<{ id: string }>(
    `INSERT INTO public.agent_installs (tenant_id, listing_id, instance_name, install_status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [tenantId, listingId, spec.displayName],
  );
  let installId = install.rows[0]?.id;
  if (!installId) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM public.agent_installs WHERE tenant_id = $1 AND listing_id = $2 LIMIT 1`,
      [tenantId, listingId],
    );
    installId = existing.rows[0]?.id;
  }
  if (!installId) throw new Error('install 생성 실패');

  const projected = await projectInstallToBotStatus(installId, {
    hostKind: spec.hostKind,
    ollamaModel: spec.ollamaModel,
  });
  if (!projected) throw new Error('프로젝션 실패');

  // 플랫폼 제공자 인지: 어드민 알림 레코드(액션아이템 형태). 실패해도 생성은 성공.
  let notifiedAdmin = false;
  try {
    await pool.query(
      `INSERT INTO ${DB_SCHEMA}.action_items (owner_domain, description, status, category, source, metadata, created_at, updated_at)
       VALUES ('semo', $1, 'open', 'agent-library', 'customer-runtime', $2::jsonb, now(), now())`,
      [
        `[에이전트 라이브러리 검토] 테넌트 ${tenantSlug}에서 신규 에이전트 '${spec.displayName}'(${spec.agentSlug}) 자동 생성됨 — 라이브러리 등록 여부 판단 필요`,
        JSON.stringify({
          kind: 'agent-library-review',
          tenant: tenantSlug,
          listing_id: listingId,
          agent_slug: spec.agentSlug,
        }),
      ],
    );
    notifiedAdmin = true;
  } catch {
    /* action_items 스키마 상이 시 무시 — 생성 자체는 성공 */
  }

  return { ...projected, listingId, installId, notifiedAdmin };
}

// ── 위임 오케스트레이션 (Semi 가 호출할 핵심 로직) ───────────────────────────

export interface DelegationRequest {
  text: string;
  channelId: string;
  threadId: string;
  senderName?: string;
  platform?: string;
  /** 결과 reply 를 Slack 에 relay 할 정체성(orchestrator bot_id). 미지정 시 OutboxReader 가
   *  CUSTOMER_RELAY_BOT_ID 기본값으로 relay. 테넌트별 orchestrator 대비 명시 경로. */
  relayAs?: string;
}

export interface DelegationResult {
  status: 'dispatched' | 'busy' | 'no-agent';
  agent?: ProjectedAgent;
  source?: AgentMatch['source'] | 'created';
  commitmentId?: string;
  busyTitle?: string;
}

/** 해당 customer 에이전트가 현재 작업 중(active commitment 존재)인가. */
export async function isAgentBusy(botId: string): Promise<{ busy: boolean; title?: string }> {
  const pool = getPool();
  const r = await pool.query<{ title: string }>(
    `SELECT title FROM ${DB_SCHEMA}.bot_commitments WHERE bot_id = $1 AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
    [botId],
  );
  return { busy: r.rows.length > 0, title: r.rows[0]?.title };
}

/** customer 에이전트 mailbox 에 작업 dispatch + bot_commitments(active) 생성. 원 스레드 보존. */
export async function dispatchToCustomerAgent(
  botId: string,
  req: DelegationRequest,
  agentDisplayName?: string,
): Promise<string> {
  const dir = mailboxDir(botId);
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  const msg = {
    id: randomUUID(),
    type: 'message',
    sender_name: req.senderName ?? 'customer',
    text: req.text,
    channel_id: req.channelId,
    thread_id: req.threadId,
    platform: req.platform ?? 'slack',
    timestamp: now,
  };
  fs.appendFileSync(path.join(dir, 'inbox.jsonl'), JSON.stringify(msg) + '\n');

  const pool = getPool();
  const commitmentId = `cmt-${botId}-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;
  await pool.query(
    `INSERT INTO ${DB_SCHEMA}.bot_commitments
       (id, bot_id, status, title, source_type, source_ref, pipeline_context, created_at, updated_at)
     VALUES ($1, $2, 'active', $3, 'customer-delegation', $4, $5::jsonb, now(), now())`,
    [
      commitmentId,
      botId,
      req.text.slice(0, 120),
      `${req.channelId}:${req.threadId}`,
      JSON.stringify({
        channel: req.channelId,
        thread: req.threadId,
        sender_name: req.senderName,
        message_id: msg.id,
        // relay_as: 결과 reply 의 Slack relay 정체성. maybeWrapReplyPersona 가 이 값을 읽어
        // override(없으면 CUSTOMER_RELAY_BOT_ID 기본). 테넌트별 orchestrator relay 지원.
        ...(req.relayAs ? { relay_as: req.relayAs } : {}),
        // agent_display_name: relay footer "담당: X" 의 정확한 표시명(bot_id 추출은 하이픈 슬러그에 모호).
        ...(agentDisplayName ? { agent_display_name: agentDisplayName } : {}),
      }),
    ],
  );
  return commitmentId;
}

/**
 * Semi 가 호출할 핵심 위임 로직: 해소 → (없으면 2-B 생성) → 프로젝션 → busy 체크 → dispatch.
 * busy 면 dispatch 하되 status='busy' 반환(Semi 가 "처리 중, 이어서" 안내).
 */
export async function delegateToCustomerAgent(
  tenantSlug: string,
  intent: RequestIntent,
  req: DelegationRequest,
  opts: { create?: CreateAgentSpec; projectOpts?: ProjectOptions } = {},
): Promise<DelegationResult> {
  const match = await resolveAgentForRequest(tenantSlug, intent);

  let agent: ProjectedAgent | null = null;
  let source: DelegationResult['source'] = match.source;

  if (match.source === 'tenant-pool' && match.installId) {
    agent = await projectInstallToBotStatus(match.installId, opts.projectOpts);
  } else if (match.source === 'library' && match.agentSlug) {
    // 2-A: 라이브러리 히트 → 테넌트에 설치 후 프로젝션 (createPlainAgent 가 listing 재사용)
    const created = await createPlainAgent(tenantSlug, {
      agentSlug: match.agentSlug,
      displayName: match.displayName ?? match.agentSlug,
      roleLabel: match.roleLabel ?? '직원',
      hostKind: opts.projectOpts?.hostKind,
      ollamaModel: opts.projectOpts?.ollamaModel,
    });
    agent = created;
    source = 'library';
  } else if (opts.create) {
    // 2-B: 신규 생성
    const created = await createPlainAgent(tenantSlug, opts.create);
    agent = created;
    source = 'created';
  }

  if (!agent) return { status: 'no-agent' };

  const busy = await isAgentBusy(agent.botId);
  const commitmentId = await dispatchToCustomerAgent(agent.botId, req, agent.displayName);
  return {
    status: busy.busy ? 'busy' : 'dispatched',
    agent,
    source,
    commitmentId,
    busyTitle: busy.title,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────

export function registerCustomerCommands(program: Command): void {
  const cmd = program
    .command('customer')
    .description('고객(테넌트) 에이전트 런타임 브릿지 — 프로젝션/해소/생성');

  cmd
    .command('project')
    .description(`agent_install → ${DB_SCHEMA}.bot_status 프로젝션 (런타임 실행 가능화)`)
    .option('--install <id>', '특정 install id')
    .option('--tenant <slug>', '테넌트의 모든 active install 프로젝션')
    .option('--host-kind <kind>', '실행 호스트 (기본 ollama-cli)')
    .option('--ollama-model <m>', 'ollama 모델 (기본 qwen2.5:0.5b)')
    .action(
      async (opts: {
        install?: string;
        tenant?: string;
        hostKind?: string;
        ollamaModel?: string;
      }) => {
        const projOpts = { hostKind: opts.hostKind, ollamaModel: opts.ollamaModel };
        if (opts.install) {
          const p = await projectInstallToBotStatus(opts.install, projOpts);
          console.log(
            p ? `✓ projected: ${p.botId} (host=${p.hostKind})` : '✗ install not found/active',
          );
        } else {
          const ps = await projectAllActiveInstalls(opts.tenant, projOpts);
          console.log(`✓ projected ${ps.length}개:`);
          ps.forEach((p) => console.log(`  ${p.botId} | ${p.displayName} | host=${p.hostKind}`));
        }
        process.exit(0);
      },
    );

  cmd
    .command('resolve')
    .description('요청 의도 → 적합 에이전트 해소 (풀→라이브러리→none)')
    .requiredOption('--tenant <slug>', '테넌트 slug')
    .requiredOption('--keywords <csv>', '의도 키워드 (쉼표구분)')
    .action(async (opts: { tenant: string; keywords: string }) => {
      const keywords = opts.keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const m = await resolveAgentForRequest(opts.tenant, { keywords });
      console.log(JSON.stringify(m, null, 2));
      process.exit(0);
    });

  cmd
    .command('delegate')
    .description('Semi 위임 시뮬레이션: 해소→(생성)→프로젝션→busy체크→dispatch')
    .requiredOption('--tenant <slug>', '테넌트 slug')
    .requiredOption('--keywords <csv>', '의도 키워드')
    .requiredOption('--text <t>', '요청 본문')
    .requiredOption('--channel <c>', 'Slack channel id')
    .requiredOption('--thread <t>', 'Slack thread id')
    .option('--sender <s>', '요청자명', 'customer')
    .option('--relay-as <botId>', '결과 reply relay 정체성(orchestrator). 미지정 시 기본 relay')
    .option('--create-slug <s>', '2-B 생성 시 agent_slug')
    .option('--create-name <n>', '2-B 생성 시 display_name')
    .option('--create-role <r>', '2-B 생성 시 role_label')
    .option('--create-skills <csv>', '2-B 생성 시 스킬')
    .action(
      async (opts: {
        tenant: string;
        keywords: string;
        text: string;
        channel: string;
        thread: string;
        sender: string;
        relayAs?: string;
        createSlug?: string;
        createName?: string;
        createRole?: string;
        createSkills?: string;
      }) => {
        const keywords = opts.keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const create =
          opts.createSlug && opts.createName && opts.createRole
            ? {
                agentSlug: opts.createSlug,
                displayName: opts.createName,
                roleLabel: opts.createRole,
                skills: opts.createSkills
                  ? opts.createSkills
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : undefined,
              }
            : undefined;
        const r = await delegateToCustomerAgent(
          opts.tenant,
          { keywords },
          {
            text: opts.text,
            channelId: opts.channel,
            threadId: opts.thread,
            senderName: opts.sender,
            relayAs: opts.relayAs,
          },
          { create },
        );
        console.log(JSON.stringify(r, null, 2));
        process.exit(0);
      },
    );

  cmd
    .command('create')
    .description('2-B: plain 템플릿으로 신규 에이전트 생성 + 프로젝션 + 어드민 알림')
    .requiredOption('--tenant <slug>', '테넌트 slug')
    .requiredOption('--slug <s>', 'agent_slug (예: researcher)')
    .requiredOption('--name <n>', 'display_name')
    .requiredOption('--role <r>', 'role_label')
    .option('--skills <csv>', '스킬 (쉼표구분)')
    .option('--desc <d>', 'short_desc')
    .option('--host-kind <kind>', '실행 호스트 (기본 ollama-cli)')
    .option('--ollama-model <m>', 'ollama 모델')
    .action(
      async (opts: {
        tenant: string;
        slug: string;
        name: string;
        role: string;
        skills?: string;
        desc?: string;
        hostKind?: string;
        ollamaModel?: string;
      }) => {
        const created = await createPlainAgent(opts.tenant, {
          agentSlug: opts.slug,
          displayName: opts.name,
          roleLabel: opts.role,
          shortDesc: opts.desc,
          skills: opts.skills
            ? opts.skills
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          hostKind: opts.hostKind,
          ollamaModel: opts.ollamaModel,
        });
        console.log(
          `✓ created: ${created.botId} (listing=${created.listingId}, install=${created.installId}, host=${created.hostKind}, adminNotified=${created.notifiedAdmin})`,
        );
        process.exit(0);
      },
    );
}
