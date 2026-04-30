/**
 * KB-Driven Routing Config Loader
 *
 * bot_delegation 테이블과 KB role 엔트리에서 라우팅 설정을 동적 로드.
 * router.ts의 하드코딩 라우팅 테이블을 대체한다.
 */

import { Pool } from 'pg';
import { loadBotAliases, type BotAliasMap } from './bot-alias.js';

// ── Interfaces ──

export interface RoutingConfig {
  /** Plan track: phase number → botId */
  phaseAssignees: Record<number, string>;
  /** Infra track: phase number → botId */
  infraPhaseAssignees: Record<number, string>;
  /** 키워드 → 봇 라우팅 (우선순위 순) */
  keywordRoutes: Array<{ pattern: RegExp; botId: string }>;
  /** 스킬 키워드 → 봇 + 스킬 라우팅 */
  skillRoutes: Array<{ pattern: RegExp; botId: string; skill: string }>;
  /** Phase 3b: KB delegation 기반 의도 매칭 풀 (agents 도메인의 delegation 키 파싱) */
  kbIntentRoutes: Array<{ botId: string; keywords: string[] }>;
  /** 활성 봇 ID 목록 */
  validBotIds: string[];
  /** alias → canonical bot_id 매핑 (semiclaw → semobot 등) */
  aliases: BotAliasMap;
  /** 로드 시각 (캐시 TTL용) */
  loadedAt: number;
}

/** Phase 3b: KB intent 매칭 결과. */
export interface KbIntentMatch {
  botId: string;
  /** 매칭된 키워드 개수. */
  score: number;
  /** 매칭된 키워드 목록 (감사·디버깅). */
  matchedKeywords: string[];
  /** 2위 봇 + 점수 (top-2 fallback 정책 결정용). */
  runnerUp?: { botId: string; score: number };
}

// ── Fallbacks (DB 장애 시) ──

const FALLBACK_PHASE_ASSIGNEES: Record<number, string> = {
  0: 'semiclaw',
  1: 'planclaw',
  2: 'planclaw',
  3: 'planclaw',
  4: 'designclaw',
  5: 'planclaw',
  6: 'planclaw',
  7: 'workclaw',
  8: 'workclaw',
  9: 'planclaw',
};

const FALLBACK_INFRA_PHASE_ASSIGNEES: Record<number, string> = {
  0: 'infraclaw',
  1: 'infraclaw',
  2: 'infraclaw',
};

const FALLBACK_BOT_IDS = [
  'semiclaw',
  'planclaw',
  'designclaw',
  'workclaw',
  'reviewclaw',
  'infraclaw',
  'growthclaw',
  'incubator',
];

// ── Helpers ──

/** 특수문자 이스케이프 후 domains 배열을 하나의 RegExp로 합침 */
function domainsToRegex(domains: string[]): RegExp {
  const escaped = domains.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('|'), 'i');
}

/**
 * Phase 3b: 봇 delegation KB 엔트리에서 "## 수신 키워드" 섹션 파싱.
 *
 * 형식:
 *   ## 수신 키워드
 *   - 할일
 *   - 액션아이템
 *   - action item
 *
 *   ## 에스컬레이션
 *   ...
 *
 * 반환: 키워드 배열 (소문자 정규화, 중복 제거).
 */
