/**
 * semo sessions — 세션 추적
 *
 * push: Claude Code 훅(SessionStart / Stop)에서 stdin으로 전달되는 JSON을 파싱해
 *       semo.bot_sessions 테이블에 upsert합니다.
 *
 * sync: DB에서 봇 목록을 읽어 세션 데이터를 동기화합니다.
 *       (OpenClaw 게이트웨이는 2026-04-15 폐기됨)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';
import { execSync } from 'child_process';
import type { PoolClient } from 'pg';
import { getPool, closeConnection, isDbConnected } from '../database';

// ─── stdin reader ───────────────────────────────────────────────────────────

async function readStdin(): Promise<Record<string, any>> {
  if (process.stdin.isTTY) return {};

  return new Promise((resolve) => {
    let raw = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => (raw += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    setTimeout(() => resolve({}), 500);
  });
}

// ─── 현재 git 브랜치 (label용) ──────────────────────────────────────────────

function getGitBranch(cwd?: string): string | null {
  try {
    const dir = cwd || process.cwd();
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ─── transcript.jsonl 메시지 수 카운트 ──────────────────────────────────────

async function countMessages(transcriptPath: string): Promise<number> {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return 0;

  return new Promise((resolve) => {
    let count = 0;
    const rl = readline.createInterface({
      input: fs.createReadStream(transcriptPath),
      crlfDelay: Infinity,
    });
    rl.on('line', (line: string) => {
      if (!line.trim()) return;
      try {
        const obj = JSON.parse(line);
        if (obj.role === 'user' || obj.role === 'assistant') count++;
      } catch {
        /* invalid line skip */
      }
    });
    rl.on('close', () => resolve(count));
    rl.on('error', () => resolve(0));
  });
}

// ─── 외부에서 호출 가능한 sync 헬퍼 (OpenClaw 게이트웨이 폐기 후 no-op) ──

export async function syncBotSessions(
  _botIds: string[],
  _client: PoolClient,
): Promise<{ total: number }> {
  return { total: 0 };
}

// ─── Command registration ───────────────────────────────────────────────────

