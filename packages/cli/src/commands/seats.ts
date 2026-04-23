/**
 * `semo seats` — Personal/Team 공통 bot seat pool CRUD.
 *
 * seat 는 "1 bot == 1 Claude config dir" 단위의 동시 실행 슬롯.
 * Personal 프로파일(SQLite ops store) 에서는 세트를 직접 추가/조회.
 *
 * Team 프로파일(PG) 에선 기존 수동 INSERT / `bots-factory` 에서 allocation 만 수행하므로
 * 이 CLI 는 SQLite 경로에서만 실제 INSERT 를 수행한다.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import BetterSqlite from 'better-sqlite3';
import { loadProfile } from '../config/index.js';
import { semoHome } from '../paths.js';

interface SeatRow {
  seat_id: string;
  claude_config_dir: string;
  status: string;
  current_bot_id: string | null;
  allocated_at: string | null;
}

function openOpsDb(): { db: InstanceType<typeof BetterSqlite>; path: string } {
  const cfg = loadProfile();
  if (cfg.ops.driver !== 'sqlite') {
    throw new Error(`semo seats 는 현재 SQLite ops-store 만 지원합니다 (현재: ${cfg.ops.driver}).`);
  }
  const p = cfg.ops.sqlite_path ?? path.join(semoHome(), 'ops.db');
  if (!fs.existsSync(p)) {
    throw new Error(`ops DB 가 없습니다: ${p}\n먼저 \`semo migrate-sqlite\` 를 실행하세요.`);
  }
  return { db: new BetterSqlite(p), path: p };
}

function tableExists(db: InstanceType<typeof BetterSqlite>, name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name) as { name: string } | undefined;
  return Boolean(row);
}

export function registerSeatsCommand(program: Command): void {
  const cmd = program
    .command('seats')
    .description('bot seat pool 관리 (Personal/Team 공통 — Personal SQLite 실사용)');

  cmd
    .command('list')
    .description('현재 seat 목록 + 상태')
    .action(() => {
      const { db, path: dbPath } = openOpsDb();
      try {
        if (!tableExists(db, 'bot_seats')) {
          console.log(chalk.yellow('bot_seats 테이블이 없습니다. migrate-sqlite 먼저 실행하세요.'));
          return;
        }
        const rows = db
          .prepare(
            `SELECT seat_id, claude_config_dir, status, current_bot_id, allocated_at
             FROM bot_seats
             ORDER BY seat_id`,
          )
          .all() as SeatRow[];

        console.log(chalk.cyan.bold(`\n🪑 seats (${rows.length}) ${chalk.gray(dbPath)}\n`));
        if (rows.length === 0) {
          console.log(chalk.gray('  (빈 pool — `semo seats add` 로 추가)'));
          return;
        }
        for (const r of rows) {
          const statusColor = r.status === 'available' ? chalk.green : chalk.yellow;
          console.log(
            `  ${chalk.bold(r.seat_id)}  ${statusColor(r.status)}` +
              (r.current_bot_id ? ` → ${chalk.cyan(r.current_bot_id)}` : '') +
              chalk.gray(`  ${r.claude_config_dir}`),
          );
        }
      } finally {
        db.close();
      }
    });

  cmd
    .command('add')
    .description('seat 하나 이상 추가 (Personal 기본 1개)')
    .option('--count <n>', '생성 개수', '1')
    .option('--prefix <p>', 'seat_id prefix', 'seat')
    .option('--config-dir <path>', '공유 Claude config dir (기본: ~/.semo/claude-{seat_id})')
    .action((opts: { count?: string; prefix?: string; configDir?: string }) => {
      const { db } = openOpsDb();
      try {
        if (!tableExists(db, 'bot_seats')) {
          throw new Error('bot_seats 테이블 없음. migrate-sqlite 먼저 실행.');
        }
        const count = Math.max(1, parseInt(opts.count ?? '1', 10) || 1);
        const prefix = opts.prefix ?? 'seat';
        const existing = db
          .prepare(`SELECT seat_id FROM bot_seats WHERE seat_id LIKE ?`)
          .all(`${prefix}-%`) as Array<{ seat_id: string }>;
        const usedNums = new Set(
          existing
            .map((r) => parseInt(r.seat_id.replace(`${prefix}-`, ''), 10))
            .filter((n) => !isNaN(n)),
        );
        let nextNum = 1;
        const newIds: string[] = [];
        while (newIds.length < count) {
          if (!usedNums.has(nextNum)) newIds.push(`${prefix}-${nextNum}`);
          nextNum += 1;
        }

        const insert = db.prepare(
          `INSERT INTO bot_seats (seat_id, claude_config_dir, status) VALUES (?, ?, 'available')`,
        );
        const txn = db.transaction((ids: string[]) => {
          for (const id of ids) {
            const dir = opts.configDir ?? path.join(semoHome(), `claude-${id}`);
            insert.run(id, dir);
          }
        });
        txn(newIds);

        console.log(chalk.green(`✔ seat ${newIds.length}개 추가: ${newIds.join(', ')}`));
      } finally {
        db.close();
      }
    });

  cmd
    .command('release <seatId>')
    .description('할당된 seat 회수 (bot retire 용)')
    .action((seatId: string) => {
      const { db } = openOpsDb();
      try {
        const r = db
          .prepare(
            `UPDATE bot_seats
             SET status='available', current_bot_id=NULL, allocated_at=NULL,
                 updated_at=datetime('now')
             WHERE seat_id=?`,
          )
          .run(seatId);
        if (r.changes === 0) {
          console.error(chalk.red(`✖ seat "${seatId}" 없음`));
          process.exitCode = 1;
          return;
        }
        console.log(chalk.green(`✔ seat ${seatId} 해제`));
      } finally {
        db.close();
      }
    });
}
