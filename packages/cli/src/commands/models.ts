import { Command } from 'commander';
import chalk from 'chalk';
import { getPool } from '../database';
import { kbUpsert } from '../kb';

/**
 * `semo models` — 모델 레지스트리(KB `semo models/catalog`) 관리.
 *
 * 하드코딩 제거 이후, 논리명(orchestrator/planner/coder/reviewer 등) 이 런타임에서
 * 실제 모델 ID 로 resolve 되도록 KB 에서 관리한다.
 */
export function registerModelsCommands(parent: Command): void {
  parent
    .command('list')
    .description('현재 등록된 모델 catalog 출력')
    .option('--json', 'JSON 으로 출력')
    .action(async (opts: { json?: boolean }) => {
      const pool = getPool();
      const res = await pool.query(
        `SELECT content FROM semo.knowledge_base WHERE domain = 'semo' AND key = 'models' AND sub_key = 'catalog'`,
      );
      const content = res.rows[0]?.content as string | undefined;
      if (!content) {
        console.log(chalk.yellow('models/catalog 엔트리가 없습니다.'));
        console.log(chalk.gray('초기화: semo models set orchestrator claude-opus-4-7'));
        return;
      }
      const parsed = parseCatalog(content);
      if (opts.json) {
        console.log(JSON.stringify(parsed, null, 2));
        return;
      }
      console.log(chalk.bold('\nModel Catalog (semo models/catalog)'));
      console.log(chalk.gray('─'.repeat(48)));
      for (const [logical, id] of Object.entries(parsed)) {
        console.log(`  ${chalk.cyan(logical.padEnd(16))} → ${chalk.white(id)}`);
      }
      console.log();
    });

  parent
    .command('set <logical> <modelId>')
    .description('논리명에 모델 ID 매핑 (예: semo models set orchestrator claude-opus-4-7)')
    .action(async (logical: string, modelId: string) => {
      const pool = getPool();
      const res = await pool.query(
        `SELECT content FROM semo.knowledge_base WHERE domain = 'semo' AND key = 'models' AND sub_key = 'catalog'`,
      );
      const current = res.rows[0]?.content ? parseCatalog(res.rows[0].content) : {};
      current[logical] = modelId;
      const out = await kbUpsert(pool, {
        domain: 'semo',
        key: 'models',
        sub_key: 'catalog',
        content: JSON.stringify(current, null, 2),
        created_by: process.env.USER ?? 'semo-cli',
      });
      if (!out.success) {
        console.log(chalk.red(`✗ 실패: ${out.error}`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ ${logical} → ${modelId} 저장됨`));
    });

  parent
    .command('unset <logical>')
    .description('논리명 매핑 제거')
    .action(async (logical: string) => {
      const pool = getPool();
      const res = await pool.query(
        `SELECT content FROM semo.knowledge_base WHERE domain = 'semo' AND key = 'models' AND sub_key = 'catalog'`,
      );
      if (!res.rows[0]?.content) {
        console.log(chalk.yellow('catalog 없음 — 제거할 것 없음'));
        return;
      }
      const current = parseCatalog(res.rows[0].content);
      if (!(logical in current)) {
        console.log(chalk.yellow(`${logical} 는 등록돼 있지 않습니다`));
        return;
      }
      delete current[logical];
      const out = await kbUpsert(pool, {
        domain: 'semo',
        key: 'models',
        sub_key: 'catalog',
        content: JSON.stringify(current, null, 2),
        created_by: process.env.USER ?? 'semo-cli',
      });
      if (!out.success) {
        console.log(chalk.red(`✗ 실패: ${out.error}`));
        process.exit(1);
      }
      console.log(chalk.green(`✓ ${logical} 매핑 제거됨`));
    });
}

function parseCatalog(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    const out: Record<string, string> = {};
    for (const line of trimmed.split(/\r?\n/)) {
      const m = line.match(/^\s*[-*]?\s*([a-zA-Z0-9_-]+)\s*[:=]\s*([^\s#]+)/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  }
}
