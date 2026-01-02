/**
 * Stop Hook
 *
 * 트리거: Claude 응답 완료 시
 * 동작: transcript 파싱하여 마지막 응답 저장
 *       + semo-system/ 또는 packages/ 파일 수정 감지 시 meta-workflow 강제 알림
 *
 * Meta 환경에서는 semo-system/ 수정 후 meta-workflow 호출을 강제합니다.
 * 이 훅은 AI가 meta-workflow를 건너뛰지 못하도록 방지합니다.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { StopInput, TranscriptEntry } from '../lib/types.js';
import { logInteraction, closePool, getDefaultUserId, getDefaultAgentId } from '../lib/db.js';
import { parseTranscript, getLastAssistantResponse } from '../lib/transcript.js';
import { readStdinJson, debugLog } from '../utils/env.js';

interface ModificationInfo {
  hasSemoSystem: boolean;
  hasPackages: boolean;
  modifiedPaths: string[];
}

/**
 * semo-system/ 또는 packages/ 파일 수정 감지
 */
function detectModifications(entries: TranscriptEntry[]): ModificationInfo {
  const result: ModificationInfo = {
    hasSemoSystem: false,
    hasPackages: false,
    modifiedPaths: [],
  };

  for (const entry of entries) {
    if (entry.type === 'tool_use') {
      // Edit 또는 Write 도구 사용 시
      if (entry.name === 'Edit' || entry.name === 'Write') {
        const input = entry.input as { file_path?: string };
        if (input.file_path) {
          if (input.file_path.includes('semo-system/')) {
            result.hasSemoSystem = true;
            result.modifiedPaths.push(input.file_path);
          }
          if (input.file_path.includes('packages/')) {
            result.hasPackages = true;
            result.modifiedPaths.push(input.file_path);
          }
        }
      }
    }
  }

  return result;
}

/**
 * meta-workflow가 이미 호출되었는지 확인
 */
function wasMetaWorkflowCalled(entries: TranscriptEntry[]): boolean {
  for (const entry of entries) {
    // Skill 도구 호출 확인
    if (entry.type === 'tool_use' && entry.name === 'Skill') {
      const input = entry.input as { skill?: string };
      if (input.skill === 'meta-workflow') {
        return true;
      }
    }
    // 텍스트에서 meta-workflow 호출 패턴 확인
    if (entry.type === 'text' && entry.role === 'assistant') {
      const content = entry.content as string;
      if (content.includes('[SEMO] - [META] Skill: meta-workflow')) {
        return true;
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

    // Meta 환경에서 semo-system/ 또는 packages/ 수정 감지
    const isMetaEnv = isMetaEnvironment(input.cwd);

    if (isMetaEnv) {
      const modifications = detectModifications(entries);
      const hasModifications = modifications.hasSemoSystem || modifications.hasPackages;
      const metaWorkflowCalled = wasMetaWorkflowCalled(entries);

      debugLog('Stop: Meta environment check:', {
        isMetaEnv,
        hasModifications,
        metaWorkflowCalled,
        modifiedPaths: modifications.modifiedPaths,
      });

      // 수정이 있지만 meta-workflow가 호출되지 않은 경우 강제 알림
      if (hasModifications && !metaWorkflowCalled) {
        const modType = modifications.hasPackages
          ? 'semo-system/ 및 packages/'
          : 'semo-system/';

        const npmWarning = modifications.hasPackages
          ? '\n- npm publish 실행'
          : '';

        // hookSpecificOutput으로 강제 알림 반환
        const output = {
          hookSpecificOutput: {
            hookEventName: "Stop",
            additionalContext: `[SEMO] ⚠️ ${modType} 수정 감지 - meta-workflow 미실행

수정된 경로:
${modifications.modifiedPaths.map(p => `- ${p}`).join('\n')}

**반드시 다음 작업을 완료하세요:**
- skill:meta-workflow 호출
- VERSION 범프 및 CHANGELOG 작성
- git commit & push${npmWarning}
- Slack 알림 발송

이 메시지는 meta-workflow가 호출될 때까지 매 응답마다 표시됩니다.`
          }
        };
        console.log(JSON.stringify(output));
      }
    }

    debugLog('Stop completed');
  } finally {
    await closePool();
  }
}
