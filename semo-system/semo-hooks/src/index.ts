#!/usr/bin/env node
/**
 * semo-hooks CLI 엔트리포인트
 *
 * Claude Code Hooks에서 호출되는 CLI 라우터
 * 사용법: node dist/index.js <command>
 *
 * Commands:
 *   session-start  - SessionStart hook 처리
 *   session-end    - SessionEnd hook 처리
 *   user-prompt    - UserPromptSubmit hook 처리
 *   stop           - Stop hook 처리
 */

import { handleSessionStart } from './hooks/session-start.js';
import { handleSessionEnd } from './hooks/session-end.js';
import { handleUserPrompt } from './hooks/user-prompt.js';
import { handleStop } from './hooks/stop.js';

type HookCommand = 'session-start' | 'session-end' | 'user-prompt' | 'stop';

const commands: Record<HookCommand, () => Promise<void>> = {
  'session-start': handleSessionStart,
  'session-end': handleSessionEnd,
  'user-prompt': handleUserPrompt,
  'stop': handleStop,
};

async function main(): Promise<void> {
  const command = process.argv[2] as HookCommand | undefined;

  if (!command || !(command in commands)) {
    console.error(`Usage: semo-hooks <command>

Commands:
  session-start  SessionStart hook
  session-end    SessionEnd hook
  user-prompt    UserPromptSubmit hook
  stop           Stop hook
`);
    process.exit(1);
  }

  try {
    await commands[command]();
  } catch (error) {
    // Hook 실패 시 조용히 실패 (exit 0)
    // 메인 Claude Code 플로우에 영향 없음
    if (process.env.SEMO_HOOKS_DEBUG) {
      console.error('[semo-hooks] Error:', error);
    }
    process.exit(0);
  }
}

main();
