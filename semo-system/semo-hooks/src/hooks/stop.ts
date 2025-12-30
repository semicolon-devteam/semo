/**
 * Stop Hook
 *
 * 트리거: Claude 응답 완료 시
 * 동작: transcript 파싱하여 마지막 응답 저장
 *       + semo-system/ 파일 수정 감지 시 meta-workflow 호출 알림
 */

import * as fs from 'fs';
import * as path from 'path';
import type { StopInput, TranscriptEntry } from '../lib/types.js';
import { logInteraction, closePool, getDefaultUserId, getDefaultAgentId } from '../lib/db.js';
import { parseTranscript, getLastAssistantResponse } from '../lib/transcript.js';
import { readStdinJson, debugLog } from '../utils/env.js';

/**
 * semo-system/ 파일 수정 감지
 */
function detectSemoSystemModification(entries: TranscriptEntry[]): boolean {
  for (const entry of entries) {
    if (entry.type === 'tool_use') {
      // Edit 또는 Write 도구 사용 시
      if (entry.name === 'Edit' || entry.name === 'Write') {
        const input = entry.input as { file_path?: string };
        if (input.file_path && input.file_path.includes('semo-system/')) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Meta 환경인지 확인 (semo-system/meta 존재 여부)
 */
function isMetaEnvironment(cwd: string): boolean {
  const metaPath = path.join(cwd, 'semo-system', 'meta');
  return fs.existsSync(metaPath);
}

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

    // semo-system/ 파일 수정 감지 및 meta-workflow 알림
    const hasSemoSystemModification = detectSemoSystemModification(entries);
    const isMetaEnv = isMetaEnvironment(input.cwd);

    if (hasSemoSystemModification && isMetaEnv) {
      debugLog('Stop: semo-system modification detected in meta environment');

      // hookSpecificOutput으로 알림 반환
      const output = {
        hookSpecificOutput: {
          hookEventName: "Stop",
          additionalContext: "[SEMO] ⚠️ semo-system/ 수정 감지 - meta-workflow 호출 필요\n\n작업 완료 전 `skill:meta-workflow`를 호출하여 버저닝 및 배포를 진행하세요."
        }
      };
      console.log(JSON.stringify(output));
    }

    debugLog('Stop completed');
  } finally {
    await closePool();
  }
}