export function parseDelegationKeywords(content: string): string[] {
  const sectionMatch = content.match(/##\s*수신\s*키워드\s*\n([\s\S]*?)(?=\n##\s|$)/);
  if (!sectionMatch) return [];
  const lines = sectionMatch[1].split('\n');
  const keywords: string[] = [];
  for (const raw of lines) {
    const m = raw.match(/^\s*-\s*(.+?)\s*$/);
    if (!m) continue;
    const kw = m[1].trim();
    if (!kw || kw.startsWith('(')) continue; // "(TODO: 키워드 백필 필요)" 같은 placeholder 제외
    keywords.push(kw.toLowerCase());
  }
  return Array.from(new Set(keywords));
}

/**
 * Phase 3b: 사용자 메시지 ↔ kbIntentRoutes 매칭 → 점수 정렬.
 *
 * Codex 권고 (2026-04-29):
 *  - 1차는 substring/정규화 매칭으로 충분 (임베딩은 P3.5+).
 *  - confidence threshold 두고 phase 라우팅을 이기게.
 *  - top-2 근접 시 semiclaw fallback (UX vs 정확도 tradeoff).
 *
 * 점수 = 매칭된 봇별 키워드 개수. 동률은 입력 순서 (안정 정렬).
 *
 * @param text 사용자 메시지 (소문자 정규화 후 substring 매칭)
 * @param routes loadRoutingConfig().kbIntentRoutes
 * @returns 매칭 1위 + runnerUp. 매칭 0개 봇은 후보에서 제외. 전체 0이면 null.
 */
export function kbIntentMatch(
  text: string,
  routes: Array<{ botId: string; keywords: string[] }>,
): KbIntentMatch | null {
  if (!text || routes.length === 0) return null;
  const haystack = text.toLowerCase();

  type Hit = { botId: string; score: number; matched: string[] };
  const hits: Hit[] = [];
  for (const r of routes) {
    const matched = r.keywords.filter((k) => haystack.includes(k));
    if (matched.length > 0) hits.push({ botId: r.botId, score: matched.length, matched });
  }
  if (hits.length === 0) return null;

  // 점수 내림차순. 동률은 매칭된 키워드 길이 합 (긴 키워드 = 더 구체적) 으로 tiebreak.
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aLen = a.matched.reduce((s, k) => s + k.length, 0);
    const bLen = b.matched.reduce((s, k) => s + k.length, 0);
    return bLen - aLen;
  });

  const top = hits[0];
  const runner = hits[1];
  return {
    botId: top.botId,
    score: top.score,
    matchedKeywords: top.matched,
    runnerUp: runner ? { botId: runner.botId, score: runner.score } : undefined,
  };
}

/**
 * KB role 콘텐츠에서 "### GFP Phase 담당" 마크다운 테이블 파싱.
 * | Phase | Name | 형태의 테이블에서 phase 번호를 추출한다.
 */
export function parsePhaseTable(content: string, track: 'plan' | 'infra' = 'plan'): number[] {
  // 섹션 헤더 찾기
  const sectionPattern =
    track === 'infra' ? /###\s*GFP Phase 담당\s*\(Infra[^)]*\)/i : /###\s*GFP Phase 담당(?!\s*\()/i;

  const match = content.match(sectionPattern);
  if (!match || match.index === undefined) return [];

  // 섹션 시작부터 다음 ### 또는 문서 끝까지
  const sectionStart = match.index + match[0].length;
  const nextSection = content.indexOf('\n###', sectionStart);
  const section =
    nextSection === -1 ? content.slice(sectionStart) : content.slice(sectionStart, nextSection);

  // 테이블 행에서 Phase 번호 추출
  const phases: number[] = [];
  const rowPattern = /\|\s*(\d+)\s*\|/g;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(section)) !== null) {
    phases.push(parseInt(rowMatch[1], 10));
  }
  return phases;
}

// ── Main Loader ──

