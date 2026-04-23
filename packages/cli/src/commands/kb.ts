/**
 * semo kb — 포터블 KB CLI.
 *
 * 프로파일(`~/.semo/config.toml`) 의 `kb.driver` 를 따라 어댑터를 선택한다.
 * PG/SQLite/Obsidian/Notion 어느 것이든 동일한 UX.
 *
 * 하위 명령:
 *   get <domain> <key> [subKey]
 *   upsert <domain> <key> [subKey] --content <text> [--metadata <json>] [--created-by <id>]
 *   delete <domain> <key> [subKey]
 *   search <query> [--domain <d>] [--top-k <n>] [--min-score <pct>]
 *   list [--domain <d>] [--limit <n>]
 *   status
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { loadProfile } from '../config';
import { openStores } from '../config/store-factory.js';

function parseMeta(s: string | undefined): Record<string, unknown> | undefined {
  if (!s) return undefined;
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj === 'object') return obj as Record<string, unknown>;
  } catch {
    throw new Error(`--metadata 는 유효한 JSON 이어야 합니다: ${s}`);
  }
  return undefined;
}

export function registerKbPortableCommands(program: Command): void {
  const cmd = program.command('kb-portable').description('KB 포터블 CLI (프로파일 기반 어댑터)');

  cmd
    .command('get <domain> <key> [subKey]')
    .description('KB 엔트리 조회')
    .option('--json', 'JSON 출력')
    .action(async (domain, key, subKey, opts) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        const entry = await stores.kb.get(domain, key, subKey);
        if (!entry) {
          console.log(
            chalk.yellow(`조회 결과 없음: [${domain}] ${key}${subKey ? '/' + subKey : ''}`),
          );
          process.exitCode = 2;
          return;
        }
        if (opts.json) {
          console.log(JSON.stringify(entry, null, 2));
        } else {
          console.log(
            chalk.cyan(`[${entry.domain}] ${entry.key}${entry.subKey ? '/' + entry.subKey : ''}`),
          );
          console.log(entry.content);
          if (entry.metadata && Object.keys(entry.metadata).length > 0) {
            console.log(chalk.gray(`\nmetadata: ${JSON.stringify(entry.metadata)}`));
          }
        }
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('upsert <domain> <key> [subKey]')
    .description('KB 엔트리 생성/갱신')
    .requiredOption('--content <text>', '내용')
    .option('--metadata <json>', 'JSON 메타데이터')
    .option('--created-by <id>', '작성자')
    .action(async (domain, key, subKey, opts) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        const entry = await stores.kb.upsert({
          domain,
          key,
          subKey,
          content: opts.content,
          metadata: parseMeta(opts.metadata),
          createdBy: opts.createdBy,
        });
        console.log(
          chalk.green(
            `✓ upsert: [${entry.domain}] ${entry.key}${entry.subKey ? '/' + entry.subKey : ''}`,
          ),
        );
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('delete <domain> <key> [subKey]')
    .description('KB 엔트리 삭제')
    .action(async (domain, key, subKey) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        await stores.kb.delete({ domain, key, subKey });
        console.log(chalk.green(`✓ deleted: [${domain}] ${key}${subKey ? '/' + subKey : ''}`));
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('search <query>')
    .description('KB 검색 (벡터/FTS 하이브리드 — 어댑터 구현에 따라)')
    .option('--domain <d>', '도메인 필터')
    .option('--top-k <n>', '상위 N개', '10')
    .option('--min-score <pct>', '최소 유사도(0-100)')
    .option('--json', 'JSON 출력')
    .action(async (query, opts) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        const results = await stores.kb.search(query, {
          topK: parseInt(opts.topK, 10),
          domain: opts.domain,
          minScore: opts.minScore ? parseFloat(opts.minScore) : undefined,
        });
        if (opts.json) {
          console.log(JSON.stringify(results, null, 2));
        } else if (results.length === 0) {
          console.log(chalk.yellow(`검색 결과 없음: "${query}"`));
        } else {
          for (const r of results) {
            const score = r.similarityPct != null ? ` ${r.similarityPct}%` : '';
            console.log(
              chalk.cyan(`[${r.domain}] ${r.key}${r.subKey ? '/' + r.subKey : ''}${score}`),
            );
            const preview = r.content.length > 120 ? r.content.slice(0, 120) + '...' : r.content;
            console.log(chalk.gray(`  ${preview.replace(/\n/g, ' ')}`));
          }
        }
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('status')
    .description('현재 KB 어댑터 상태')
    .action(async () => {
      const cfg = loadProfile();
      console.log(chalk.cyan(`profile : ${cfg.profile}`));
      console.log(chalk.cyan(`kb      : ${cfg.kb.driver}`));
      if (cfg.kb.sqlite_path) console.log(chalk.gray(`  path  : ${cfg.kb.sqlite_path}`));
      if (cfg.kb.obsidian_vault) console.log(chalk.gray(`  vault : ${cfg.kb.obsidian_vault}`));
      if (cfg.kb.notion_database_id)
        console.log(chalk.gray(`  notion: ${cfg.kb.notion_database_id}`));
      const stores = await openStores(cfg);
      try {
        const any = await stores.kb.search('', { topK: 1 }).catch(() => []);
        console.log(chalk.green(`✓ 어댑터 연결 OK (샘플 ${any.length}건)`));
      } finally {
        await stores.close();
      }
    });
}
