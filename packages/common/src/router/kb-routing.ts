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
  /** 활성 봇 ID 목록 */
  validBotIds: string[];
  /** alias → canonical bot_id 매핑 (semiclaw → semobot 등) */
  aliases: BotAliasMap;
  /** 로드 시각 (캐시 TTL용) */
  loadedAt: number;
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
    const kbResult = await pool.query(
      `SELECT kb.domain AS bot_id, kb.content
       FROM semo.knowledge_base kb
       JOIN semo.ontology o ON o.domain = kb.domain AND o.entity_type = 'bot'
       WHERE kb.key = 'role' AND (kb.sub_key = '' OR kb.sub_key IS NULL)`,
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

  const config: RoutingConfig = {
    phaseAssignees,
    infraPhaseAssignees,
    keywordRoutes,
    skillRoutes,
    validBotIds,
    aliases,
    loadedAt: Date.now(),
  };

  console.log(
    `[kb-routing] Loaded: ${Object.keys(phaseAssignees).length} plan phases, ` +
      `${Object.keys(infraPhaseAssignees).length} infra phases, ` +
      `${keywordRoutes.length} keyword routes, ` +
      `${skillRoutes.length} skill routes, ` +
      `${validBotIds.length} active bots`,
  );

  return config;
}
