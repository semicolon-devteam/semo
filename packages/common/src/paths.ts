import * as path from 'path';
import { envDual, resolveSemoHome } from './env.js';

// SEMO→semicolony 호환: 홈/세션/메일박스 모두 dual-read (SEMICOLONY_* > SEMO_* > default).
// Phase 0 단계 default 는 ~/.semo 라 동작 불변.
const SEMO_ROOT = resolveSemoHome();
const sessionsDir = envDual('SESSION_DIR') ?? path.join(SEMO_ROOT, 'sessions');
const mailboxDir = envDual('MAILBOX_DIR') ?? path.join(SEMO_ROOT, 'mailbox');
const workspacesDir = path.join(SEMO_ROOT, 'workspaces');

export const SEMO_PATHS = {
  root: SEMO_ROOT,
  shared: path.join(SEMO_ROOT, 'shared'),
  sessions: sessionsDir,
  mailbox: mailboxDir,
  workspaces: workspacesDir,
  pidFile: path.join(SEMO_ROOT, 'agents.pid'),
  hooks: path.join(SEMO_ROOT, 'shared', 'hooks'),

  botSession: (botId: string) => path.join(sessionsDir, botId),
  botMailbox: (botId: string) => path.join(mailboxDir, botId),
  botWorkspace: (botId: string) => path.join(workspacesDir, botId),
} as const;

/** SEMO→semicolony 리브랜딩 alias. 신규 코드는 SEMICOLONY_PATHS 를 쓰도록 점진 전환. */
export const SEMICOLONY_PATHS = SEMO_PATHS;

export function resolveBotWorkspace(botId: string): string {
  return path.join(workspacesDir, botId);
}
