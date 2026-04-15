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
import cronParser from 'cron-parser';
import { getPool, closeConnection } from '../database';
import { resolveBotWorkspace } from '../paths';

const CRON_TZ = 'Asia/Seoul';
const POLLER_JOB_ID = 'cron-poller-tick';

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

const WORK_DIR = process.env.SEMO_WORK_DIR ?? '/Users/reus/Desktop/Sources/semicolon/projects/semo';
const DEFAULT_REPORT_CHANNEL = '#bot-ops';

function buildTriggerPrompt(botId: string, job: CronJobRow, opts?: { scheduledAt?: Date }): string {
  const payload = (job.payload as Record<string, unknown> | null) ?? {};
  const message =
    (typeof payload.prompt === 'string' && payload.prompt) ||
    (typeof payload.message === 'string' && payload.message) ||
    job.name;
  const reportChannel =
    (typeof payload.report_channel === 'string' && payload.report_channel) ||
    DEFAULT_REPORT_CHANNEL;
  const targetDomain = typeof payload.target_domain === 'string' ? payload.target_domain : null;
  const maxDuration = typeof payload.max_duration === 'number' ? payload.max_duration : null;
  const scheduleExpr = translateSchedule(job.schedule) ?? JSON.stringify(job.schedule);
  const scheduledAt = opts?.scheduledAt ?? new Date();
  const today = scheduledAt.toISOString().slice(0, 10);

  const sections: string[] = [];

  // 1. Identity (inline)
  sections.push(
    `## Identity
You are operating as **${botId}**, a SEMO/Semicolon team agent. Use your bot persona and skills (~/.claude/agents/${botId}/${botId}.md). Do not delegate to or impersonate other bots unless your skill explicitly requires it.`,
  );

  // 2. Environment
  sections.push(
    `## Environment
- working directory: ${WORK_DIR}
- date: ${today}
- branch: dev
- session: ${botId}-cron-local`,
  );

  // 3. KB-First guard
  sections.push(
    `## KB-First (NON-NEGOTIABLE)
Before answering anything about a service, the org, a teammate, or another bot, query KB first via \`semo kb get\` / \`semo kb search\`. If the answer is not in KB, say so explicitly — do NOT invent URLs, owners, or schedules. Use \`semo service get {domain}\` for structured service metadata (status, po, tech-stack, repo, slack-channel).`,
  );

  // 4. Cron trigger context
  const ctxLines = [
    `## Cron Trigger Context`,
    `- job_id: ${job.job_id}`,
    `- job_name: ${job.name}`,
    `- schedule: ${scheduleExpr}`,
    `- scheduled_at: ${scheduledAt.toISOString()}`,
  ];
  if (targetDomain) ctxLines.push(`- target_domain: ${targetDomain}`);
  if (maxDuration) ctxLines.push(`- max_duration_sec: ${maxDuration}`);
  sections.push(ctxLines.join('\n'));

  // 5. Task body
  sections.push(`## Task
${message}`);

  // 6. Report channel fallback
  sections.push(
    `## Report Destination
On completion (success or failure), post a short result summary to Slack channel \`${reportChannel}\`. Format: \`[${job.name}] 결과: ...\` (3 lines max).`,
  );

  // 7. Completion obligation
  sections.push(
    `## Completion Obligation
After your work is done — even on failure or early exit — you MUST run:

\`\`\`
semo cron mark-run \\
  --bot-id ${botId} \\
  --job-id ${job.job_id} \\
  --status <success|failure|timeout|skipped> \\
  --started-at <ISO> \\
  --duration-ms <int> \\
  [--error "..."] [--output-digest "..."]
\`\`\`

This call records a \`bot_commitments\` row with \`source_type='cron'\` and updates the rollup on \`bot_cron_jobs\`. Skipping it leaves the job stuck.`,
  );

  return sections.join('\n\n');
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

// ============================================================
// Next-run computation (cron-parser, Asia/Seoul)
// ============================================================

function computeNextRun(schedule: Record<string, unknown>, from = new Date()): Date | null {
  if (schedule.kind === 'cron' && typeof schedule.expr === 'string') {
    const it = cronParser.parseExpression(schedule.expr, { currentDate: from, tz: CRON_TZ });
    return it.next().toDate();
  }
  if (schedule.kind === 'every' && typeof schedule.everyMs === 'number' && schedule.everyMs > 0) {
    return new Date(from.getTime() + schedule.everyMs);
  }
  throw new Error(`unsupported schedule: ${JSON.stringify(schedule)}`);
}

// ============================================================
// Backfill next_run — 1회성 폭주 방지 유틸
// ============================================================

async function cronBackfillNextRun(opts: { dryRun?: boolean }) {
  const pool = getPool();
  const res = await pool.query<{
    bot_id: string;
    job_id: string;
    name: string;
    schedule: Record<string, unknown>;
  }>(
    `SELECT bot_id, job_id, name, schedule
       FROM semo.bot_cron_jobs
      WHERE enabled = TRUE AND next_run IS NULL`,
  );
  const rows = res.rows;
  console.log(chalk.bold(`\nbackfill 대상: ${rows.length}개 잡\n`));

  const now = new Date();
  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    try {
      const next = computeNextRun(row.schedule, now);
      if (!next) {
        fail++;
        console.log(
          chalk.yellow(`  skip ${row.bot_id}/${row.job_id} — computeNextRun returned null`),
        );
        continue;
      }
      if (opts.dryRun) {
        console.log(`  [dry] ${row.bot_id}/${row.job_id} → ${next.toISOString()}`);
      } else {
        await pool.query(
          `UPDATE semo.bot_cron_jobs SET next_run = $1, synced_at = NOW()
            WHERE bot_id = $2 AND job_id = $3`,
          [next, row.bot_id, row.job_id],
        );
        console.log(chalk.green(`  ✓ ${row.bot_id}/${row.job_id} → ${next.toISOString()}`));
      }
      ok++;
    } catch (e) {
      fail++;
      console.log(chalk.red(`  ✗ ${row.bot_id}/${row.job_id} — ${(e as Error).message}`));
    }
  }
  console.log(chalk.bold(`\n완료: ok=${ok} fail=${fail}${opts.dryRun ? ' (dry-run)' : ''}\n`));
}

