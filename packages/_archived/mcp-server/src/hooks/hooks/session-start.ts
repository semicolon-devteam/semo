/**
 * SessionStart Hook
 *
 * 트리거: 세션 시작/재개/클리어
 * 동작: 세션 정보를 DB에 upsert
 */

import type { SessionStartInput, SessionStartOutput } from '../lib/types.js';
import { upsertSession, closePool, getDefaultUserId } from '../lib/db.js';
import { readStdinJson, writeStdoutJson, debugLog } from '../utils/env.js';

export async function handleSessionStart(): Promise<void> {
  try {
    const input = await readStdinJson<SessionStartInput>();

    debugLog('SessionStart input:', input);

    // 세션 정보 upsert
    await upsertSession({
      session_id: input.session_id,
      user_id: getDefaultUserId(),
      cwd: input.cwd,
      source: input.source,
      metadata: {
        source: input.source,
        permission_mode: input.permission_mode,
        started_at: new Date().toISOString(),
      },
    });

    // 출력 (additionalContext로 Claude에 컨텍스트 전달 가능)
    const output: SessionStartOutput = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `SEMO session initialized: ${input.session_id}`,
      },
    };

    writeStdoutJson(output);

    debugLog('SessionStart completed');
  } finally {
    await closePool();
  }
}
