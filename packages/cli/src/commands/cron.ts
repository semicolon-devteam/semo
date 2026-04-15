/**
 * semo cron — 크론잡 관리 (DB-first)
 *
 * semo.bot_cron_jobs 테이블이 SoT. 파일 의존 없이 DB 직접 CRUD.
 *
 * Subcommands:
 *   semo cron list            — DB 크론잡 목록 + deploy_status
 *   semo cron create          — 새 크론잡 등록
 *   semo cron update          — 기존 크론잡 수정
 *   semo cron delete          — 크론잡 삭제
 *   semo cron enable/disable  — 활성/비활성 토글
 *   semo cron export          — RemoteTrigger 등록용 JSON 출력
 *   semo cron mark-deployed   — trigger_id를 DB에 기록
 *   semo cron import          — 파일에서 일괄 임포트 (one-time migration)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { getPool, closeConnection } from '../database';
import { resolveBotWorkspace } from '../paths';

// ============================================================
// Types
// ============================================================

interface CronJobRow {
  bot_id: string;
  job_id: string;
  name: string;
  schedule: Record<string, unknown>;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  session_target: string | null;
  payload: Record<string, unknown> | null;
  trigger_id: string | null;
  deploy_status: string | null;
  last_deploy_at: string | null;
}

interface TriggerExport {
  jobId: string;
  botId: string;
  name: string;
  schedule: string;
  prompt: string;
}

// ============================================================
// Schedule translation
// ============================================================

function translateSchedule(schedule: Record<string, unknown>): string | null {
  if (schedule.kind === 'cron' && typeof schedule.expr === 'string') {
    return schedule.expr;
  }
  if (schedule.kind === 'every' && typeof schedule.everyMs === 'number') {
    const minutes = Math.round(schedule.everyMs / 60000);
    if (minutes <= 0) return null;
    if (minutes < 60) return `*/${minutes} * * * *`;
    const hours = Math.round(minutes / 60);
    return `0 */${hours} * * *`;
  }
  return null;
}

// ============================================================
// Prompt builder
// ============================================================

const WORK_DIR = '/Users/reus/Desktop/Sources/semicolon/projects/semo';

function buildTriggerPrompt(botId: string, job: CronJobRow): string {
  const message = (job.payload as Record<string, unknown> | null)?.message ?? job.name;

  const lines: string[] = [
    `You are operating as ${botId} agent.`,
    `Working directory: ${WORK_DIR}`,
    ``,
    `Task: ${message}`,
    ``,
    `After completion, record results via semo kb upsert if applicable.`,
  ];

  return lines.join('\n');
}

// ============================================================
// Subcommands
// ============================================================

async function cronList(opts: { bot?: string; enabledOnly?: boolean; format?: string }) {
  const spinner = ora('크론잡 조회 중...').start();
  const pool = getPool();

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.bot) {
      params.push(opts.bot);
      conditions.push(`bot_id = $${params.length}`);
    }
    if (opts.enabledOnly) {
      conditions.push('enabled = true');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query<CronJobRow>(
      `SELECT bot_id, job_id, name, schedule, enabled, last_run, next_run,
              session_target, payload, trigger_id, deploy_status, last_deploy_at
       FROM semo.bot_cron_jobs ${where}
       ORDER BY bot_id, name`,
      params,
    );

    spinner.stop();

    if (opts.format === 'json') {
      console.log(JSON.stringify(result.rows, null, 2));
      return;
    }

    // Table format
    const rows = result.rows;
    if (rows.length === 0) {
      console.log(chalk.yellow('크론잡이 없습니다.'));
      return;
    }

    console.log(chalk.bold(`\n크론잡 목록 (${rows.length}개)\n`));
    console.log(
      chalk.gray(
        'BOT'.padEnd(14) +
          'NAME'.padEnd(35) +
          'SCHEDULE'.padEnd(22) +
          'ENABLED'.padEnd(9) +
          'DEPLOY'.padEnd(12) +
          'LAST_RUN',
      ),
    );
    console.log(chalk.gray('─'.repeat(105)));

    for (const row of rows) {
      const sched = translateSchedule(row.schedule) ?? '?';
      const enabled = row.enabled ? chalk.green('✓') : chalk.red('✗');
      const deploy =
        row.deploy_status === 'deployed'
          ? chalk.green('deployed')
          : row.deploy_status === 'failed'
            ? chalk.red('failed')
            : chalk.yellow(row.deploy_status ?? 'pending');
      const lastRun = row.last_run
        ? new Date(row.last_run).toISOString().slice(0, 16)
        : chalk.gray('never');

      console.log(
        row.bot_id.padEnd(14) +
          (row.name ?? '').slice(0, 33).padEnd(35) +
          sched.padEnd(22) +
          (enabled + '').padEnd(13) + // chalk adds invisible chars
          (deploy + '').padEnd(22) +
          lastRun,
      );
    }

    // Summary
    const deployed = rows.filter((r) => r.deploy_status === 'deployed').length;
    const enabled = rows.filter((r) => r.enabled).length;
    console.log(chalk.gray(`\n총 ${rows.length}개 | 활성 ${enabled}개 | 배포됨 ${deployed}개`));
  } catch (err) {
    spinner.fail('크론잡 조회 실패');
    console.error(chalk.red((err as Error).message));
  } finally {
    await closeConnection();
  }
}

async function cronExport(opts: { bot?: string }) {
  const pool = getPool();

  try {
    const conditions = ['enabled = true'];
    const params: unknown[] = [];

    if (opts.bot) {
      params.push(opts.bot);
      conditions.push(`bot_id = $${params.length}`);
    }

    const result = await pool.query<CronJobRow>(
      `SELECT bot_id, job_id, name, schedule, enabled, payload, trigger_id, deploy_status
       FROM semo.bot_cron_jobs
       WHERE ${conditions.join(' AND ')}
       ORDER BY bot_id, name`,
      params,
    );

    const exports: TriggerExport[] = [];
    const skipped: string[] = [];

    for (const row of result.rows) {
      const sched = translateSchedule(row.schedule);
      if (!sched) {
        skipped.push(`${row.bot_id}/${row.name}: unsupported schedule`);
        continue;
      }

      exports.push({
        jobId: row.job_id,
        botId: row.bot_id,
        name: row.name,
        schedule: sched,
        prompt: buildTriggerPrompt(row.bot_id, row),
      });
    }

    console.log(JSON.stringify(exports, null, 2));

    if (skipped.length > 0) {
      console.error(chalk.yellow(`\n⚠ 스킵됨 (${skipped.length}개):`));
      for (const s of skipped) {
        console.error(chalk.yellow(`  - ${s}`));
      }
    }
  } catch (err) {
    console.error(chalk.red((err as Error).message));
  } finally {
    await closeConnection();
  }
}

async function cronMarkDeployed(opts: { jobId: string; triggerId: string }) {
  const spinner = ora('deploy_status 업데이트 중...').start();
  const pool = getPool();

  try {
    const result = await pool.query(
      `UPDATE semo.bot_cron_jobs
       SET trigger_id = $1, deploy_status = 'deployed', last_deploy_at = NOW()
       WHERE job_id = $2
       RETURNING bot_id, name`,
      [opts.triggerId, opts.jobId],
    );

    if (result.rowCount === 0) {
      spinner.fail(`job_id '${opts.jobId}' 없음`);
    } else {
      const row = result.rows[0] as { bot_id: string; name: string };
      spinner.succeed(`${row.bot_id}/${row.name} → trigger_id=${opts.triggerId}`);
    }
  } catch (err) {
    spinner.fail('업데이트 실패');
    console.error(chalk.red((err as Error).message));
  } finally {
    await closeConnection();
  }
}

// ============================================================
// CRUD
// ============================================================

async function cronCreate(opts: {
  bot: string;
  name: string;
  schedule: string;
  payload?: string;
  sessionTarget?: string;
  disabled?: boolean;
}) {
  const spinner = ora('크론잡 생성 중...').start();
  const pool = getPool();

  try {
    const jobId = crypto.randomUUID();
    const schedule = parseScheduleArg(opts.schedule);
    if (!schedule) {
      spinner.fail(`잘못된 스케줄 형식: ${opts.schedule}. 예: "cron:0 9 * * *" 또는 "every:30m"`);
      return;
    }

    const payload = opts.payload ? { kind: 'agentTurn', message: opts.payload } : null;

    const result = await pool.query(
      `INSERT INTO semo.bot_cron_jobs
         (bot_id, job_id, name, schedule, enabled, session_target, payload, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING job_id`,
      [
        opts.bot,
        jobId,
        opts.name,
        JSON.stringify(schedule),
        !opts.disabled,
        opts.sessionTarget ?? 'isolated',
        payload ? JSON.stringify(payload) : null,
      ],
    );

    spinner.succeed(`크론잡 생성 완료: ${opts.bot}/${opts.name} (${jobId.slice(0, 8)}...)`);
    console.log(chalk.gray(`  schedule: ${opts.schedule}`));
    console.log(chalk.gray(`  job_id: ${result.rows[0].job_id}`));
  } catch (err) {
    spinner.fail('크론잡 생성 실패');
    console.error(chalk.red((err as Error).message));
  } finally {
    await closeConnection();
  }
}

async function cronUpdate(opts: {
  jobId: string;
  name?: string;
  schedule?: string;
  payload?: string;
  sessionTarget?: string;
}) {
  const spinner = ora('크론잡 수정 중...').start();
  const pool = getPool();

  try {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (opts.name) {
      sets.push(`name = $${idx++}`);
      params.push(opts.name);
    }
    if (opts.schedule) {
      const schedule = parseScheduleArg(opts.schedule);
      if (!schedule) {
        spinner.fail(`잘못된 스케줄 형식: ${opts.schedule}`);
        return;
      }
      sets.push(`schedule = $${idx++}`);
      params.push(JSON.stringify(schedule));
    }
    if (opts.payload) {
      sets.push(`payload = $${idx++}`);
      params.push(JSON.stringify({ kind: 'agentTurn', message: opts.payload }));
    }
    if (opts.sessionTarget) {
      sets.push(`session_target = $${idx++}`);
      params.push(opts.sessionTarget);
    }

    if (sets.length === 0) {
      spinner.fail(
        '수정할 항목이 없습니다. --name, --schedule, --payload, --session-target 중 하나 이상 필요.',
      );
      return;
    }

    sets.push(`synced_at = NOW()`);
    // Reset deploy status when job config changes
    sets.push(`deploy_status = 'pending'`);
    params.push(opts.jobId);

    const result = await pool.query(
      `UPDATE semo.bot_cron_jobs SET ${sets.join(', ')} WHERE job_id = $${idx} RETURNING bot_id, name`,
      params,
    );

    if (result.rowCount === 0) {
      spinner.fail(`job_id '${opts.jobId}' 없음`);
    } else {
      const row = result.rows[0] as { bot_id: string; name: string };
      spinner.succeed(`크론잡 수정 완료: ${row.bot_id}/${row.name}`);
    }
  } catch (err) {
    spinner.fail('크론잡 수정 실패');
    console.error(chalk.red((err as Error).message));
  } finally {
    await closeConnection();
  }
}

async function cronDelete(opts: { jobId: string }) {
  const spinner = ora('크론잡 삭제 중...').start();
  const pool = getPool();

  try {
    const result = await pool.query(
      `DELETE FROM semo.bot_cron_jobs WHERE job_id = $1 RETURNING bot_id, name`,
      [opts.jobId],
    );

    if (result.rowCount === 0) {
      spinner.fail(`job_id '${opts.jobId}' 없음`);
    } else {
      const row = result.rows[0] as { bot_id: string; name: string };
      spinner.succeed(`크론잡 삭제 완료: ${row.bot_id}/${row.name}`);
    }
  } catch (err) {
    spinner.fail('크론잡 삭제 실패');
    console.error(chalk.red((err as Error).message));
  } finally {
    await closeConnection();
  }
}

async function cronToggle(jobId: string, enabled: boolean) {
  const spinner = ora(`크론잡 ${enabled ? '활성화' : '비활성화'} 중...`).start();
  const pool = getPool();

  try {
    const result = await pool.query(
      `UPDATE semo.bot_cron_jobs SET enabled = $1, synced_at = NOW() WHERE job_id = $2 RETURNING bot_id, name`,
      [enabled, jobId],
    );

    if (result.rowCount === 0) {
      spinner.fail(`job_id '${jobId}' 없음`);
    } else {
      const row = result.rows[0] as { bot_id: string; name: string };
      spinner.succeed(
        `${row.bot_id}/${row.name} → ${enabled ? chalk.green('활성') : chalk.red('비활성')}`,
      );
    }
  } catch (err) {
    spinner.fail('토글 실패');
    console.error(chalk.red((err as Error).message));
  } finally {
    await closeConnection();
  }
}

// ============================================================
// Import from file (one-time migration)
// ============================================================

interface FileJob {
  id?: string;
  jobId?: string;
  name: string;
  schedule: Record<string, unknown>;
  enabled: boolean;
  lastRun?: string | null;
  nextRun?: string | null;
  sessionTarget?: string;
  payload?: Record<string, unknown> | null;
  state?: Record<string, unknown>;
}

async function cronImport(opts: { file: string; bot?: string; dryRun?: boolean }) {
  const spinner = ora('크론잡 파일 읽는 중...').start();

  let filePath = opts.file;
  let botId = opts.bot;

  // Support shorthand: --bot semiclaw → workspace/cron/jobs.json
  if (!fs.existsSync(filePath) && botId) {
    filePath = require('path').join(resolveBotWorkspace(botId), 'cron', 'jobs.json');
  }

  if (!fs.existsSync(filePath)) {
    spinner.fail(`파일 없음: ${filePath}`);
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const jobs: FileJob[] = data.jobs || [];

    if (jobs.length === 0) {
      spinner.warn('파일에 크론잡이 없습니다.');
      return;
    }

    // Infer bot from file path if not provided
    if (!botId) {
      const match =
        filePath.match(/workspaces\/([^/]+)\//) || filePath.match(/\.openclaw-([^/]+)\//);
      botId = match?.[1] ?? 'unknown';
    }

    spinner.text = `${botId}: ${jobs.length}개 잡 처리 중...`;

    if (opts.dryRun) {
      spinner.stop();
      console.log(chalk.cyan(`\n[dry-run] ${botId}: ${jobs.length}개 잡\n`));
      for (const job of jobs) {
        const id = (job.jobId || job.id || '?').slice(0, 8);
        const sched = translateSchedule(job.schedule as Record<string, unknown>) ?? '?';
        const en = job.enabled ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${id}.. ${(job.name || '').padEnd(35)} ${sched.padEnd(20)} ${en}`);
      }
      return;
    }

    const pool = getPool();
    const client = await pool.connect();
    let imported = 0;
    let skipped = 0;

    try {
      for (const job of jobs) {
        const jobId = job.jobId || job.id || crypto.randomUUID();

        // Extract lastRun from state if present
        const lastRun =
          job.lastRun ||
          (job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs as number).toISOString() : null);
        const nextRun =
          job.nextRun ||
          (job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs as number).toISOString() : null);

        const result = await client.query(
          `INSERT INTO semo.bot_cron_jobs
             (bot_id, job_id, name, schedule, enabled, last_run, next_run, session_target, payload, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (bot_id, job_id) DO UPDATE SET
             name = EXCLUDED.name,
             schedule = EXCLUDED.schedule,
             enabled = EXCLUDED.enabled,
             last_run = COALESCE(EXCLUDED.last_run, semo.bot_cron_jobs.last_run),
             next_run = COALESCE(EXCLUDED.next_run, semo.bot_cron_jobs.next_run),
             session_target = EXCLUDED.session_target,
             payload = EXCLUDED.payload,
             synced_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [
            botId,
            jobId,
            job.name || '',
            JSON.stringify(job.schedule),
            job.enabled !== false,
            lastRun,
            nextRun,
            job.sessionTarget || 'isolated',
            job.payload ? JSON.stringify(job.payload) : null,
          ],
        );

        if ((result.rows[0] as { inserted: boolean }).inserted) {
          imported++;
        } else {
          skipped++;
        }
      }

      spinner.succeed(`${botId}: ${imported}개 신규, ${skipped}개 업데이트 (총 ${jobs.length}개)`);
    } finally {
      client.release();
      await closeConnection();
    }
  } catch (err) {
    spinner.fail('임포트 실패');
    console.error(chalk.red((err as Error).message));
  }
}

// ============================================================
// Schedule argument parser ("cron:0 9 * * *" or "every:30m")
// ============================================================

function parseScheduleArg(arg: string): Record<string, unknown> | null {
  if (arg.startsWith('cron:')) {
    const expr = arg.slice(5).trim();
    if (!expr) return null;
    return { kind: 'cron', expr };
  }
  if (arg.startsWith('every:')) {
    const val = arg.slice(6).trim();
    const match = val.match(/^(\d+)(s|m|h)$/);
    if (!match) return null;
    const num = parseInt(match[1], 10);
    const unit = match[2];
    const ms = unit === 's' ? num * 1000 : unit === 'm' ? num * 60000 : num * 3600000;
    return { kind: 'every', everyMs: ms };
  }
  // Try as raw cron expression
  if (arg.split(/\s+/).length >= 5) {
    return { kind: 'cron', expr: arg };
  }
  return null;
}

// ============================================================
// Register
// ============================================================

export function registerCronCommands(program: Command): void {
  const cron = program.command('cron').description('크론잡 관리 (DB-first)');

  cron
    .command('list')
    .description('DB 크론잡 목록 조회')
    .option('--bot <name>', '봇 ID 필터')
    .option('--enabled-only', '활성 잡만 표시')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (opts) => {
      await cronList({
        bot: opts.bot,
        enabledOnly: opts.enabledOnly,
        format: opts.format,
      });
    });

  // ── create ──
  cron
    .command('create')
    .description('새 크론잡 등록')
    .requiredOption('--bot <id>', '봇 ID (예: semiclaw)')
    .requiredOption('--name <name>', '잡 이름')
    .requiredOption('--schedule <expr>', "스케줄 (예: 'cron:0 9 * * *' 또는 'every:30m')")
    .option('--payload <message>', '실행 시 전달할 메시지/프롬프트')
    .option('--session-target <target>', '세션 타겟 (main|isolated)', 'isolated')
    .option('--disabled', '비활성 상태로 생성')
    .action(async (opts) => {
      await cronCreate({
        bot: opts.bot,
        name: opts.name,
        schedule: opts.schedule,
        payload: opts.payload,
        sessionTarget: opts.sessionTarget,
        disabled: opts.disabled,
      });
    });

  // ── update ──
  cron
    .command('update')
    .description('기존 크론잡 수정')
    .requiredOption('--job-id <uuid>', '크론잡 ID')
    .option('--name <name>', '잡 이름')
    .option('--schedule <expr>', '스케줄')
    .option('--payload <message>', '실행 메시지')
    .option('--session-target <target>', '세션 타겟')
    .action(async (opts) => {
      await cronUpdate({
        jobId: opts.jobId,
        name: opts.name,
        schedule: opts.schedule,
        payload: opts.payload,
        sessionTarget: opts.sessionTarget,
      });
    });

  // ── delete ──
  cron
    .command('delete')
    .description('크론잡 삭제')
    .requiredOption('--job-id <uuid>', '크론잡 ID')
    .action(async (opts) => {
      await cronDelete({ jobId: opts.jobId });
    });

  // ── enable / disable ──
  cron
    .command('enable')
    .description('크론잡 활성화')
    .argument('<jobId>', '크론잡 ID')
    .action(async (jobId: string) => {
      await cronToggle(jobId, true);
    });

  cron
    .command('disable')
    .description('크론잡 비활성화')
    .argument('<jobId>', '크론잡 ID')
    .action(async (jobId: string) => {
      await cronToggle(jobId, false);
    });

  // ── import ──
  cron
    .command('import')
    .description('파일에서 크론잡 일괄 임포트 (one-time migration)')
    .argument('<file>', 'jobs.json 파일 경로')
    .option('--bot <id>', '봇 ID (파일 경로에서 추론 안 될 때)')
    .option('--dry-run', '실제 임포트 없이 미리보기')
    .action(async (file: string, opts) => {
      await cronImport({ file, bot: opts.bot, dryRun: opts.dryRun });
    });

  // ── export ──
  cron
    .command('export')
    .description('활성 크론잡을 RemoteTrigger 등록용 JSON으로 출력')
    .option('--bot <name>', '봇 ID 필터')
    .action(async (opts) => {
      await cronExport({ bot: opts.bot });
    });

  cron
    .command('mark-deployed')
    .description('트리거 등록 후 trigger_id를 DB에 기록')
    .requiredOption('--job-id <uuid>', '크론잡 ID')
    .requiredOption('--trigger-id <id>', 'RemoteTrigger ID')
    .action(async (opts) => {
      await cronMarkDeployed({
        jobId: opts.jobId,
        triggerId: opts.triggerId,
      });
    });
}
