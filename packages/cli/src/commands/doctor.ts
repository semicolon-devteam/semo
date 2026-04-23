/**
 * `semo doctor` — Personal/Team 프리플라이트 헬스체크.
 *
 * 목적: "이 머신에서 `semo` 풀스택이 지금 돌 수 있나?" 를 한 명령으로 판정.
 *
 * 체크 범주:
 *   1. config.toml 로드 + schema_version forward-compat 경고
 *   2. 3-layer 레이아웃 (kernel/tenant/merged) 존재
 *   3. KB/Ops SQLite DB 파일 + 마이그레이션 적용 현황
 *   4. Ollama reachability + 모델/임베딩 모델 설치 여부
 *   5. 메신저 credential (Discord token, Slack token) 환경변수 존재
 *   6. 실행 타깃 (anthropic-api 키, claude-code PATH)
 *   7. seat pool 가용성 (Personal 에서 bot 생성 가능 여부)
 *
 * 출력: 사람이 읽는 포맷 + `--json` 머신 파싱 포맷.
 * 종료 코드: fail 있으면 1, warn 만 있으면 0 (기본) 또는 --strict 로 1.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import BetterSqlite from 'better-sqlite3';
import { loadProfile } from '../config/profile.js';
import type { SemoConfig } from '../config/types.js';
import { kernelDir, tenantDir, mergedClaudeDir } from '../paths.js';

export type CheckLevel = 'ok' | 'warn' | 'fail' | 'skip';

export interface CheckResult {
  /** 체크 이름 (고정 slug). */
  id: string;
  /** 사람용 라벨. */
  label: string;
  level: CheckLevel;
  /** 상세/수정 힌트. */
  detail?: string;
}

export interface DoctorReport {
  checks: CheckResult[];
  summary: { ok: number; warn: number; fail: number; skip: number };
  exitCode: 0 | 1;
}

/** config.toml schema_version + 경고 */
export function checkConfig(cfg: SemoConfig): CheckResult {
  const warnings = cfg._warnings ?? [];
  if (warnings.length > 0) {
    return {
      id: 'config',
      label: 'config.toml forward-compat',
      level: 'warn',
      detail: warnings.join('; '),
    };
  }
  return {
    id: 'config',
    label: `config.toml (schema ${cfg.schema_version}, profile=${cfg.profile})`,
    level: 'ok',
    detail: cfg._source ?? '<default>',
  };
}

export function checkLayout(): CheckResult {
  const missing: string[] = [];
  for (const dir of [kernelDir(), tenantDir(), mergedClaudeDir()]) {
    if (!fs.existsSync(dir)) missing.push(dir);
  }
  if (missing.length > 0) {
    return {
      id: 'layout',
      label: 'SEMO 3-layer 디렉터리',
      level: 'fail',
      detail: `누락: ${missing.join(', ')} — \`semo init\` 실행 필요`,
    };
  }
  return { id: 'layout', label: 'SEMO 3-layer 디렉터리', level: 'ok' };
}

/**
 * SQLite 대상(kb|ops) DB 파일 + migration 현황.
 * - 파일 부재 → fail
 * - migrations-sqlite/<target>/*.sql 중 미적용 존재 → warn
 */
