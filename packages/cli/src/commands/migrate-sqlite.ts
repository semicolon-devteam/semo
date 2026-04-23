/**
 * SQLite migration runner — Personal 프로파일용.
 *
 * 동작 원리:
 *   - `packages/cli/migrations-sqlite/kb/*.sql`  → kb.db 에 적용
 *   - `packages/cli/migrations-sqlite/ops/*.sql` → ops.db 에 적용
 *   - 각 DB 내부에 `schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT)` 추적
 *   - 파일명 정렬 후 미적용 버전만 트랜잭션으로 실행
 *
 * 설계 근거:
 *   - 어댑터 생성자가 `CREATE TABLE IF NOT EXISTS ...` 을 실행하고 있으나, 향후 컬럼 추가/인덱스
 *     재구성이 필요할 때 마이그레이션 러너가 없으면 기존 DB 가 깨짐. 초기 버전을 001_initial 로
 *     등록해 두면 후속 변경을 002+ 로 안전하게 올릴 수 있다.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import BetterSqlite from 'better-sqlite3';
import { loadProfile } from '../config/profile.js';

type TargetName = 'kb' | 'ops';

interface AppliedRow {
  version: string;
  applied_at: string;
}

/**
 * `migrations-sqlite/` 디렉토리 위치를 런타임에 해석한다.
 * - 개발 모드 (ts-node): `src/commands/migrate-sqlite.ts` → `../../migrations-sqlite`
 * - 빌드 모드 (dist):   `dist/commands/migrate-sqlite.js` → `../../migrations-sqlite`
 * 두 경우 모두 패키지 루트의 `migrations-sqlite/` 를 가리킨다.
 */
function migrationsRoot(): string {
  return path.resolve(__dirname, '..', '..', 'migrations-sqlite');
}

function targetFiles(target: TargetName): string[] {
  const dir = path.join(migrationsRoot(), target);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function ensureTracker(db: BetterSqlite.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function appliedVersions(db: BetterSqlite.Database): AppliedRow[] {
  const rows = db
    .prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version')
    .all() as AppliedRow[];
  return rows;
}

interface RunOptions {
  dryRun?: boolean;
  status?: boolean;
}

function applyOne(db: BetterSqlite.Database, target: TargetName, filename: string): void {
  const full = path.join(migrationsRoot(), target, filename);
  const sql = fs.readFileSync(full, 'utf8');
  const version = filename.replace(/\.sql$/, '');

  const tx = db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
  });
  tx();
}

function runTarget(
  dbPath: string,
  target: TargetName,
  opts: RunOptions,
): { applied: string[]; pending: string[]; already: AppliedRow[] } {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new BetterSqlite(dbPath);
  try {
    ensureTracker(db);
    const all = targetFiles(target);
    const already = appliedVersions(db);
    const appliedSet = new Set(already.map((r) => r.version));
    const pending = all.filter((f) => !appliedSet.has(f.replace(/\.sql$/, '')));

    if (opts.status || opts.dryRun) {
      return { applied: [], pending, already };
    }

    const applied: string[] = [];
    for (const file of pending) {
      applyOne(db, target, file);
      applied.push(file);
    }
    return { applied, pending: [], already };
  } finally {
    db.close();
  }
}

function describeTarget(
  target: TargetName,
  dbPath: string,
  result: { applied: string[]; pending: string[]; already: AppliedRow[] },
  opts: RunOptions,
): void {
  const header = `[${target}] ${dbPath}`;
  console.log(chalk.bold(header));
  if (result.already.length > 0) {
    for (const r of result.already) {
      console.log(`  ${chalk.green('✓')} ${r.version}  ${chalk.gray(r.applied_at)}`);
    }
  } else {
    console.log(chalk.gray('  (기적용 마이그레이션 없음)'));
  }
  if (opts.status || opts.dryRun) {
    if (result.pending.length > 0) {
      console.log(chalk.yellow(`  미적용 ${result.pending.length}개:`));
      for (const f of result.pending) console.log(`    ${chalk.yellow('○')} ${f}`);
    } else {
      console.log(chalk.green('  모든 마이그레이션 적용됨'));
    }
  } else {
    if (result.applied.length > 0) {
      console.log(chalk.cyan(`  신규 적용 ${result.applied.length}개:`));
      for (const f of result.applied) console.log(`    ${chalk.green('✓')} ${f}`);
    } else {
      console.log(chalk.green('  신규 적용 없음'));
    }
  }
  console.log();
}

export function registerMigrateSqliteCommand(program: Command): void {
  program
    .command('migrate-sqlite')
    .description('SQLite (Personal 프로파일) 마이그레이션 실행')
    .option('--status', '적용 현황만 출력 (실행 안 함)')
    .option('--dry-run', '미적용 마이그레이션 미리보기')
    .option('--target <name>', 'kb | ops | all', 'all')
    .action(async (opts: { status?: boolean; dryRun?: boolean; target?: string }) => {
      const cfg = loadProfile();
      const targets: TargetName[] = [];
      if (opts.target === 'kb') targets.push('kb');
      else if (opts.target === 'ops') targets.push('ops');
      else targets.push('kb', 'ops');

      for (const t of targets) {
        const dbPath = t === 'kb' ? cfg.kb.sqlite_path : cfg.ops.sqlite_path;
        if (!dbPath) {
          console.log(
            chalk.yellow(
              `[${t}] sqlite_path 없음 — ${cfg.kb.driver}/${cfg.ops.driver} 드라이버에서는 스킵`,
            ),
          );
          continue;
        }
        const result = runTarget(dbPath, t, opts);
        describeTarget(t, dbPath, result, opts);
      }
    });
}

export const __testables = {
  migrationsRoot,
  targetFiles,
  runTarget,
  ensureTracker,
  appliedVersions,
};
