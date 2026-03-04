/**
 * PermissionRequest Hook (semo-remote)
 *
 * 트리거: 도구 실행 권한 요청 시
 * 동작:
 *   1. 권한 요청을 DB에 저장
 *   2. 모바일 PWA에서 응답 대기 (polling)
 *   3. 응답에 따라 allow/deny 반환
 */

import type { PermissionRequestInput, PermissionRequestOutput } from '../lib/types.js';
import {
  createRemoteRequest,
  pollRemoteResponse,
  updateRemoteSessionStatus,
  closePool,
  isDbEnabled,
} from '../lib/db.js';
import { readStdinJson, writeStdoutJson, debugLog } from '../utils/env.js';

// Remote 기능 활성화 여부 (환경변수로 제어)
const REMOTE_ENABLED = process.env.SEMO_REMOTE_ENABLED === 'true';

// 폴링 타임아웃 (기본 30초)
const POLL_TIMEOUT_MS = parseInt(process.env.SEMO_REMOTE_TIMEOUT || '30000');

export async function handlePermissionRequest(): Promise<void> {
  try {
    const input = await readStdinJson<PermissionRequestInput>();

    debugLog('PermissionRequest input:', {
      session_id: input.session_id,
      tool_name: input.tool_name,
    });

    // Remote 기능이 비활성화된 경우 - 바로 통과 (exit 0, 출력 없음)
    if (!REMOTE_ENABLED || !isDbEnabled()) {
      debugLog('Remote disabled, passing through');
      return;
    }

    // 세션 상태를 waiting_input으로 업데이트
    await updateRemoteSessionStatus(input.session_id, 'waiting_input');

    // 권한 요청을 DB에 저장
    const requestId = await createRemoteRequest({
      session_id: input.session_id,
      type: 'permission',
      tool_name: input.tool_name,
      message: `도구 실행 권한 요청: ${input.tool_name}`,
      metadata: {
        tool_input: input.tool_input,
        cwd: input.cwd,
      },
    });

    if (!requestId) {
      debugLog('Failed to create remote request');
      return; // DB 실패 시 통과
    }

    debugLog('Created remote request:', requestId);

    // 모바일 응답 대기 (polling)
    const response = await pollRemoteResponse(requestId, POLL_TIMEOUT_MS, 1000);

    // 세션 상태를 active로 복원
    await updateRemoteSessionStatus(input.session_id, 'active');

    // 응답이 없거나 타임아웃 - 기본 동작 (통과)
    if (!response) {
      debugLog('No response or timeout, passing through');
      return;
    }

    // 응답에 따라 allow/deny
    const output: PermissionRequestOutput = {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: response.status === 'approved' ? 'allow' : 'deny',
          message: response.response || (response.status === 'approved' ? '원격 승인됨' : '원격 거부됨'),
        },
      },
    };

    writeStdoutJson(output);

    debugLog('PermissionRequest completed:', response.status);
  } finally {
    await closePool();
  }
}
