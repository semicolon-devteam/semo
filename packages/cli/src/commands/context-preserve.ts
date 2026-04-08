/**
 * semo context-preserve — PreCompact 훅에서 호출
 *
 * 컨텍스트 압축 전에 세션의 미기록 의사결정/로그를 KB에 flush.
 * stdin으로 { session_id, transcript_path } 수신.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import { getPool, closeConnection, isDbConnected } from '../database';
import { kbPush } from '../kb';

// 의사결정 패턴 감지
const DECISION_PATTERNS = [
  /결정[:\s].*(?:하기로|했다|합의|확정)/,
  /합의[:\s]/,
  /방침[:\s]/,
  /도입하기로/,
  /폐기하기로/,
  /변경하기로/,
];

export function registerContextPreserveCommands(program: Command): void {
  program
    .command('context-preserve')
    .description('PreCompact 훅 — 압축 전 KB에 결정/로그 flush')
    .action(async () => {
      let transcriptPath = '';
      try {
        const input = await readStdin();
        if (input) {
          const parsed = JSON.parse(input);
          transcriptPath = parsed.transcript_path || '';
        }
      } catch {
        // stdin 없음
      }

      const connected = await isDbConnected();
      if (!connected) {
        process.exit(0);
      }

      try {
        if (!transcriptPath || !fs.existsSync(transcriptPath)) {
          process.stderr.write('[context-preserve] transcript_path 없음, skip\n');
          process.exit(0);
        }

        const transcript = fs.readFileSync(transcriptPath, 'utf8');

        // 의사결정 패턴 감지
        const decisions: string[] = [];
        const lines = transcript.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (DECISION_PATTERNS.some((p) => p.test(line))) {
            // 전후 2줄 컨텍스트 포함
            const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3));
            decisions.push(context.join('\n'));
          }
        }

        if (decisions.length === 0) {
          process.stderr.write('[context-preserve] 기록할 의사결정 없음\n');
          process.exit(0);
        }

        // KB에 세션 로그로 기록
        const today = new Date().toISOString().slice(0, 10);
        const content = `# 세션 의사결정 로그 (${today})\n\n${decisions.map((d, i) => `## ${i + 1}\n${d}`).join('\n\n')}`;

        const pool = getPool();
        await kbPush(pool, [
          {
            domain: 'semicolon',
            key: 'session-log',
            sub_key: `${today}-${Date.now()}`,
            content,
            metadata: { source: 'context-preserve', decision_count: decisions.length },
          },
        ]);

        process.stderr.write(`[context-preserve] ${decisions.length}건 의사결정 KB에 기록\n`);
      } catch (err) {
        process.stderr.write(`[context-preserve] error: ${err}\n`);
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
    setTimeout(() => resolve(data.trim()), 500);
  });
}
