/**
 * UserPromptSubmit Hook
 *
 * 트리거: 사용자가 프롬프트 제출 시
 * 동작: 프롬프트를 interaction_logs에 저장
 */

import type { UserPromptSubmitInput } from '../lib/types.js';
import { logInteraction, closePool, getDefaultUserId, getDefaultAgentId } from '../lib/db.js';
import { readStdinJson, debugLog } from '../utils/env.js';

export async function handleUserPrompt(): Promise<void> {
  try {
    const input = await readStdinJson<UserPromptSubmitInput>();

    debugLog('UserPromptSubmit input:', {
      session_id: input.session_id,
      prompt_length: input.prompt?.length,
    });

    // 프롬프트를 interaction_logs에 저장
    await logInteraction({
      user_id: getDefaultUserId(),
      session_id: input.session_id,
      agent_id: getDefaultAgentId(),
      role: 'user',
      content: input.prompt,
      skill_name: 'user_prompt',
      metadata: {
        cwd: input.cwd,
        captured_at: new Date().toISOString(),
      },
    });

    debugLog('UserPromptSubmit completed');
  } finally {
    await closePool();
  }

  // 출력 없음 (exit 0)
}
