/**
 * Bot ID Alias Resolution
 *
 * bot_id는 불변(immutable). 표시명 변경은 semo.bot_id_aliases 테이블로 해결한다.
 * 예: 'semiclaw' → 'semobot' 리브랜드 시, alias 행으로 입력 별칭을 canonical로 변환.
 *
 * 라우팅 진입점에서 입력 bot_id를 canonical로 정규화해야 위임/메일박스/FK가 일관성을 유지한다.
 */

import { Pool } from 'pg';

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
       FROM semo.bot_id_aliases
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
