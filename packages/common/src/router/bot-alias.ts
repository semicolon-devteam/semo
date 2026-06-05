/**
 * Bot ID Alias Resolution
 *
 * bot_id는 불변(immutable). 표시명 변경은 ${DB_SCHEMA}.bot_id_aliases 테이블로 해결한다.
 * 예: 한 봇의 표시명이 바뀌어도 기존 inbox/메일박스/FK 를 유지하기 위해 alias 행을
 * 추가하고 입력 별칭을 canonical 로 변환한다.
 *
 * 라우팅 진입점에서 입력 bot_id를 canonical로 정규화해야 위임/메일박스/FK가 일관성을 유지한다.
 *
 * ⚠️ SemoBot 은 SemiClaw 의 alias/리브랜드가 아니라 *독립 에이전트* 이다
 * (KB: semo decision/semobot-independent-agent-2026-05-06).
 *  - migration 104 (2026-04-23) 가 리브랜드 1단계로 'semiclaw → semobot' alias 를 깔았으나,
 *    2026-05-06 결정으로 분리됨에 따라 migration 118 에서 retired_at 처리됨.
 *  - 두 봇 사이에 새 alias 행을 깔지 말 것 — orchestrator 트래픽이 persona-only SemoBot
 *    으로 흘러가서 inbox 부재로 침묵 실패한다.
 */

import { Pool } from 'pg';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export type BotAliasMap = Map<string, string>;

/**
 * DB에서 활성 alias 집합을 로드한다.
 * retired_at이 설정된 alias는 더 이상 라우팅되지 않음.
 */
export async function loadBotAliases(pool: Pool): Promise<BotAliasMap> {
  const map: BotAliasMap = new Map();
  try {
    const result = await pool.query(
      `SELECT alias, canonical_bot_id
       FROM ${DB_SCHEMA}.bot_id_aliases
       WHERE retired_at IS NULL`,
    );
    for (const row of result.rows) {
      map.set(row.alias, row.canonical_bot_id);
    }
  } catch (err) {
    // alias 테이블이 없는 환경(마이그레이션 104 미적용)에서는 빈 맵 반환
    console.warn('[bot-alias] Failed to load aliases (migration 104?):', err);
  }
  return map;
}

/**
 * 입력된 bot_id 또는 alias를 canonical bot_id로 변환한다.
 * - 입력이 이미 canonical이면 그대로 반환
 * - 입력이 alias면 canonical 반환
 * - 매핑 없으면 원본 반환 (호출자가 validBotIds로 검증)
 */
export function resolveBotId(aliases: BotAliasMap, input: string): string {
  if (!input) return input;
  return aliases.get(input) ?? input;
}
