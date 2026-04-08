/**
 * semo agent-flush — 서브에이전트 종료 시 KB/commitments flush
 *
 * SubagentStop 훅에서 호출. stdin으로 session context를 받아:
 * 1. 해당 세션의 active commitment → done 처리
 * 2. bot_sessions 상태 → terminated
 *
 * 사용법:
 *   npx semo agent-flush --bot semiclaw
 *   (stdin으로 { session_id, transcript_path } JSON 수신)
 */

import { Command } from 'commander';
import { getPool, closeConnection, isDbConnected } from '../database';

export function registerAgentFlushCommands(program: Command): void {
  program
    .command('agent-flush')
    .description('서브에이전트 종료 시 commitment/session flush')
    .requiredOption('--bot <botId>', '봇 ID')
    .action(async (options) => {
      const { bot: botId } = options;

      // stdin에서 session context 읽기 (SubagentStop 훅이 전달)
      let sessionId = '';
      try {
        const input = await readStdin();
        if (input) {
          const parsed = JSON.parse(input);
          sessionId = parsed.session_id || '';
        }
      } catch {
        // stdin 없거나 파싱 실패 — 무시하고 진행
      }

      const connected = await isDbConnected();
      if (!connected) {
        process.exit(0); // DB 없으면 조용히 종료 (훅이 세션 블로킹하지 않도록)
      }

      try {
        const pool = getPool();

        // 1. 해당 봇의 active/pending commitment → done 처리
        const commitResult = await pool.query(
          `UPDATE semo.bot_commitments
           SET status = 'done', completed_at = NOW(), updated_at = NOW()
           WHERE bot_id = $1
             AND status IN ('pending', 'active')
             AND ($2 = '' OR assigned_session = $2)
           RETURNING id, title`,
          [botId, sessionId],
        );

        for (const row of commitResult.rows) {
          process.stderr.write(`[agent-flush] commitment done: ${row.id} — ${row.title}\n`);
        }

        // 2. bot_sessions 상태 → terminated
        if (sessionId) {
          await pool.query(
            `UPDATE semo.bot_sessions
             SET status = 'terminated', ended_at = NOW()
             WHERE session_key = $1 AND bot_id = $2`,
            [sessionId, botId],
          );
        }
      } catch (err) {
        process.stderr.write(`[agent-flush] error: ${err}\n`);
      } finally {
        await closeConnection();
      }
    });
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data.trim()));
    // stdin이 즉시 닫혀있으면 빈 문자열 반환
    setTimeout(() => resolve(data.trim()), 500);
  });
}