export function checkSqliteTarget(
  target: 'kb' | 'ops',
  dbPath: string | undefined,
  migrationsRoot: string,
): CheckResult {
  const id = `sqlite:${target}`;
  const label = `SQLite ${target} DB`;
  if (!dbPath) {
    return { id, label, level: 'skip', detail: `driver 가 sqlite 가 아님` };
  }
  if (!fs.existsSync(dbPath)) {
    return {
      id,
      label,
      level: 'fail',
      detail: `${dbPath} 없음 — \`semo migrate-sqlite --target ${target}\` 실행`,
    };
  }
  const dir = path.join(migrationsRoot, target);
  if (!fs.existsSync(dir)) {
    return { id, label, level: 'warn', detail: `migrations-sqlite/${target} 디렉터리 없음` };
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/, ''));

  const db = new BetterSqlite(dbPath, { readonly: true });
  try {
    const trackerExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'`)
      .get();
    if (!trackerExists) {
      return {
        id,
        label,
        level: 'warn',
        detail: `schema_migrations 테이블 없음 — \`semo migrate-sqlite --target ${target}\``,
      };
    }
    const applied = (
      db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>
    ).map((r) => r.version);
    const appliedSet = new Set(applied);
    const pending = files.filter((v) => !appliedSet.has(v));
    if (pending.length > 0) {
      return {
        id,
        label,
        level: 'warn',
        detail: `미적용 ${pending.length}: ${pending.join(', ')} — \`semo migrate-sqlite --target ${target}\``,
      };
    }
    return { id, label, level: 'ok', detail: `${dbPath} (applied ${applied.length})` };
  } finally {
    db.close();
  }
}

/**
 * Ollama `/api/tags` 핑.
 * `host` 미지정 시 환경변수/기본값(127.0.0.1:11434) 사용.
 * `model` 지정 시 tags 목록에 포함돼야 ok.
 */
