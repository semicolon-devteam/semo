/**
 * semo db — 데이터베이스 관리
 *
 * semo db migrate          — 마이그레이션 실행
 * semo db migrate --status — 적용된 마이그레이션 목록
 * semo db migrate --dry-run — 미적용 마이그레이션 미리보기
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { getPool, closeConnection, isDbConnected } from '../database';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

// ============================================================
// Migration runner
// ============================================================

/**
 * 마이그레이션 SQL 의 `semo.` 스키마 한정자를 활성 스키마로 재작성한다.
 *
 * flip(`SEMICOLONY_DB_SCHEMA=semicolony`) 후 신규 마이그레이션이 stale `semo` 가 아니라
 * 활성 스키마에 적용되도록 한다(두 스키마 divergence 방지). 기본 `'semo'` 면 완전 no-op.
 *
 * - `(?<![\w./])semo\.` : qualified ref(DDL/DML/함수본문 $$..$$/dynamic SQL `'semo.x'`)만 매치.
 *   경로형 doc 문자열 `~/.semo.env`(앞이 `.`)·NOTIFY 채널 `semo_kb_change`(점 없음)·
 *   데이터 리터럴 `domain='semo'`/`'semobot'`/`table_schema='semo'`(점 없음)는 자동 배제.
 * - `CREATE|DROP SCHEMA ... semo` : bare 스키마명(fresh install 대상) 재작성.
 *
 * opt-out: 옛 `semo` 를 **소스로 의도 참조**하는 cross-schema 데이터 마이그(예: 098~106 의
 * `SELECT FROM semo.<old_table>`)는 첫 줄에 `-- @schema-retarget: off` 를 두면 retarget 을
 * 건너뛴다. (현 라이브 DB 의 그런 historical 마이그는 이미 applied 라 flip 후 재실행되지 않아
 * 무해하지만, 향후 신규 cross-schema 마이그를 위한 sanctioned escape hatch.)
 *
 * 검증된 clone 스크립트(scripts/clone-schema-semo-to-semicolony.mjs)의 `rw()` 와 동치이되
 * negative-lookbehind 로 경로형 false-positive 까지 배제.
 */
export function retargetSchemaSql(sql: string, schema: string): string {
  if (schema === 'semo') return sql;
  if (/@schema-retarget:\s*off/i.test(sql)) return sql;
  let out = sql.replace(/(?<![\w./])semo\./g, `${schema}.`);
  out = out.replace(/\b(?:CREATE|DROP)\s+SCHEMA(?:\s+IF\s+(?:NOT\s+)?EXISTS)?\s+semo\b/gi, (m) =>
    m.replace(/\bsemo\b/, schema),
  );
  return out;
}

/**
 * migrations/ 디렉토리 위치 — 번들/unbundled 양쪽 호환.
 *
 * unbundled (tsc 산출물): dist/commands/db.js → __dirname = dist/commands → ../../ = pkg root → ../../migrations
 * bundled (esbuild dist/bundle.js): __dirname = dist → ../migrations
 *
 * 첫 번째 후보가 없으면 두 번째 시도 (회귀 0 — 양쪽 다 동작).
 */
function resolveMigrationsDir(): string {
  const bundled = path.resolve(__dirname, '..', 'migrations');
  if (fs.existsSync(bundled)) return bundled;
  const unbundled = path.resolve(__dirname, '..', '..', 'migrations');
  return unbundled;
}

const MIGRATIONS_DIR = resolveMigrationsDir();

interface MigrationRecord {
  version: string;
  applied_at: string;
}

/**
 * schema_migrations 테이블이 없으면 생성
 */
async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

/**
 * 이미 적용된 마이그레이션 버전 목록
 */
async function getAppliedMigrations(): Promise<MigrationRecord[]> {
  const pool = getPool();
  const { rows } = await pool.query<MigrationRecord>(
    `SELECT version, applied_at::text FROM ${DB_SCHEMA}.schema_migrations ORDER BY version`,
  );
  return rows;
}

/**
 * migrations/ 디렉터리에서 SQL 파일 목록 (정렬)
 */
function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * 단일 마이그레이션 실행 (트랜잭션)
 */
async function runMigration(filename: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  const filePath = path.join(MIGRATIONS_DIR, filename);
  // `semo.` 한정자를 활성 스키마로 retarget (기본 'semo' 면 no-op). flip 후 divergence 방지.
  const sql = retargetSchemaSql(fs.readFileSync(filePath, 'utf-8'), DB_SCHEMA);
  const version = filename.replace(/\.sql$/, '');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(`INSERT INTO ${DB_SCHEMA}.schema_migrations (version) VALUES ($1)`, [
      version,
    ]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// Command registration
// ============================================================

export function registerDbCommands(program: Command): void {
  const dbCmd = program.command('db').description('데이터베이스 관리');

  dbCmd
    .command('migrate')
    .description('마이그레이션 실행')
    .option('--status', '적용된 마이그레이션 목록만 표시')
    .option('--dry-run', '미적용 마이그레이션 미리보기 (실행하지 않음)')
    .action(async (options: { status?: boolean; dryRun?: boolean }) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red('DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        await ensureMigrationsTable();

        const applied = await getAppliedMigrations();
        const appliedSet = new Set(applied.map((r) => r.version));
        const allFiles = getMigrationFiles();

        // --status: 적용 상태만 출력
        if (options.status) {
          if (applied.length === 0) {
            console.log(chalk.yellow('적용된 마이그레이션 없음'));
          } else {
            console.log(chalk.cyan('적용된 마이그레이션:'));
            for (const r of applied) {
              console.log(`  ${chalk.green('✓')} ${r.version}  ${chalk.gray(r.applied_at)}`);
            }
          }

          const pending = allFiles.filter((f) => !appliedSet.has(f.replace(/\.sql$/, '')));
          if (pending.length > 0) {
            console.log(chalk.yellow(`\n미적용: ${pending.length}개`));
            for (const f of pending) {
              console.log(`  ${chalk.yellow('○')} ${f}`);
            }
          }

          await closeConnection();
          return;
        }

        // 미적용 마이그레이션 필터
        const pending = allFiles.filter((f) => !appliedSet.has(f.replace(/\.sql$/, '')));

        if (pending.length === 0) {
          console.log(chalk.green('모든 마이그레이션이 적용됨'));
          await closeConnection();
          return;
        }

        // --dry-run: 미리보기만
        if (options.dryRun) {
          console.log(chalk.cyan(`미적용 마이그레이션 ${pending.length}개:`));
          for (const f of pending) {
            console.log(`  ${chalk.yellow('○')} ${f}`);
          }
          await closeConnection();
          return;
        }

        // 실행
        const spinner = ora(`마이그레이션 실행 중 (${pending.length}개)`).start();

        for (const file of pending) {
          spinner.text = `적용 중: ${file}`;
          await runMigration(file);
          spinner.text = `${chalk.green('✓')} ${file}`;
          console.log(`  ${chalk.green('✓')} ${file}`);
        }

        spinner.succeed(`마이그레이션 완료 (${pending.length}개 적용)`);
      } catch (err) {
        console.error(chalk.red(`마이그레이션 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
