/**
 * semo db — 데이터베이스 관리
 *
 * semo db migrate          — 마이그레이션 실행
 * semo db migrate --status — 적용된 마이그레이션 목록
 * semo db migrate --dry-run — 미적용 마이그레이션 미리보기
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import { getPool, closeConnection, isDbConnected } from "../database";

// ============================================================
// Migration runner
// ============================================================

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "migrations");

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
    CREATE TABLE IF NOT EXISTS semo.schema_migrations (
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
    `SELECT version, applied_at::text FROM semo.schema_migrations ORDER BY version`
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
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * 단일 마이그레이션 실행 (트랜잭션)
 */
async function runMigration(filename: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, "utf-8");
  const version = filename.replace(/\.sql$/, "");

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      `INSERT INTO semo.schema_migrations (version) VALUES ($1)`,
      [version]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// Command registration
// ============================================================

export function registerDbCommands(program: Command): void {
  const dbCmd = program
    .command("db")
    .description("데이터베이스 관리");

  dbCmd
    .command("migrate")
    .description("마이그레이션 실행")
    .option("--status", "적용된 마이그레이션 목록만 표시")
    .option("--dry-run", "미적용 마이그레이션 미리보기 (실행하지 않음)")
    .action(async (options: { status?: boolean; dryRun?: boolean }) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.error(chalk.red("DB 연결 실패"));
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
            console.log(chalk.yellow("적용된 마이그레이션 없음"));
          } else {
            console.log(chalk.cyan("적용된 마이그레이션:"));
            for (const r of applied) {
              console.log(`  ${chalk.green("✓")} ${r.version}  ${chalk.gray(r.applied_at)}`);
            }
          }

          const pending = allFiles.filter(
            (f) => !appliedSet.has(f.replace(/\.sql$/, ""))
          );
          if (pending.length > 0) {
            console.log(chalk.yellow(`\n미적용: ${pending.length}개`));
            for (const f of pending) {
              console.log(`  ${chalk.yellow("○")} ${f}`);
            }
          }

          await closeConnection();
          return;
        }

        // 미적용 마이그레이션 필터
        const pending = allFiles.filter(
          (f) => !appliedSet.has(f.replace(/\.sql$/, ""))
        );

        if (pending.length === 0) {
          console.log(chalk.green("모든 마이그레이션이 적용됨"));
          await closeConnection();
          return;
        }

        // --dry-run: 미리보기만
        if (options.dryRun) {
          console.log(chalk.cyan(`미적용 마이그레이션 ${pending.length}개:`));
          for (const f of pending) {
            console.log(`  ${chalk.yellow("○")} ${f}`);
          }
          await closeConnection();
          return;
        }

        // 실행
        const spinner = ora(`마이그레이션 실행 중 (${pending.length}개)`).start();

        for (const file of pending) {
          spinner.text = `적용 중: ${file}`;
          await runMigration(file);
          spinner.text = `${chalk.green("✓")} ${file}`;
          console.log(`  ${chalk.green("✓")} ${file}`);
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