// ============================================================
// Tick — poller가 매 분 호출하는 due-job dispatcher
// ============================================================

interface TickOutput {
  bot_id: string;
  job_id: string;
  name: string;
  subagent_type: string;
  started_at: string;
  report_channel: string;
  prompt: string;
}

async function cronTick(opts: { dryRun?: boolean; limit?: number; json?: boolean }) {
  const limit = opts.limit ?? 30;
  const pool = getPool();
  const client = await pool.connect();
  const now = new Date();
  let claimed: CronJobRow[] = [];

  try {
    // Step A — atomic claim (짧은 트랜잭션)
    await client.query('BEGIN');
    const selectRes = await client.query<CronJobRow>(
      `SELECT bot_id, job_id, name, schedule, enabled, last_run, next_run,
              session_target, payload, trigger_id, deploy_status, last_deploy_at
         FROM semo.bot_cron_jobs
        WHERE enabled = TRUE
          AND job_id <> $1
          AND (next_run IS NULL OR next_run <= NOW())
        ORDER BY COALESCE(next_run, TIMESTAMP 'epoch') ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [POLLER_JOB_ID, limit],
    );
    claimed = selectRes.rows;

    if (!opts.dryRun && claimed.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [];
      claimed.forEach((r, i) => {
        values.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
        params.push(r.bot_id, r.job_id);
      });
      await client.query(
        `UPDATE semo.bot_cron_jobs SET last_run = NOW(), synced_at = NOW()
          WHERE (bot_id, job_id) IN (${values.join(',')})`,
        params,
      );
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // Step B — per-row next_run 재계산 (트랜잭션 밖, per-row try-catch)
  if (!opts.dryRun) {
    for (const row of claimed) {
      try {
        const next = computeNextRun(row.schedule, now);
        if (next) {
          await pool.query(
            `UPDATE semo.bot_cron_jobs SET next_run = $1 WHERE bot_id = $2 AND job_id = $3`,
            [next, row.bot_id, row.job_id],
          );
        }
      } catch (e) {
        process.stderr.write(
          `[cron tick] next_run parse fail ${row.bot_id}/${row.job_id}: ${(e as Error).message}\n`,
        );
      }
    }
  }

  // Step C — 출력
  const outputs: TickOutput[] = claimed.map((row) => {
    const payload = (row.payload as Record<string, unknown> | null) ?? {};
    const reportChannel =
      (typeof payload.report_channel === 'string' && payload.report_channel) ||
      DEFAULT_REPORT_CHANNEL;
    return {
      bot_id: row.bot_id,
      job_id: row.job_id,
      name: row.name,
      subagent_type: row.bot_id,
      started_at: now.toISOString(),
      report_channel: reportChannel,
      prompt: buildTriggerPrompt(row.bot_id, row, { scheduledAt: now }),
    };
  });

  if (opts.json) {
    console.log(JSON.stringify(outputs, null, 2));
    return;
  }

  if (outputs.length === 0) {
    console.log(
      chalk.gray(`[cron tick${opts.dryRun ? ' dry' : ''}] no due jobs @ ${now.toISOString()}`),
    );
    return;
  }
  console.log(
    chalk.bold(
      `\n[cron tick${opts.dryRun ? ' dry' : ''}] ${outputs.length} due @ ${now.toISOString()}\n`,
    ),
  );
  for (const o of outputs) {
    console.log(`  ${chalk.cyan(o.bot_id)}/${o.job_id} — ${o.name}`);
  }
  console.log('');
}

// ============================================================
// Mark Run — cron 실행 기록을 bot_commitments(source_type='cron')에 흡수
// ============================================================

type CronRunStatus = 'success' | 'failure' | 'timeout' | 'skipped';

async function cronMarkRun(opts: {
  botId: string;
  jobId: string;
  status: CronRunStatus;
  startedAt: string;
  durationMs: number;
  error?: string;
  outputDigest?: string;
  metadata?: string;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jobRes = await client.query<{ name: string; schedule: Record<string, unknown> }>(
      `SELECT name, schedule FROM semo.bot_cron_jobs
       WHERE bot_id = $1 AND job_id = $2
       FOR UPDATE`,
      [opts.botId, opts.jobId],
    );
    if (jobRes.rowCount === 0) {
      throw new Error(`cron job not found: ${opts.botId}/${opts.jobId}`);
    }
    const job = jobRes.rows[0];
    const scheduleExpr = translateSchedule(job.schedule) ?? JSON.stringify(job.schedule);

    const commitmentId = `cmt-${opts.botId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sessionTag = `${opts.botId}-cron-local`;
    const commitmentStatus =
      opts.status === 'success' || opts.status === 'skipped' ? 'done' : 'failed';

    let userMetadata: Record<string, unknown> = {};
    if (opts.metadata) {
      try {
        userMetadata = JSON.parse(opts.metadata);
      } catch {
        throw new Error('--metadata JSON 파싱 실패');
      }
    }
    const fullMetadata: Record<string, unknown> = {
      ...userMetadata,
      run_status: opts.status,
      duration_ms: opts.durationMs,
    };
    if (opts.error) fullMetadata.error = opts.error;
    if (opts.outputDigest) fullMetadata.output_digest = opts.outputDigest;

    const pipelineContext = {
      job_id: opts.jobId,
      job_name: job.name,
      schedule_expr: scheduleExpr,
      scheduled_at: opts.startedAt,
    };

    const finishedAt = new Date(new Date(opts.startedAt).getTime() + opts.durationMs).toISOString();

    await client.query(
      `INSERT INTO semo.bot_commitments
         (id, bot_id, status, title, description,
          source_type, source_ref,
          assigned_session, session_owner,
          pipeline_context, metadata,
          last_heartbeat_at, completed_at, created_at)
       VALUES ($1, $2, $3, $4, $5,
               'cron', $6,
               $7, $7,
               $8::jsonb, $9::jsonb,
               NOW(), $10::timestamptz, $11::timestamptz)`,
      [
        commitmentId,
        opts.botId,
        commitmentStatus,
        `cron: ${job.name}`,
        `schedule=${scheduleExpr} run_status=${opts.status} duration=${opts.durationMs}ms`,
        `cron:${opts.jobId}`,
        sessionTag,
        JSON.stringify(pipelineContext),
        JSON.stringify(fullMetadata),
        finishedAt,
        opts.startedAt,
      ],
    );

    let consecutiveFailures = 0;
    if (opts.status === 'skipped') {
      const cur = await client.query<{ consecutive_failures: number }>(
        `SELECT consecutive_failures FROM semo.bot_cron_jobs
         WHERE bot_id = $1 AND job_id = $2`,
        [opts.botId, opts.jobId],
      );
      consecutiveFailures = cur.rows[0]?.consecutive_failures ?? 0;
    } else {
      const rollup = await client.query<{ consecutive_failures: number }>(
        `UPDATE semo.bot_cron_jobs
            SET last_run = $1::timestamptz,
                last_status = $2,
                last_error = LEFT($3, 500),
                consecutive_failures = CASE WHEN $2 = 'success' THEN 0 ELSE consecutive_failures + 1 END
          WHERE bot_id = $4 AND job_id = $5
          RETURNING consecutive_failures`,
        [finishedAt, opts.status, opts.error ?? null, opts.botId, opts.jobId],
      );
      consecutiveFailures = rollup.rows[0]?.consecutive_failures ?? 0;
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify({
        commitment_id: commitmentId,
        commitment_status: commitmentStatus,
        run_status: opts.status,
        consecutive_failures: consecutiveFailures,
      }),
    );

    if (consecutiveFailures >= 3) {
      console.error(chalk.red(`warn: consecutive_failures=${consecutiveFailures}`));
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(chalk.red(`❌ mark-run 실패: ${(err as Error).message}`));
    process.exitCode = 1;
  } finally {
    client.release();
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
  reportChannel?: string;
  targetDomain?: string;
  maxDuration?: number;
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

    const payload: Record<string, unknown> | null =
      opts.payload || opts.reportChannel || opts.targetDomain || opts.maxDuration != null
        ? { kind: 'agentTurn' }
        : null;
    if (payload) {
      if (opts.payload) payload.message = opts.payload;
      if (opts.reportChannel) payload.report_channel = opts.reportChannel;
      if (opts.targetDomain) payload.target_domain = opts.targetDomain;
      if (opts.maxDuration != null) payload.max_duration = opts.maxDuration;
    }

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
      const match = filePath.match(/workspaces\/([^/]+)\//);
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
    .option('--report-channel <channel>', '결과 보고 Slack 채널 (기본: #bot-ops)')
    .option('--target-domain <domain>', 'ontology 대상 도메인 (예: axoracle, semo)')
    .option('--max-duration <sec>', '최대 실행 시간 (초) — Phase 0에서는 메타데이터만', (v) =>
      parseInt(v, 10),
    )
    .action(async (opts) => {
      await cronCreate({
        bot: opts.bot,
        name: opts.name,
        schedule: opts.schedule,
        payload: opts.payload,
        sessionTarget: opts.sessionTarget,
        disabled: opts.disabled,
        reportChannel: opts.reportChannel,
        targetDomain: opts.targetDomain,
        maxDuration: opts.maxDuration,
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
    .command('mark-run')
    .description(
      'cron 실행 결과를 bot_commitments(source_type=cron)에 기록 + bot_cron_jobs rollup 갱신',
    )
    .requiredOption('--bot-id <id>', '봇 ID')
    .requiredOption('--job-id <uuid>', '크론잡 ID')
    .requiredOption('--status <status>', 'success | failure | timeout | skipped')
    .requiredOption('--started-at <iso>', '시작 시각 (ISO 8601)')
    .requiredOption('--duration-ms <ms>', '실행 소요 (ms)', (v) => parseInt(v, 10))
    .option('--error <text>', '실패 사유 (last_error에 500자까지 저장)')
    .option('--output-digest <text>', '출력 요약/해시')
    .option('--metadata <json>', '추가 metadata JSON')
    .action(async (opts) => {
      const status = opts.status as CronRunStatus;
      if (!['success', 'failure', 'timeout', 'skipped'].includes(status)) {
        console.error(chalk.red(`❌ --status 값은 success|failure|timeout|skipped 중 하나`));
        process.exitCode = 1;
        return;
      }
      await cronMarkRun({
        botId: opts.botId,
        jobId: opts.jobId,
        status,
        startedAt: opts.startedAt,
        durationMs: opts.durationMs,
        error: opts.error,
        outputDigest: opts.outputDigest,
        metadata: opts.metadata,
      });
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

  cron
    .command('backfill-next-run')
    .description('enabled=true AND next_run IS NULL 인 잡들의 next_run을 선계산 (1회성)')
    .option('--dry-run', '실제 UPDATE 없이 계산 결과만 출력')
    .action(async (opts) => {
      try {
        await cronBackfillNextRun({ dryRun: !!opts.dryRun });
      } finally {
        await closeConnection();
      }
    });

  cron
    .command('tick')
    .description('[폴러 전용] due 잡 원자 claim 후 실행 페이로드 출력')
    .option('--dry-run', 'UPDATE 없이 SELECT만 실행 (원자 claim 생략)')
    .option('--limit <n>', '단일 tick 당 최대 fan-out 개수', (v) => parseInt(v, 10), 30)
    .option('--json', '폴러 세션이 파싱하기 위한 JSON 출력')
    .action(async (opts) => {
      try {
        await cronTick({ dryRun: !!opts.dryRun, limit: opts.limit, json: !!opts.json });
      } finally {
        await closeConnection();
      }
    });
}
