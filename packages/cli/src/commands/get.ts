/**
 * semo get <resource> — 세션 중 실시간 DB 쿼리
 *
 * semo get projects  [--active] [--format table|json|md]
 * semo get bots      [--status online|offline]
 * semo get kb        [--domain <d>] [--key <k>] [--search <text>]
 * semo get ontology  [--domain <d>]
 * semo get sessions  [--bot <n>]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getPool, closeConnection, isDbConnected } from '../database';
import { kbList, kbSearch, ontoList, ontoShow } from '../kb';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

// ============================================================
// Formatters
// ============================================================

function printTable(headers: string[], rows: string[][], title?: string): void {
  if (title) console.log(chalk.cyan.bold(`\n${title}\n`));

  if (rows.length === 0) {
    console.log(chalk.yellow('  결과 없음\n'));
    return;
  }

  // Column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] || '').length)),
  );

  const divider = '  ' + widths.map((w) => '─'.repeat(w + 2)).join('┬');
  const header = '  ' + headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('│');

  console.log(chalk.gray(divider));
  console.log(chalk.gray(header));
  console.log(chalk.gray(divider));

  for (const row of rows) {
    const line = '  ' + row.map((cell, i) => ` ${String(cell || '').padEnd(widths[i])} `).join('│');
    console.log(line);
  }

  console.log(chalk.gray(divider));
  console.log(chalk.gray(`  ${rows.length}행\n`));
}

// ============================================================
// Command registration
// ============================================================

export function registerGetCommands(program: Command): void {
  const getCmd = program.command('get').description('Core DB에서 리소스 실시간 조회');

  // ── semo get projects ───────────────────────────────────────
  getCmd
    .command('projects')
    .description('서비스 인스턴스 목록 조회 (온톨로지 기반)')
    .option('--active', "활성 서비스만 (status='active')")
    .option('--format <type>', '출력 형식 (table|json|md)', 'table')
    .action(async (options) => {
      const spinner = ora('서비스 인스턴스 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        // Query service instances from ontology + their status from KB
        const result = await client.query(`
          SELECT o.domain, o.description,
                 ks.content as status,
                 (SELECT COUNT(*)::int FROM ${DB_SCHEMA}.knowledge_base k WHERE k.domain = o.domain) as entry_count,
                 (SELECT k2.content FROM ${DB_SCHEMA}.knowledge_base k2 WHERE k2.domain = o.domain AND k2.key = 'po' LIMIT 1) as po
          FROM ${DB_SCHEMA}.ontology o
          LEFT JOIN ${DB_SCHEMA}.knowledge_base ks ON ks.domain = o.domain AND ks.key = 'status'
          WHERE o.entity_type = 'service'
          ORDER BY o.domain
        `);
        client.release();

        let rows = result.rows;
        if (options.active) {
          rows = rows.filter((r: Record<string, string>) => r.status === 'active');
        }

        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(rows, null, 2));
        } else if (options.format === 'md') {
          for (const r of rows) {
            console.log(`\n## ${r.domain}\n`);
            console.log(`상태: ${r.status || '-'} | 담당: ${r.po || '-'}`);
            if (r.description) console.log(r.description);
          }
        } else {
          printTable(
            ['service', 'status', 'po', 'entries', 'description'],
            rows.map((r: Record<string, string>) => [
              r.domain,
              r.status || '-',
              r.po || '-',
              String(r.entry_count || 0),
              (r.description || '').substring(0, 40),
            ]),
            '📁 서비스 인스턴스',
          );
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo get bots ───────────────────────────────────────────
  getCmd
    .command('bots')
    .description('봇 상태 조회')
    .option('--status <filter>', '상태 필터 (online|offline)')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('봇 상태 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, name, emoji, role, status,
                 last_active::text, session_count, synced_at::text
          FROM ${DB_SCHEMA}.bot_status
        `;
        const params: string[] = [];
        if (options.status) {
          query += ' WHERE status = $1';
          params.push(options.status);
        }
        query += ' ORDER BY bot_id';

        const result = await client.query(query, params);
        client.release();
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          printTable(
            ['bot_id', '이름', 'status', 'last_active', 'sessions'],
            result.rows.map((r: Record<string, string>) => [
              r.bot_id,
              [r.emoji, r.name].filter(Boolean).join(' ') || r.bot_id,
              r.status || '-',
              r.last_active ? new Date(r.last_active).toLocaleString('ko-KR') : '-',
              String(r.session_count || 0),
            ]),
            '🤖 봇 상태',
          );
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo get kb ─────────────────────────────────────────────
  getCmd
    .command('kb')
    .description('Knowledge Base 조회')
    .option('--domain <name>', '도메인 필터')
    .option('--key <name>', '키 검색')
    .option('--search <text>', '하이브리드 검색')
    .option('--limit <n>', '최대 결과 수', '20')
    .option('--format <type>', '출력 형식 (table|json|md)', 'table')
    .action(async (options) => {
      const spinner = ora('KB 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      const pool = getPool();

      try {
        let entries: Record<string, string>[] = [];
        const limit = parseInt(options.limit);

        if (options.search) {
          const results = await kbSearch(pool, options.search, {
            domain: options.domain,
            limit,
          });
          entries = results as unknown as Record<string, string>[];
        } else if (options.key) {
          const client = await pool.connect();
          const result = await client.query(
            `SELECT domain, key, content, metadata, updated_at::text
             FROM ${DB_SCHEMA}.knowledge_base
             WHERE key ILIKE $1${options.domain ? ' AND domain = $2' : ''}
             ORDER BY domain, key LIMIT $${options.domain ? 3 : 2}`,
            options.domain
              ? [`%${options.key}%`, options.domain, limit]
              : [`%${options.key}%`, limit],
          );
          client.release();
          entries = result.rows;
        } else {
          const kbEntries = await kbList(pool, {
            domain: options.domain,
            limit,
          });
          entries = kbEntries as unknown as Record<string, string>[];
        }

        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(entries, null, 2));
        } else if (options.format === 'md') {
          for (const e of entries) {
            console.log(`\n## ${e['domain']}/${e['key']}\n`);
            console.log(e['content']);
          }
        } else {
          printTable(
            ['domain', 'key', 'content'],
            entries.map((e) => [
              e['domain'] || '',
              e['key'] || '',
              (e['content'] || '').substring(0, 60),
            ]),
            '📚 Knowledge Base',
          );
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo get ontology ───────────────────────────────────────
  getCmd
    .command('ontology')
    .description('온톨로지 도메인 조회')
    .option('--domain <name>', '특정 도메인 상세')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('온톨로지 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      const pool = getPool();

      try {
        if (options.domain) {
          const onto = await ontoShow(pool, options.domain);
          spinner.stop();

          if (!onto) {
            console.log(chalk.red(`\n  온톨로지 '${options.domain}'을 찾을 수 없습니다.\n`));
          } else if (options.format === 'json') {
            console.log(JSON.stringify(onto, null, 2));
          } else {
            console.log(chalk.cyan.bold(`\n📐 ${onto.domain} (v${onto.version})\n`));
            if (onto.description) console.log(chalk.gray(`  ${onto.description}\n`));
            console.log(
              JSON.stringify(onto.schema, null, 2)
                .split('\n')
                .map((l) => '  ' + l)
                .join('\n'),
            );
            console.log();
          }
        } else {
          const domains = await ontoList(pool);
          spinner.stop();

          if (options.format === 'json') {
            console.log(JSON.stringify(domains, null, 2));
          } else {
            printTable(
              ['domain', 'version', 'description'],
              domains.map((d) => [d.domain, String(d.version), d.description || '-']),
              '📐 온톨로지 도메인',
            );
          }
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo get sessions ───────────────────────────────────────
  getCmd
    .command('sessions')
    .description(`봇 세션 조회 (${DB_SCHEMA}.bot_sessions)`)
    .option('--bot <name>', '봇 ID 필터')
    .option('--limit <n>', '최대 결과 수', '10')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const spinner = ora('세션 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, session_key, label, kind, chat_type,
                 last_activity::text, message_count
          FROM ${DB_SCHEMA}.bot_sessions
        `;
        const params: (string | number)[] = [];
        let idx = 1;

        if (options.bot) {
          query += ` WHERE bot_id = $${idx++}`;
          params.push(options.bot);
        }
        query += ` ORDER BY last_activity DESC NULLS LAST LIMIT $${idx++}`;
        params.push(parseInt(options.limit));

        let rows: Record<string, string>[] = [];
        try {
          const result = await client.query(query, params);
          rows = result.rows;
        } catch {
          client.release();
          spinner.warn(`${DB_SCHEMA}.bot_sessions 테이블이 없거나 접근 불가`);
          await closeConnection();
          return;
        }
        client.release();
        spinner.stop();

        if (options.format === 'json') {
          console.log(JSON.stringify(rows, null, 2));
        } else {
          printTable(
            ['bot_id', 'session_key', 'label', 'last_activity', 'msgs'],
            rows.map((r) => [
              r.bot_id,
              r.session_key || '-',
              r.label || '-',
              r.last_activity ? new Date(r.last_activity).toLocaleString('ko-KR') : '-',
              String(r.message_count || 0),
            ]),
            '📋 봇 세션',
          );
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
