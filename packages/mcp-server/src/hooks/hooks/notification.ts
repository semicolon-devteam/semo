/**
 * Notification Hook (semo-remote)
 *
 * 트리거: 알림 발생 시 (idle_prompt, permission_prompt 등)
 * 동작:
 *   - idle_prompt: 60초+ 입력 대기 시 모바일 알림 전송
 *   - permission_prompt: 권한 프롬프트 표시 시 (PermissionRequest Hook과 중복 방지)
 */

import type { NotificationInput, NotificationOutput } from '../lib/types.js';
import {
  createRemoteRequest,
  updateRemoteSessionStatus,
  closePool,
  isDbEnabled,
} from '../lib/db.js';
import { readStdinJson, writeStdoutJson, debugLog } from '../utils/env.js';

// Remote 기능 활성화 여부
const REMOTE_ENABLED = process.env.SEMO_REMOTE_ENABLED === 'true';

export async function handleNotification(): Promise<void> {
  try {
    const input = await readStdinJson<NotificationInput>();

    debugLog('Notification input:', {
      session_id: input.session_id,
      notification_type: input.notification_type,
    });

    // Remote 기능이 비활성화된 경우 - 통과
    if (!REMOTE_ENABLED || !isDbEnabled()) {
      debugLog('Remote disabled, passing through');
      return;
    }

    // notification_type에 따른 처리
    switch (input.notification_type) {
      case 'idle_prompt':
        // 60초+ 입력 대기 - 세션 상태 업데이트 및 알림
        await updateRemoteSessionStatus(input.session_id, 'idle');
        await createRemoteRequest({
          session_id: input.session_id,
          type: 'text_input',
          message: input.message || 'Claude가 입력을 기다리고 있습니다.',
          metadata: {
            notification_type: 'idle_prompt',
            cwd: input.cwd,
          },
        });
        debugLog('Idle prompt notification created');
        break;

      case 'permission_prompt':
        // PermissionRequest Hook에서 이미 처리됨 - 중복 방지
        debugLog('Permission prompt - handled by PermissionRequest hook');
        break;

      case 'auth_success':
        // 인증 성공 - 로그만
        debugLog('Auth success notification');
        break;

      case 'elicitation_dialog':
        // 다이얼로그 표시 - 사용자 질문으로 처리
        await updateRemoteSessionStatus(input.session_id, 'waiting_input');
        await createRemoteRequest({
          session_id: input.session_id,
          type: 'user_question',
          message: input.message || '사용자 입력이 필요합니다.',
          metadata: {
            notification_type: 'elicitation_dialog',
            cwd: input.cwd,
          },
        });
        debugLog('Elicitation dialog notification created');
        break;

      default:
        debugLog('Unknown notification type:', input.notification_type);
    }

    // Notification Hook은 출력 없이 통과
    // (필요 시 additionalContext 추가 가능)

  } finally {
    await closePool();
  }
}
