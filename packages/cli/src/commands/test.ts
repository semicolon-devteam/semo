/**
 * semo test — 테스트 관리
 *
 * semo test list               — 등록된 스위트 + 최근 실행 상태
 * semo test run [suite]        — 스위트 실행 + DB 기록
 * semo test run --all          — 전체 스위트 실행
 * semo test run --notify       — 실패 시 Slack 알림
 * semo test history [suite]    — 실행 이력
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as os from 'os';
import type { Pool } from 'pg';
import { getPool, closeConnection } from '../database';
import { sendSlackNotification, formatTestFailureMessage } from '../slack-notify';
import {
  runDeclarativeWorkspaceAudit,
  TestOutputLine as DeclarativeOutput,
} from '../test-runners/workspace-audit';

// ============================================================
// Types
// ============================================================

interface TestSuite {
  suite_id: string;
  name: string;
  layer: string;
  runner_type: string;
  runner_path: string | null;
  schedule: string | null;
  enabled: boolean;
  rule_source: string | null;
}

interface TestRunSummary {
  suite_id: string;
  name: string;
  layer: string;
  runner_type: string;
  enabled: boolean;
  last_status: string | null;
  last_run_at: string | null;
  last_pass: number | null;
  last_fail: number | null;
  last_warn: number | null;
}

interface TestOutputLine {
  type: 'case' | 'summary';
  id?: string;
  status?: 'pass' | 'fail' | 'warn' | 'skip';
  label?: string;
  detail?: string;
  duration_ms?: number;
  pass?: number;
  fail?: number;
  warn?: number;
}

interface RunResult {
  runId: string;
  suiteId: string;
  status: 'passed' | 'failed' | 'error';
  pass: number;
  fail: number;
  warn: number;
  failedLabels: string[];
}

// ============================================================
// JSONL Parser
// ============================================================

function parseTestOutputLine(line: string): TestOutputLine | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('{')) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj.type === 'case' || obj.type === 'summary') return obj;
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Runner Path Resolution
// ============================================================

function resolveRunnerPath(runnerPath: string): string {
  // Expand ~ to HOME
  if (runnerPath.startsWith('~/')) {
    return path.join(os.homedir(), runnerPath.slice(2));
  }
  // Relative path → resolve from project root (cwd)
  if (!path.isAbsolute(runnerPath)) {
    return path.resolve(process.cwd(), runnerPath);
  }
  return runnerPath;
}

// ============================================================
// Test Suite Execution
// ============================================================

async function executeTestSuite(suite: TestSuite, triggeredBy: string): Promise<RunResult> {
  const pool = getPool();
  const runId = randomUUID();
  const startedAt = new Date();

  // Create run record
  await pool.query(
    `INSERT INTO semo.test_runs (run_id, suite_id, triggered_by, started_at, status)
     VALUES ($1, $2, $3, $4, 'running')`,
    [runId, suite.suite_id, triggeredBy, startedAt.toISOString()],
  );

  // ── Declarative runner: DB에서 규칙 로드 → 동적 TC 생성 ──
  if (suite.runner_type === 'declarative') {
    return executeDeclarativeSuite(pool, suite, runId);
  }

  // ── Script runner: 외부 프로세스 spawn ──
  const resolvedPath = resolveRunnerPath(suite.runner_path || '');
  const cases: TestOutputLine[] = [];
  let pass = 0;
  let fail = 0;
  let warn = 0;
  const failedLabels: string[] = [];

  return new Promise<RunResult>((resolve) => {
    let cmd: string;
    let args: string[];
    let env: NodeJS.ProcessEnv;

    if (suite.runner_type === 'shell') {
      cmd = 'bash';
      args = [resolvedPath];
      env = { ...process.env, OUTPUT_FORMAT: 'json' };
    } else {
      cmd = 'npx';
      args = ['tsx', resolvedPath, '--json'];
      env = { ...process.env };
    }

    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let buffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete last line

      for (const line of lines) {
        const parsed = parseTestOutputLine(line);
        if (!parsed) continue;

        if (parsed.type === 'case') {
          cases.push(parsed);
          if (parsed.status === 'pass') pass++;
          else if (parsed.status === 'fail') {
            fail++;
            if (parsed.label) failedLabels.push(parsed.label);
          } else if (parsed.status === 'warn') warn++;
        } else if (parsed.type === 'summary') {
          // Use summary counts as authoritative if provided
          if (typeof parsed.pass === 'number') pass = parsed.pass;
          if (typeof parsed.fail === 'number') fail = parsed.fail;
          if (typeof parsed.warn === 'number') warn = parsed.warn;
        }
      }
    });

    child.stderr.on('data', () => {
      /* discard stderr */
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
    }, 600000); // 10 minute timeout

    child.on('close', async (code) => {
      clearTimeout(timeout);

      // Process remaining buffer
      if (buffer.trim()) {
        const parsed = parseTestOutputLine(buffer);
        if (parsed?.type === 'case') {
          cases.push(parsed);
          if (parsed.status === 'pass') pass++;
          else if (parsed.status === 'fail') {
            fail++;
            if (parsed.label) failedLabels.push(parsed.label);
          } else if (parsed.status === 'warn') warn++;
        } else if (parsed?.type === 'summary') {
          if (typeof parsed.pass === 'number') pass = parsed.pass;
          if (typeof parsed.fail === 'number') fail = parsed.fail;
          if (typeof parsed.warn === 'number') warn = parsed.warn;
        }
      }

      const status = code !== 0 || fail > 0 ? 'failed' : cases.length === 0 ? 'error' : 'passed';
      const summary = `${pass} passed, ${fail} failed, ${warn} warn`;

      try {
        // Insert individual results
        for (const c of cases) {
          if (c.type !== 'case') continue;
          await pool.query(
            `INSERT INTO semo.test_results (run_id, case_id, suite_id, label, status, detail, duration_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              runId,
              c.id || c.label || 'unknown',
              suite.suite_id,
              c.label || c.id || 'unknown',
              c.status || 'skip',
              c.detail || null,
              c.duration_ms || null,
            ],
          );
        }

        // Update run record
        await pool.query(
          `UPDATE semo.test_runs
           SET finished_at = NOW(), total_pass = $1, total_fail = $2, total_warn = $3,
               status = $4, summary = $5
           WHERE run_id = $6`,
          [pass, fail, warn, status, summary, runId],
        );
      } catch (err: any) {
        console.error(chalk.red(`  DB 기록 오류: ${err.message}`));
      }

      resolve({ runId, suiteId: suite.suite_id, status, pass, fail, warn, failedLabels });
    });
  });
}

// ============================================================
// Declarative Runner
// ============================================================

async function executeDeclarativeSuite(
  pool: Pool,
  suite: TestSuite,
  runId: string,
): Promise<RunResult> {
  let outputs: DeclarativeOutput[] = [];

  // Dispatch by rule_source
  if (suite.rule_source === 'bot_workspace_standard') {
    outputs = await runDeclarativeWorkspaceAudit(pool);
  } else {
    return {
      runId,
      suiteId: suite.suite_id,
      status: 'error',
      pass: 0,
      fail: 0,
      warn: 0,
      failedLabels: [`unknown rule_source: ${suite.rule_source}`],
    };
  }

  let pass = 0;
  let fail = 0;
  let warn = 0;
  const failedLabels: string[] = [];

  for (const o of outputs) {
    if (o.type === 'summary') {
      pass = (o as any).pass ?? pass;
      fail = (o as any).fail ?? fail;
      warn = (o as any).warn ?? warn;
      continue;
    }
    if (o.type !== 'case') continue;

    // Record to DB
    await pool.query(
      `INSERT INTO semo.test_results (run_id, case_id, suite_id, label, status, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        runId,
        o.id || o.label || 'unknown',
        suite.suite_id,
        o.label || o.id || 'unknown',
        o.status || 'skip',
        o.detail || null,
      ],
    );

    if (o.status === 'fail') failedLabels.push(o.label || '');
  }

  const status = fail > 0 ? 'failed' : 'passed';
  const summary = `${pass} passed, ${fail} failed, ${warn} warn`;

  await pool.query(
    `UPDATE semo.test_runs
     SET finished_at = NOW(), total_pass = $1, total_fail = $2, total_warn = $3,
         status = $4, summary = $5
     WHERE run_id = $6`,
    [pass, fail, warn, status, summary, runId],
  );

  return { runId, suiteId: suite.suite_id, status, pass, fail, warn, failedLabels };
}

// ============================================================
// Commands
// ============================================================

export function registerTestCommands(program: Command): void {
  const testCmd = program.command('test').description('테스트 관리 — 실행, 이력 조회');

  // ── semo test list ──
  testCmd
    .command('list')
    .description('등록된 테스트 스위트 목록 + 최근 실행 상태')
    .action(async () => {
      const pool = getPool();
      try {
        const { rows } = await pool.query<TestRunSummary>(`
          SELECT s.suite_id, s.name, s.layer, s.runner_type, s.enabled,
                 r.status AS last_status,
                 r.started_at::text AS last_run_at,
                 r.total_pass AS last_pass,
                 r.total_fail AS last_fail,
                 r.total_warn AS last_warn
          FROM semo.test_suites s
          LEFT JOIN LATERAL (
            SELECT * FROM semo.test_runs
            WHERE suite_id = s.suite_id
            ORDER BY started_at DESC LIMIT 1
          ) r ON true
          ORDER BY s.suite_id
        `);

        if (rows.length === 0) {
          console.log(chalk.yellow('등록된 테스트 스위트가 없습니다.'));
          return;
        }

        console.log(chalk.bold('\n  테스트 스위트 목록\n'));

        // Header
        const hdr =
          padR('Suite ID', 22) +
          padR('Layer', 14) +
          padR('Runner', 8) +
          padR('Last Run', 22) +
          padR('Status', 10) +
          'Result';
        console.log(chalk.gray(`  ${hdr}`));
        console.log(chalk.gray(`  ${'─'.repeat(90)}`));

        for (const row of rows) {
          const statusColor =
            row.last_status === 'passed'
              ? chalk.green
              : row.last_status === 'failed'
                ? chalk.red
                : chalk.gray;

          const lastRun = row.last_run_at ? timeAgo(new Date(row.last_run_at)) : '-';
          const result =
            row.last_pass !== null
              ? `${row.last_pass}/${(row.last_pass || 0) + (row.last_fail || 0) + (row.last_warn || 0)}`
              : '-';

          console.log(
            `  ${padR(row.suite_id, 22)}${padR(row.layer, 14)}${padR(row.runner_type, 8)}${padR(lastRun, 22)}${statusColor(padR(row.last_status || 'no runs', 10))}${result}`,
          );
        }

        console.log();
      } finally {
        await closeConnection();
      }
    });

  // ── semo test run [suite] ──
  testCmd
    .command('run [suite]')
    .description('테스트 스위트 실행 + DB 기록')
    .option('--all', '비활성 포함 전체 실행')
    .option('--notify', '실패 시 Slack 알림')
    .option('--triggered-by <who>', '트리거 주체', 'manual')
    .action(async (suiteArg: string | undefined, options: any) => {
      const pool = getPool();
      try {
        let suites: TestSuite[];

        if (suiteArg) {
          // Single suite
          const { rows } = await pool.query<TestSuite>(
            'SELECT * FROM semo.test_suites WHERE suite_id = $1',
            [suiteArg],
          );
          if (rows.length === 0) {
            console.error(chalk.red(`스위트 '${suiteArg}'를 찾을 수 없습니다.`));
            const allSuites = await pool.query('SELECT suite_id FROM semo.test_suites');
            console.log(
              chalk.gray(`등록된 스위트: ${allSuites.rows.map((r: any) => r.suite_id).join(', ')}`),
            );
            return;
          }
          suites = rows;
        } else {
          // All suites
          const where = options.all ? '' : 'WHERE enabled = true';
          const { rows } = await pool.query<TestSuite>(
            `SELECT * FROM semo.test_suites ${where} ORDER BY suite_id`,
          );
          suites = rows;
        }

        if (suites.length === 0) {
          console.log(chalk.yellow('실행할 스위트가 없습니다.'));
          return;
        }

        console.log(chalk.bold(`\n  ${suites.length}개 스위트 실행\n`));

        const results: RunResult[] = [];

        for (const suite of suites) {
          const spinner = ora(`${suite.suite_id} (${suite.name})`).start();

          try {
            const result = await executeTestSuite(suite, options.triggeredBy || 'manual');
            results.push(result);

            if (result.status === 'passed') {
              spinner.succeed(
                `${suite.suite_id}: ${chalk.green('PASSED')} (${result.pass}/${result.pass + result.fail + result.warn})`,
              );
            } else if (result.status === 'failed') {
              spinner.fail(
                `${suite.suite_id}: ${chalk.red('FAILED')} (pass: ${result.pass}, fail: ${result.fail}, warn: ${result.warn})`,
              );
            } else {
              spinner.warn(`${suite.suite_id}: ${chalk.yellow('ERROR')} (출력 파싱 실패)`);
            }
          } catch (err: any) {
            spinner.fail(`${suite.suite_id}: ${chalk.red('ERROR')} — ${err.message}`);
            results.push({
              runId: 'error',
              suiteId: suite.suite_id,
              status: 'error',
              pass: 0,
              fail: 0,
              warn: 0,
              failedLabels: [],
            });
          }
        }

        // Summary
        const totalPass = results.reduce((s, r) => s + r.pass, 0);
        const totalFail = results.reduce((s, r) => s + r.fail, 0);
        const totalWarn = results.reduce((s, r) => s + r.warn, 0);
        const allPassed = results.every((r) => r.status === 'passed');

        console.log(
          `\n  ${allPassed ? chalk.green('ALL PASSED') : chalk.red('FAILURES DETECTED')} — ${totalPass} pass, ${totalFail} fail, ${totalWarn} warn\n`,
        );

        // Slack notification
        if (options.notify && !allPassed) {
          const failedResults = results.filter((r) => r.status === 'failed');
          for (const fr of failedResults) {
            const msg = formatTestFailureMessage(
              fr.suiteId,
              fr.runId,
              fr.pass,
              fr.fail,
              fr.warn,
              fr.failedLabels,
            );
            const sent = await sendSlackNotification(msg);
            if (sent) {
              console.log(chalk.gray(`  Slack 알림 전송: ${fr.suiteId}`));
            }
          }
        }
      } finally {
        await closeConnection();
      }
    });

  // ── semo test history [suite] ──
  testCmd
    .command('history [suite]')
    .description('테스트 실행 이력 조회')
    .option('--limit <n>', '최근 N건', '10')
    .action(async (suiteArg: string | undefined, options: any) => {
      const pool = getPool();
      const limit = parseInt(options.limit) || 10;

      try {
        let query: string;
        let params: any[];

        if (suiteArg) {
          query = `
            SELECT r.run_id, r.suite_id, s.name, r.triggered_by,
                   r.started_at::text, r.finished_at::text,
                   r.total_pass, r.total_fail, r.total_warn, r.status, r.summary
            FROM semo.test_runs r
            JOIN semo.test_suites s ON s.suite_id = r.suite_id
            WHERE r.suite_id = $1
            ORDER BY r.started_at DESC
            LIMIT $2
          `;
          params = [suiteArg, limit];
        } else {
          query = `
            SELECT r.run_id, r.suite_id, s.name, r.triggered_by,
                   r.started_at::text, r.finished_at::text,
                   r.total_pass, r.total_fail, r.total_warn, r.status, r.summary
            FROM semo.test_runs r
            JOIN semo.test_suites s ON s.suite_id = r.suite_id
            ORDER BY r.started_at DESC
            LIMIT $1
          `;
          params = [limit];
        }

        const { rows } = await pool.query(query, params);

        if (rows.length === 0) {
          console.log(chalk.yellow('실행 이력이 없습니다.'));
          return;
        }

        console.log(chalk.bold(`\n  실행 이력${suiteArg ? ` — ${suiteArg}` : ''}\n`));

        const hdr =
          padR('Run ID', 10) +
          padR('Suite', 22) +
          padR('Triggered', 10) +
          padR('Started', 22) +
          padR('Status', 10) +
          'Result';
        console.log(chalk.gray(`  ${hdr}`));
        console.log(chalk.gray(`  ${'─'.repeat(90)}`));

        for (const row of rows) {
          const statusColor =
            row.status === 'passed'
              ? chalk.green
              : row.status === 'failed'
                ? chalk.red
                : chalk.yellow;

          const started = row.started_at
            ? new Date(row.started_at).toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-';

          console.log(
            `  ${padR(row.run_id.substring(0, 8), 10)}${padR(row.suite_id, 22)}${padR(row.triggered_by, 10)}${padR(started, 22)}${statusColor(padR(row.status, 10))}${row.summary || '-'}`,
          );
        }

        console.log();
      } finally {
        await closeConnection();
      }
    });
}

// ============================================================
// Helpers
// ============================================================

function padR(s: string, len: number): string {
  if (s.length >= len) return s.substring(0, len);
  return s + ' '.repeat(len - s.length);
}

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
