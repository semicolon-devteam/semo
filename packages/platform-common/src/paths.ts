import * as path from 'path';
import * as os from 'os';

const SEMO_ROOT = path.join(os.homedir(), '.semo');
const sessionsDir = process.env.SEMO_SESSION_DIR ?? path.join(SEMO_ROOT, 'sessions');
const mailboxDir = process.env.SEMO_MAILBOX_DIR ?? path.join(SEMO_ROOT, 'mailbox');
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

export function resolveBotWorkspace(botId: string): string {
  return path.join(workspacesDir, botId);
}
