import 'server-only';
import type { KBDomain } from '@team-semicolon/dashboard-ui';
import { kbDb } from './kb-db';

export function scanKbDomains(): KBDomain[] {
  const db = kbDb();
  if (!db) return [];
  try {
    // idx_kb_domain 으로 GROUP BY 커버. 0~수만 rows 범위에서 즉시 반환.
    const rows = db
      .prepare(
        `SELECT domain, COUNT(*) AS entry_count
         FROM knowledge_base
         GROUP BY domain
         ORDER BY domain ASC`,
      )
      .all() as Array<{ domain: string; entry_count: number }>;
    return rows.map((r) => ({ domain: r.domain, entry_count: r.entry_count }));
  } catch (err) {
    console.warn('[kb-scanner] query failed:', (err as Error).message);
    return [];
  }
}