export async function checkOllama(
  host: string | undefined,
  models: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult[]> {
  const resolvedHost = (host ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(
    /\/$/,
    '',
  );
  const id = 'ollama';
  try {
    const r = await fetchImpl(`${resolvedHost}/api/tags`);
    if (!r.ok) {
      return [
        {
          id,
          label: 'Ollama 서버',
          level: 'fail',
          detail: `HTTP ${r.status} from ${resolvedHost}`,
        },
      ];
    }
    const body = (await r.json()) as { models?: Array<{ name?: string }> };
    const names = (body.models ?? []).map((m) => m.name ?? '').filter(Boolean);
    const out: CheckResult[] = [
      { id, label: `Ollama 서버 (${resolvedHost})`, level: 'ok', detail: `${names.length}개 모델` },
    ];
    for (const want of models) {
      const hit = names.some((n) => n === want || n.startsWith(`${want}:`));
      out.push({
        id: `ollama:model:${want}`,
        label: `Ollama 모델 ${want}`,
        level: hit ? 'ok' : 'fail',
        detail: hit ? undefined : `\`ollama pull ${want}\` 필요`,
      });
    }
    return out;
  } catch (err) {
    return [
      {
        id,
        label: `Ollama 서버 (${resolvedHost})`,
        level: 'fail',
        detail: `도달 불가: ${(err as Error).message} — \`brew install ollama && ollama serve\``,
      },
      ...models.map<CheckResult>((want) => ({
        id: `ollama:model:${want}`,
        label: `Ollama 모델 ${want}`,
        level: 'skip',
        detail: 'ollama 서버 미도달',
      })),
    ];
  }
}

/** Discord/Slack credential env var 존재 여부 */
export function checkMessagingCredentials(
  sources: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): CheckResult[] {
  const out: CheckResult[] = [];
  if (sources.includes('discord')) {
    const has = Boolean(env.DISCORD_TOKEN || env.DISCORD_BOT_TOKEN);
    out.push({
      id: 'messaging:discord',
      label: 'Discord 봇 토큰 (DISCORD_TOKEN)',
      level: has ? 'ok' : 'fail',
      detail: has ? undefined : 'Discord Developer Portal 에서 bot token 발급 후 환경변수 설정',
    });
  }
  if (sources.includes('slack')) {
    const has = Boolean(env.SLACK_BOT_TOKEN && env.SLACK_APP_TOKEN);
    out.push({
      id: 'messaging:slack',
      label: 'Slack 토큰 (SLACK_BOT_TOKEN + SLACK_APP_TOKEN)',
      level: has ? 'ok' : 'fail',
      detail: has ? undefined : 'bot token (xoxb-) + app token (xapp-) 양쪽 필요',
    });
  }
  return out;
}

/** 실행 타깃 별 의존성 체크 */
export function checkExecution(cfg: SemoConfig, env: NodeJS.ProcessEnv = process.env): CheckResult {
  const t = cfg.execution.target;
  if (t === 'anthropic-api') {
    const varName = cfg.execution.api_key_env ?? 'ANTHROPIC_API_KEY';
    const has = Boolean(env[varName]);
    return {
      id: 'execution',
      label: `execution=anthropic-api (${varName})`,
      level: has ? 'ok' : 'fail',
      detail: has ? undefined : `환경변수 ${varName} 설정 필요`,
    };
  }
  if (t === 'openai' || t === 'gemini') {
    const varName =
      cfg.execution.api_key_env ?? (t === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY');
    const has = Boolean(env[varName]);
    return {
      id: 'execution',
      label: `execution=${t} (${varName})`,
      level: has ? 'ok' : 'fail',
      detail: has ? undefined : `환경변수 ${varName} 설정 필요`,
    };
  }
  if (t === 'claude-code') {
    return {
      id: 'execution',
      label: 'execution=claude-code',
      level: 'ok',
      detail: '세션풀에서 관리됨 (별도 preflight 없음)',
    };
  }
  if (t === 'ollama' || t === 'mlx') {
    return {
      id: 'execution',
      label: `execution=${t}`,
      level: 'ok',
      detail: `ollama 체크 항목 참조`,
    };
  }
  return { id: 'execution', label: `execution=${t}`, level: 'warn', detail: '알 수 없는 타깃' };
}

/** SQLite ops 의 bot_seats 개수 — 0 이면 warn (bot 생성 불가) */
export function checkSeatPool(opsDbPath: string | undefined): CheckResult {
  const id = 'seats';
  const label = 'bot seat pool';
  if (!opsDbPath) return { id, label, level: 'skip', detail: 'ops 가 sqlite 가 아님' };
  if (!fs.existsSync(opsDbPath)) return { id, label, level: 'skip', detail: 'ops DB 없음' };
  const db = new BetterSqlite(opsDbPath, { readonly: true });
  try {
    const tbl = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='bot_seats'`)
      .get();
    if (!tbl) return { id, label, level: 'skip', detail: 'bot_seats 테이블 없음' };
    const row = db.prepare(`SELECT COUNT(*) AS n FROM bot_seats`).get() as { n: number };
    if (row.n === 0) {
      return {
        id,
        label,
        level: 'warn',
        detail: '빈 pool — `semo seats add` 로 최소 1개 확보 필요 (bot 생성 시)',
      };
    }
    const avail = db
      .prepare(`SELECT COUNT(*) AS n FROM bot_seats WHERE status='available'`)
      .get() as { n: number };
    if (avail.n === 0) {
      return {
        id,
        label,
        level: 'warn',
        detail: `${row.n}개 seat 모두 할당됨 — 신규 bot 생성 시 \`semo seats add\` 또는 기존 봇 retire`,
      };
    }
    return { id, label, level: 'ok', detail: `available ${avail.n}/${row.n}` };
  } finally {
    db.close();
  }
}

/** 임베딩 프로바이더 체크 — Ollama 프로바이더는 checkOllama 가 대신 커버 */
export function checkEmbedding(cfg: SemoConfig): CheckResult {
  const id = 'embedding';
  if (!cfg.embedding) {
    return {
      id,
      label: 'embedding provider',
      level: 'warn',
      detail: '미설정 — FTS5 키워드 검색만 가능 (한국어 의미 검색 없음)',
    };
  }
  if (cfg.embedding.provider === 'none') {
    return { id, label: 'embedding=none', level: 'ok', detail: 'FTS5 전용' };
  }
  if (cfg.embedding.provider === 'openai') {
    const varName = cfg.embedding.api_key_env ?? 'OPENAI_API_KEY';
    const has = Boolean(process.env[varName]);
    return {
      id,
      label: `embedding=openai (${varName})`,
      level: has ? 'ok' : 'fail',
      detail: has ? undefined : `${varName} 환경변수 필요`,
    };
  }
  return {
    id,
    label: `embedding=${cfg.embedding.provider}`,
    level: 'ok',
    detail: cfg.embedding.model ?? undefined,
  };
}

/** 개별 체크를 합쳐 리포트 생성 */
export async function runDoctor(
  cfg: SemoConfig,
  migrationsRoot: string,
  opts: { strict?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<DoctorReport> {
  const checks: CheckResult[] = [];
  checks.push(checkConfig(cfg));
  checks.push(checkLayout());

  if (cfg.kb.driver === 'sqlite') {
    checks.push(checkSqliteTarget('kb', cfg.kb.sqlite_path, migrationsRoot));
  }
  if (cfg.ops.driver === 'sqlite') {
    checks.push(checkSqliteTarget('ops', cfg.ops.sqlite_path, migrationsRoot));
    checks.push(checkSeatPool(cfg.ops.sqlite_path));
  }

  checks.push(...checkMessagingCredentials(cfg.messaging.sources));
  checks.push(checkExecution(cfg));
  checks.push(checkEmbedding(cfg));

  const wantedModels: string[] = [];
  const ollamaHost =
    cfg.execution.target === 'ollama' ? cfg.execution.ollama_host : cfg.embedding?.host;
  const needsOllama = cfg.execution.target === 'ollama' || cfg.embedding?.provider === 'ollama';
  if (needsOllama) {
    if (cfg.execution.target === 'ollama' && cfg.execution.model) {
      wantedModels.push(cfg.execution.model);
    }
    if (cfg.embedding?.provider === 'ollama' && cfg.embedding.model) {
      wantedModels.push(cfg.embedding.model);
    }
    checks.push(...(await checkOllama(ollamaHost, wantedModels, opts.fetchImpl)));
  }

  const summary = { ok: 0, warn: 0, fail: 0, skip: 0 };
  for (const c of checks) summary[c.level] += 1;

  const exitCode: 0 | 1 = summary.fail > 0 || (opts.strict && summary.warn > 0) ? 1 : 0;
  return { checks, summary, exitCode };
}

function icon(level: CheckLevel): string {
  if (level === 'ok') return chalk.green('✓');
  if (level === 'warn') return chalk.yellow('⚠');
  if (level === 'fail') return chalk.red('✗');
  return chalk.gray('○');
}

export function renderReport(report: DoctorReport): string {
  const lines: string[] = [''];
  for (const c of report.checks) {
    lines.push(`  ${icon(c.level)} ${c.label}${c.detail ? chalk.gray(` — ${c.detail}`) : ''}`);
  }
  lines.push('');
  const s = report.summary;
  lines.push(
    `  ${chalk.bold('요약')}: ${chalk.green(`${s.ok} ok`)} · ${chalk.yellow(`${s.warn} warn`)} · ${chalk.red(`${s.fail} fail`)} · ${chalk.gray(`${s.skip} skip`)}`,
  );
  if (report.exitCode === 0 && s.fail === 0) {
    lines.push('  ' + chalk.green('→ Personal 스택 준비 완료'));
  } else if (s.fail > 0) {
    lines.push('  ' + chalk.red('→ 블로커 있음 — 위 fail 항목 해결 후 재실행'));
  }
  lines.push('');
  return lines.join('\n');
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('SEMO 스택 프리플라이트 헬스체크 (config/DB/migrations/Ollama/credentials)')
    .option('--json', 'JSON 으로 출력 (머신 파싱용)')
    .option('--strict', 'warn 도 실패로 간주 (CI 용)')
    .action(async (opts: { json?: boolean; strict?: boolean }) => {
      const cfg = loadProfile();
      const migrationsRoot = path.resolve(__dirname, '..', '..', 'migrations-sqlite');
      const report = await runDoctor(cfg, migrationsRoot, { strict: opts.strict });
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderReport(report));
      }
      process.exitCode = report.exitCode;
    });
}

export const __testables = {
  checkConfig,
  checkLayout,
  checkSqliteTarget,
  checkOllama,
  checkMessagingCredentials,
  checkExecution,
  checkSeatPool,
  checkEmbedding,
  runDoctor,
  renderReport,
};