export async function loadRoutingConfig(pool: Pool): Promise<RoutingConfig> {
  // 1. 활성 봇 목록
  let validBotIds: string[];
  try {
    const botResult = await pool.query(
      `SELECT bot_id FROM semo.bot_status WHERE status != 'retired' ORDER BY bot_id`,
    );
    validBotIds = botResult.rows.map((r) => r.bot_id);
    if (validBotIds.length === 0) validBotIds = [...FALLBACK_BOT_IDS];
  } catch {
    validBotIds = [...FALLBACK_BOT_IDS];
  }

  // 2. Phase 매핑 — KB role 엔트리에서 파싱
  const phaseAssignees: Record<number, string> = {};
  const infraPhaseAssignees: Record<number, string> = {};
  try {
    // ontology 의 봇 도메인은 entity_type='agents' (이전 'bot' 으로 잘못 검색되어 0 row → fallback 강제 사용 중이었음).
    // role 키 외에 identity/delegation 안에도 "### GFP Phase 담당" 표 둘 수 있도록 multiple 키 허용.
    const kbResult = await pool.query(
      `SELECT kb.domain AS bot_id, kb.content
       FROM semo.knowledge_base kb
       JOIN semo.ontology o ON o.domain = kb.domain AND o.entity_type = 'agents'
       WHERE kb.key IN ('role', 'identity', 'delegation') AND (kb.sub_key = '' OR kb.sub_key IS NULL)`,
    );
    for (const row of kbResult.rows) {
      // Plan track phases
      const planPhases = parsePhaseTable(row.content, 'plan');
      for (const phase of planPhases) {
        phaseAssignees[phase] = row.bot_id;
      }
      // Infra track phases
      const infraPhases = parsePhaseTable(row.content, 'infra');
      for (const phase of infraPhases) {
        infraPhaseAssignees[phase] = row.bot_id;
      }
    }
    // semiclaw은 Phase 0 기본 담당 (KB에 명시 안 돼 있어도)
    if (!phaseAssignees[0]) phaseAssignees[0] = 'semiclaw';
  } catch (err) {
    console.warn('[kb-routing] Failed to load phase assignments from KB:', err);
    Object.assign(phaseAssignees, FALLBACK_PHASE_ASSIGNEES);
    Object.assign(infraPhaseAssignees, FALLBACK_INFRA_PHASE_ASSIGNEES);
  }

  // 3. 키워드 라우팅 — bot_delegation 테이블
  const keywordRoutes: RoutingConfig['keywordRoutes'] = [];
  try {
    const delResult = await pool.query(
      `SELECT to_bot_id, domains, metadata
       FROM semo.bot_delegation
       WHERE from_bot_id = 'orchestrator' AND delegation_type = 'routing' AND is_active = true
       ORDER BY COALESCE((metadata->>'order')::int, 999)`,
    );
    for (const row of delResult.rows) {
      if (row.domains && row.domains.length > 0) {
        keywordRoutes.push({
          pattern: domainsToRegex(row.domains),
          botId: row.to_bot_id,
        });
      }
    }
  } catch (err) {
    console.warn('[kb-routing] Failed to load keyword routes from bot_delegation:', err);
  }

  // 4. 스킬 라우팅 — bot_delegation 테이블
  const skillRoutes: RoutingConfig['skillRoutes'] = [];
  try {
    const skillResult = await pool.query(
      `SELECT to_bot_id, domains, metadata
       FROM semo.bot_delegation
       WHERE from_bot_id = 'orchestrator' AND delegation_type = 'skill-routing' AND is_active = true
       ORDER BY id`,
    );
    for (const row of skillResult.rows) {
      const skill = row.metadata?.skill;
      if (row.domains && row.domains.length > 0 && skill) {
        skillRoutes.push({
          pattern: domainsToRegex(row.domains),
          botId: row.to_bot_id,
          skill,
        });
      }
    }
  } catch (err) {
    console.warn('[kb-routing] Failed to load skill routes from bot_delegation:', err);
  }

  // 5. Alias 맵 (semiclaw → semobot 등)
  const aliases = await loadBotAliases(pool);

  // 6. KB intent routes (Phase 3b) — agents 도메인의 delegation 키 파싱.
  // active 봇만 (status != 'retired'). semobot/orchestrator 류는 KB delegation 키워드가 비어있을 수 있음 — skip.
  const kbIntentRoutes: RoutingConfig['kbIntentRoutes'] = [];
  try {
    const intentResult = await pool.query(
      `SELECT kb.domain AS bot_id, kb.content
       FROM semo.knowledge_base kb
       JOIN semo.ontology o ON o.domain = kb.domain
       JOIN semo.bot_status bs ON bs.bot_id = kb.domain
       WHERE o.entity_type = 'agents'
         AND kb.key = 'delegation'
         AND (kb.sub_key = '' OR kb.sub_key IS NULL)
         AND bs.status != 'retired'`,
    );
    for (const row of intentResult.rows) {
      const keywords = parseDelegationKeywords(row.content);
      if (keywords.length > 0) {
        kbIntentRoutes.push({ botId: row.bot_id, keywords });
      }
    }
  } catch (err) {
    console.warn('[kb-routing] Failed to load kbIntentRoutes:', err);
  }

  const config: RoutingConfig = {
    phaseAssignees,
    infraPhaseAssignees,
    keywordRoutes,
    skillRoutes,
    kbIntentRoutes,
    validBotIds,
    aliases,
    loadedAt: Date.now(),
  };

  console.log(
    `[kb-routing] Loaded: ${Object.keys(phaseAssignees).length} plan phases, ` +
      `${Object.keys(infraPhaseAssignees).length} infra phases, ` +
      `${keywordRoutes.length} keyword routes, ` +
      `${skillRoutes.length} skill routes, ` +
      `${kbIntentRoutes.length} kb-intent routes, ` +
      `${validBotIds.length} active bots`,
  );

  return config;
}