export function registerSessionsCommands(program: Command): void {
  const sessionsCmd = program.command('sessions').description('세션 추적 (Claude Code 훅 연동)');

  // ── semo sessions push ────────────────────────────────────────────────────
  sessionsCmd
    .command('push')
    .description('현재 세션을 semo.bot_sessions에 기록 (훅에서 호출)')
    .requiredOption('--bot-id <id>', '봇 ID (e.g. workclaw)')
    .option('--event <type>', '이벤트 종류 (start|stop|heartbeat)', 'heartbeat')
    .option('--label <text>', '세션 라벨 (미지정 시 git 브랜치 자동 감지)')
    .option('--kind <kind>', '세션 종류 (main|isolated)', 'main')
    .action(async (options) => {
      const botId = options.botId;
      const event = options.event;

      const hook = await readStdin();
      const sessionKey =
        hook.session_id || process.env.CLAUDE_SESSION_ID || `${botId}-${Date.now()}`;

      const branch = getGitBranch(hook.cwd);
      const label = options.label || branch || path.basename(hook.cwd || process.cwd());

      const messageCount =
        event === 'stop' && hook.transcript_path
          ? await countMessages(hook.transcript_path)
          : undefined;

      const connected = await isDbConnected();
      if (!connected) {
        await closeConnection();
        process.exit(0);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        if (event === 'start') {
          await client.query(
            `INSERT INTO semo.bot_sessions
               (bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at)
             VALUES ($1, $2, $3, $4, 'claude-code', NOW(), 0, NOW())
             ON CONFLICT (bot_id, session_key) DO UPDATE SET
               label         = EXCLUDED.label,
               last_activity = NOW(),
               synced_at     = NOW()`,
            [botId, sessionKey, label, options.kind],
          );
          // session_count는 trg_session_count 트리거가 자동 관리
        } else if (event === 'stop') {
          await client.query(
            `UPDATE semo.bot_sessions
             SET last_activity = NOW(),
                 message_count = COALESCE($1, message_count),
                 synced_at     = NOW()
             WHERE bot_id = $2 AND session_key = $3`,
            [messageCount ?? null, botId, sessionKey],
          );
        } else {
          // heartbeat
          await client.query(
            `INSERT INTO semo.bot_sessions
               (bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at)
             VALUES ($1, $2, $3, $4, 'claude-code', NOW(), COALESCE($5, 0), NOW())
             ON CONFLICT (bot_id, session_key) DO UPDATE SET
               last_activity = NOW(),
               message_count = COALESCE(EXCLUDED.message_count, semo.bot_sessions.message_count),
               synced_at     = NOW()`,
            [botId, sessionKey, label, options.kind, messageCount ?? null],
          );
          // session_count는 trg_session_count 트리거가 자동 관리
        }

        client.release();
        console.log(chalk.green(`✔ sessions push [${event}] ${botId}/${sessionKey.slice(0, 8)}`));
      } catch (err) {
        console.error(chalk.red(`sessions push 실패: ${err}`));
        process.exit(0);
      } finally {
        await closeConnection();
      }
    });

  // ── semo sessions sync ────────────────────────────────────────────────────
  sessionsCmd
    .command('sync')
    .description('OpenClaw 게이트웨이에서 세션 읽어 DB upsert')
    .option('--bot-id <id>', '특정 봇만 동기화')
    .option('--all', 'semo.bot_status의 모든 봇 동기화')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      const pool = getPool();
      const client = await pool.connect();

      let botIds: string[] = [];
      if (options.botId) {
        botIds = [options.botId];
      } else if (options.all) {
        try {
          const r = await client.query('SELECT bot_id FROM semo.bot_status ORDER BY bot_id');
          botIds = r.rows.map((row: any) => row.bot_id);
        } catch {
          const home = os.homedir();
          const wsDir = path.join(home, '.semo', 'workspaces');
          botIds = fs.existsSync(wsDir)
            ? fs.readdirSync(wsDir).filter((d) => fs.statSync(path.join(wsDir, d)).isDirectory())
            : [];
        }
      } else {
        console.log(chalk.yellow('  --bot-id <id> 또는 --all 옵션 필요'));
        client.release();
        await closeConnection();
        process.exit(1);
      }

      if (botIds.length === 0) {
        console.log(chalk.yellow('  동기화할 봇 없음'));
        client.release();
        await closeConnection();
        return;
      }

      console.log(
        chalk.yellow(
          '\n⚠ sessions sync는 OpenClaw 게이트웨이 폐기(2026-04-15) 이후 no-op입니다.\n' +
            '  세션은 Claude Code 훅(semo sessions push)으로 직접 기록됩니다.\n',
        ),
      );

      client.release();
      await closeConnection();
    });

  // ── semo sessions list ────────────────────────────────────────────────────
  sessionsCmd
    .command('list')
    .description('bot_sessions 테이블 조회')
    .option('--bot-id <id>', '특정 봇만')
    .option('--limit <n>', '최대 조회 수', '20')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red('❌ DB 연결 실패'));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        const params: (string | number)[] = [];
        let where = '';
        if (options.botId) {
          where = 'WHERE bot_id = $1';
          params.push(options.botId);
        }
        params.push(parseInt(options.limit));
        const limitIdx = params.length;

        const result = await client.query(
          `SELECT bot_id, session_key, label, kind, chat_type,
                  last_activity::text, message_count
           FROM semo.bot_sessions
           ${where}
           ORDER BY last_activity DESC NULLS LAST
           LIMIT $${limitIdx}`,
          params,
        );
        client.release();

        if (options.format === 'json') {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          console.log(chalk.cyan.bold('\n📋 세션 목록\n'));
          if (result.rows.length === 0) {
            console.log(chalk.yellow('  세션 없음'));
          } else {
            for (const s of result.rows) {
              const ts = s.last_activity ? new Date(s.last_activity).toLocaleString('ko-KR') : '-';
              console.log(
                chalk.cyan(`  ${s.bot_id.padEnd(14)}`) +
                  chalk.white(`${(s.label || s.session_key).padEnd(30)}`) +
                  chalk.gray(`${ts}  ${s.message_count}msg`),
              );
            }
          }
          console.log();
        }
      } catch (err) {
        console.log(chalk.red(`❌ 조회 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo sessions digest ──────────────────────────────────────────────────
  sessionsCmd
    .command('digest')
    .description('세션 transcript에서 미기록 의사결정 추출')
    .option('--transcript <path>', 'transcript JSONL 파일 경로')
    .option('--session-dir <dir>', '세션 디렉토리 (최신 transcript 자동 선택)')
    .option('--hours <n>', '최근 N시간 내 transcript만 (session-dir 사용 시)', '24')
    .option('--format <type>', '출력 형식 (table|json)', 'table')
    .option('--output <path>', '결과를 파일로 출력')
    .action(async (options) => {
      // transcript 파일 찾기
      let transcripts: string[] = [];

      if (options.transcript) {
        if (!fs.existsSync(options.transcript)) {
          console.error(chalk.red(`❌ 파일 없음: ${options.transcript}`));
          process.exit(1);
        }
        transcripts = [options.transcript];
      } else if (options.sessionDir) {
        const dir = options.sessionDir;
        if (!fs.existsSync(dir)) {
          console.error(chalk.red(`❌ 디렉토리 없음: ${dir}`));
          process.exit(1);
        }
        const hours = parseInt(options.hours) || 24;
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.jsonl'))
          .map((f) => ({
            name: f,
            path: path.join(dir, f),
            mtime: fs.statSync(path.join(dir, f)).mtimeMs,
          }))
          .filter((f) => f.mtime > cutoff)
          .sort((a, b) => b.mtime - a.mtime);
        transcripts = files.map((f) => f.path);
      } else {
        // 기본: 현재 작업 디렉토리의 Claude Code 세션 디렉토리
        // Claude Code 는 cwd 의 '/' 를 '-' 로 치환하여 ~/.claude/projects/ 하위에 저장한다.
        const projectSlug = process.cwd().replace(/\//g, '-');
        const semoSessionDir = path.join(os.homedir(), '.claude', 'projects', projectSlug);
        if (fs.existsSync(semoSessionDir)) {
          const hours = parseInt(options.hours) || 24;
          const cutoff = Date.now() - hours * 60 * 60 * 1000;
          const files = fs
            .readdirSync(semoSessionDir)
            .filter((f) => f.endsWith('.jsonl'))
            .map((f) => ({
              name: f,
              path: path.join(semoSessionDir, f),
              mtime: fs.statSync(path.join(semoSessionDir, f)).mtimeMs,
            }))
            .filter((f) => f.mtime > cutoff)
            .sort((a, b) => b.mtime - a.mtime);
          transcripts = files.map((f) => f.path);
        }
      }

      if (transcripts.length === 0) {
        console.log(chalk.yellow('⚠ 분석할 transcript가 없습니다.'));
        process.exit(0);
      }

      // 의사결정 키워드 패턴
      const decisionRe =
        /(?:도입했|폐기했|전환했|적용했|배포했|마이그레이션|변경했|합의했|결정했|도입합니다|폐기합니다|전환합니다|적용합니다|배포합니다|도입 완료|폐기 완료|전환 완료|적용 완료|배포 완료|표준화했|통합했|분리했|추가했|제거했|Phase \d+ 완료|설정을? 변경|규칙을? 변경|프로세스를? 변경|NON-NEGOTIABLE|신규 생성|전체 배포)/g;
      const kbRecordRe = /KB 기록:|semo kb upsert|KB upsert 완료|답변근거: KB/;

      interface DecisionCandidate {
        file: string;
        lineNum: number;
        text: string;
        keywords: string[];
        hasKbRecord: boolean;
        timestamp?: string;
      }

      const candidates: DecisionCandidate[] = [];

      for (const tPath of transcripts) {
        const lines = fs
          .readFileSync(tPath, 'utf-8')
          .split('\n')
          .filter((l) => l.trim());
        let lastKbUpsertLine = -1;

        for (let i = 0; i < lines.length; i++) {
          try {
            const entry = JSON.parse(lines[i]);
            const msg = entry.message ?? entry;

            // KB upsert tool call 추적
            if (msg.role === 'assistant') {
              const content = msg.content ?? [];
              for (const block of content) {
                if (block?.type === 'tool_use') {
                  const inp = JSON.stringify(block.input ?? {});
                  if (inp.includes('kb upsert') || inp.includes('kb_upsert')) {
                    lastKbUpsertLine = i;
                  }
                }
              }
            }

            // tool result에서 upsert 완료 추적
            if (msg.role === 'tool') {
              const content = Array.isArray(msg.content)
                ? msg.content
                    .map((c: any) => (typeof c === 'string' ? c : (c?.text ?? '')))
                    .join(' ')
                : String(msg.content ?? '');
              if (content.includes('upsert 완료')) {
                lastKbUpsertLine = i;
              }
            }

            // assistant 텍스트에서 의사결정 키워드 탐지
            if (msg.role === 'assistant') {
              const content = msg.content ?? [];
              for (const block of content) {
                if (block?.type !== 'text') continue;
                let text = block.text ?? '';

                // 코드 블록 제거
                text = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');

                const matches = text.match(decisionRe);
                if (matches && matches.length > 0) {
                  const hasKbInText = kbRecordRe.test(text);
                  // 같은 턴(±5줄 이내)에 KB upsert가 있었는지
                  const hasKbNearby = Math.abs(i - lastKbUpsertLine) <= 10;

                  candidates.push({
                    file: path.basename(tPath),
                    lineNum: i,
                    text: text.slice(0, 200).replace(/\n/g, ' '),
                    keywords: [...new Set(matches)].slice(0, 3) as string[],
                    hasKbRecord: hasKbInText || hasKbNearby,
                    timestamp: entry.timestamp
                      ? new Date(entry.timestamp).toLocaleString('ko-KR')
                      : undefined,
                  });
                }
              }
            }
          } catch {
            /* skip */
          }
        }
      }

      // 미기록 건만 필터
      const unrecorded = candidates.filter((c) => !c.hasKbRecord);
      const recorded = candidates.filter((c) => c.hasKbRecord);

      if (options.format === 'json') {
        const result = {
          total: candidates.length,
          recorded: recorded.length,
          unrecorded: unrecorded.length,
          items: unrecorded,
        };
        const out = JSON.stringify(result, null, 2);
        if (options.output) {
          fs.writeFileSync(options.output, out);
          console.log(chalk.green(`✔ 결과 저장: ${options.output}`));
        } else {
          console.log(out);
        }
      } else {
        console.log(chalk.cyan.bold(`\n📋 세션 의사결정 다이제스트\n`));
        console.log(
          chalk.gray(
            `  transcript: ${transcripts.length}개 | 총 감지: ${candidates.length}건 | 기록됨: ${recorded.length}건 | 미기록: ${unrecorded.length}건\n`,
          ),
        );

        if (unrecorded.length === 0) {
          console.log(chalk.green('  ✅ 미기록 의사결정 없음\n'));
        } else {
          console.log(chalk.yellow.bold('  ⚠ 미기록 의사결정:\n'));
          for (const c of unrecorded) {
            console.log(
              chalk.yellow(`  [${c.file}:${c.lineNum}]`) +
                chalk.gray(c.timestamp ? ` ${c.timestamp}` : ''),
            );
            console.log(chalk.white(`    키워드: ${c.keywords.join(', ')}`));
            console.log(chalk.gray(`    "${c.text.slice(0, 120)}..."\n`));
          }
        }

        if (options.output) {
          const lines = [
            `# 세션 의사결정 다이제스트`,
            ``,
            `총 감지: ${candidates.length}건 | 기록됨: ${recorded.length}건 | 미기록: ${unrecorded.length}건`,
            ``,
          ];
          if (unrecorded.length > 0) {
            lines.push(`## 미기록 의사결정`, ``);
            for (const c of unrecorded) {
              lines.push(`- **[${c.file}:${c.lineNum}]** ${c.keywords.join(', ')}`);
              lines.push(`  > ${c.text.slice(0, 150)}...`);
              lines.push(``);
            }
          }
          fs.writeFileSync(options.output, lines.join('\n'));
          console.log(chalk.green(`✔ 결과 저장: ${options.output}`));
        }
      }
    });
}
