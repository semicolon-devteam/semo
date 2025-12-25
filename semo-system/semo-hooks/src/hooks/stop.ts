/**
 * Stop Hook
 *
 * 트리거: Claude 응답 완료 시
 * 동작: transcript 파싱하여 마지막 응답 저장
 */

import type { StopInput } from '../lib/types.js';
import { logInteraction, closePool, getDefaultUserId, getDefaultAgentId } from '../lib/db.js';
import { parseTranscript, getLastAssistantResponse } from '../lib/transcript.js';
import { readStdinJson, debugLog } from '../utils/env.js';

export async function handleStop(): Promise<void> {
  try {
    const input = await readStdinJson<StopInput>();

    debugLog('Stop input:', {
      session_id: input.session_id,
      transcript_path: input.transcript_path,
    });

    // Transcript 파싱
    const entries = await parseTranscript(input.transcript_path);
    debugLog('Transcript entries:', entries.length);

    // 마지막 assistant 응답 추출
    const lastResponse = getLastAssistantResponse(entries);

    if (lastResponse) {
      // 응답을 interaction_logs에 저장
      await logInteraction({
        user_id: getDefaultUserId(),
        session_id: input.session_id,
        agent_id: getDefaultAgentId(),
        role: 'assistant',
        content: lastResponse,
        skill_name: 'claude_response',
        metadata: {
          cwd: input.cwd,
          captured_at: new Date().toISOString(),
          response_length: lastResponse.length,
        },
      });

      debugLog('Stop: Saved response, length:', lastResponse.length);
    } else {
      debugLog('Stop: No assistant response found');
    }

    debugLog('Stop completed');
  } finally {
    await closePool();
  }

  // 출력 없음 (exit 0, 정상 종료 허용)
}
