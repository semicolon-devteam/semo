/**
 * semi-roster — Semi의 "인계 대상(roster)"을 SOUL.md 하드코딩에서 데이터 기반으로 승격.
 *
 * 설계: ~/.claude/plans/a-fluffy-grove.md (Codex 검토 반영본)
 * 원칙:
 *  - internal roster SoT = OPENCLAW_BOTS(runtime_source='openclaw'). 실제 inbox dispatch 가능.
 *  - customer roster SoT = agent_listings(audience='customer') ⋈ agent_installs(tenant). P4까지 dispatch 불가.
 *  - dispatchability/멤버십은 OPENCLAW_BOTS(구조적 SoT)에서 결정. KB 마크다운은 표시명/역할 보조만(brittle 회피).
 *  - 타입은 audience별 discriminated union(customer agent_slug ≠ inbox botId → P4 계약 구멍 방지).
 *  - routing 블록 주입은 internal 엔트리만(One Agent Experience: 고객은 단일 orchestrator만 인지).
 */

export type RosterAudience = 'internal' | 'customer';

/** internal: 실제 inbox dispatch 가능. botId = mailbox/route 식별자. */
export interface InternalRosterEntry {
  audience: 'internal';
  botId: string;
  displayName: string;
  roleLabel?: string;
  dispatchable: true;
}

/** customer: P4까지 dispatch 불가. 식별자는 install 축(agent_slug 는 inbox id 아님). */
export interface CustomerRosterEntry {
  audience: 'customer';
  agentSlug: string;
  displayName: string;
  roleLabel?: string;
  installId: string;
  instanceName?: string;
  personaSlug?: string; // P2(agent_installs.persona_slug) 적용 시
  pinnedVersion?: number; // P2(agent_installs.pinned_version) 적용 시
  dispatchable: false;
}

export type RosterEntry = InternalRosterEntry | CustomerRosterEntry;

export interface SemiRosterContext {
  tenantSlug?: string | null; // 없으면 internal(현 프로토타입). 있으면 customer(미래 P4).
}

export interface ResolvedRoster {
  entries: RosterEntry[];
  audience: RosterAudience;
  source: 'internal-openclaw' | 'customer-installs' | 'empty';
}

export interface BotDisplayMeta {
  displayName?: string;
  role?: string;
}

/**
 * KB `semo/bot-ids` content 의 마크다운 표(`| 봇 | Slack ID | 역할 | 비고 |`)에서
 * botId(소문자) → {displayName, role} 보조 메타만 파싱. 실패해도 빈 Map(botId fallback).
 * 멤버십/dispatchability 결정에는 쓰지 않는다(그건 OPENCLAW_BOTS).
 */
export function parseBotIdsDisplayMeta(content: string): Map<string, BotDisplayMeta> {
  const out = new Map<string, BotDisplayMeta>();
  if (!content) return out;
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*\|(.+)\|\s*$/);
    if (!m) continue;
    const cells = m[1].split('|').map((c) => c.trim());
    if (cells.length < 3) continue;
    const name = cells[0];
    // 헤더/구분선 스킵
    if (!name || /^봇$/.test(name) || /^-+$/.test(name) || cells.every((c) => /^-*$/.test(c))) {
      continue;
    }
    const botId = name.replace(/\s+/g, '').toLowerCase(); // "SemiClaw" → "semiclaw"
    if (!/^[a-z0-9-]+$/.test(botId)) continue;
    out.set(botId, { displayName: name, role: cells[2] || undefined });
  }
  return out;
}

/**
 * internal roster = OPENCLAW_BOTS(dispatch 가능한 구조적 SoT) + 마크다운 보조 표시명/역할.
 */
export function buildInternalRoster(
  openclawIds: Set<string>,
  displayMeta?: Map<string, BotDisplayMeta>,
): InternalRosterEntry[] {
  return [...openclawIds]
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .map((botId) => {
      const meta = displayMeta?.get(botId);
      return {
        audience: 'internal' as const,
        botId,
        displayName: meta?.displayName || botId,
        roleLabel: meta?.role,
        dispatchable: true as const,
      };
    });
}

/** 7봇 1:1 fallback (KB/로드 실패 시 degrade — 동작 안전망). */
export const FALLBACK_ROSTER: InternalRosterEntry[] = [
  { audience: 'internal', botId: 'semiclaw', displayName: 'SemiClaw', roleLabel: 'PM/오케스트레이터', dispatchable: true },
  { audience: 'internal', botId: 'planclaw', displayName: 'PlanClaw', roleLabel: '기획', dispatchable: true },
  { audience: 'internal', botId: 'workclaw', displayName: 'WorkClaw', roleLabel: '개발', dispatchable: true },
  { audience: 'internal', botId: 'reviewclaw', displayName: 'ReviewClaw', roleLabel: '코드 리뷰/QA', dispatchable: true },
  { audience: 'internal', botId: 'designclaw', displayName: 'DesignClaw', roleLabel: '디자인', dispatchable: true },
  { audience: 'internal', botId: 'infraclaw', displayName: 'InfraClaw', roleLabel: '인프라', dispatchable: true },
  { audience: 'internal', botId: 'growthclaw', displayName: 'GrowthClaw', roleLabel: '그로스', dispatchable: true },
];

