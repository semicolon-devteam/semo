/**
 * SessionEnd Hook
 *
 * 트리거: 세션 종료
 * 동작: 세션 통계 계산 및 DB 업데이트
 */

import type { SessionEndInput } from '../lib/types.js';
import { endSession, closePool } from '../lib/db.js';
import { parseTranscript, calculateSessionStats } from '../lib/transcript.js';
import { readStdinJson, debugLog } from '../utils/env.js';

export async function handleSessionEnd(): Promise<void> {
  try {
    const input = await readStdinJson<SessionEndInput>();

    debugLog('SessionEnd input:', input);

    // Transcript에서 세션 통계 계산
    const entries = await parseTranscript(input.transcript_path);
    const stats = calculateSessionStats(entries);

    debugLog('Session stats:', stats);

    // 세션 종료 업데이트
    await endSession(input.session_id, input.reason);

    debugLog('SessionEnd completed');
  } finally {
    await closePool();
  }

  // 출력 없음 (exit 0)
}