/**
 * Semi 프롬프트에 주입할 "라우팅 가능한 대상" 블록.
 * ⚠️ internal 엔트리만 routing 대상으로 노출(One Agent Experience). customer 는 제외.
 */
export function buildRosterContextBlock(r: ResolvedRoster): string {
  const internal = r.entries.filter((e): e is InternalRosterEntry => e.audience === 'internal');
  if (internal.length === 0) return '';
  const lines = ['# 라우팅 가능한 대상(roster) — 전문 작업은 이 목록 안의 봇에게만 ROUTE'];
  for (const e of internal) {
    lines.push(`- \`${e.botId}\`${e.roleLabel ? ` — ${e.roleLabel}` : ''}`);
  }
  lines.push('이 목록 밖의 이름으로는 ROUTE 하지 않는다. 적합한 대상이 없으면 직접 답하거나 한 가지 질문으로 구체화한다.');
  return lines.join('\n');
}

/** ROUTE 대상이 roster 내 dispatchable 인가. (internal=ok, customer=not-dispatchable, 그 외=not-in-roster) */
export function isRoutable(
  r: ResolvedRoster,
  botId: string | null | undefined,
): { ok: boolean; entry?: RosterEntry; reason?: 'not-in-roster' | 'not-dispatchable' } {
  if (!botId) return { ok: false, reason: 'not-in-roster' };
  const id = botId.trim().toLowerCase();
  const entry = r.entries.find(
    (e) => (e.audience === 'internal' ? e.botId : e.agentSlug).toLowerCase() === id,
  );
  if (!entry) return { ok: false, reason: 'not-in-roster' };
  if (!entry.dispatchable) return { ok: false, entry, reason: 'not-dispatchable' };
  return { ok: true, entry };
}

/**
 * enforce 거부 시 사용자에게 보일 텍스트: 첫 ROUTE/REASON/HANDOFF/ACTION 시스템 라인 이전까지만.
 * (원문 그대로 post 하면 "ROUTE: unknown"·"맡기겠다" 가 노출됨 — Codex Medium #7)
 */
export function stripRouteSystemLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*(ROUTE|REASON|HANDOFF|ACTION)\s*:/i.test(l));
  return (idx === -1 ? lines : lines.slice(0, idx)).join('\n').trim();
}

export interface CustomerInstallRow {
  agent_slug: string;
  display_name: string | null;
  role_label: string | null;
  install_id: string;
  instance_name: string | null;
  persona_slug?: string | null;
  pinned_version?: number | null;
}

export interface SemiRosterDeps {
  openclawBots: Set<string>;
  displayMeta?: Map<string, BotDisplayMeta>;
  /** tenantSlug 의 customer install roster 조회 (P4 전엔 resolve-only). 미주입 시 customer 분기 빈 결과. */
  queryCustomerInstalls?: (tenantSlug: string) => Promise<CustomerInstallRow[]>;
}

/**
 * 컨텍스트 roster resolve.
 *  - tenantSlug 없음 → internal(OPENCLAW_BOTS). 현 프로토타입은 항상 이 경로.
 *  - tenantSlug 있음 → customer(installs, dispatchable=false). P4 전엔 resolve-only.
 */
export async function loadSemiRoster(
  ctx: SemiRosterContext,
  deps: SemiRosterDeps,
): Promise<ResolvedRoster> {
  if (!ctx.tenantSlug) {
    const entries = buildInternalRoster(deps.openclawBots, deps.displayMeta);
    return { entries, audience: 'internal', source: 'internal-openclaw' };
  }
  const rows = deps.queryCustomerInstalls ? await deps.queryCustomerInstalls(ctx.tenantSlug) : [];
  const entries: CustomerRosterEntry[] = rows.map((r) => ({
    audience: 'customer',
    agentSlug: r.agent_slug,
    displayName: r.display_name || r.agent_slug,
    roleLabel: r.role_label || undefined,
    installId: r.install_id,
    instanceName: r.instance_name || undefined,
    personaSlug: r.persona_slug || undefined,
    pinnedVersion: r.pinned_version ?? undefined,
    dispatchable: false,
  }));
  return {
    entries,
    audience: 'customer',
    source: entries.length ? 'customer-installs' : 'empty',
  };
}
