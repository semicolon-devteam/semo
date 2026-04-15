import * as path from 'path';
import * as os from 'os';

const HOME = os.homedir();
const SEMO_ROOT = path.join(HOME, '.semo');
const sessionsDir = process.env.SEMO_SESSION_DIR ?? path.join(SEMO_ROOT, 'sessions');
const mailboxDir = process.env.SEMO_MAILBOX_DIR ?? path.join(SEMO_ROOT, 'mailbox');

export const SEMO_PATHS = {
  root: SEMO_ROOT,
  shared: path.join(SEMO_ROOT, 'shared'),
  sessions: sessionsDir,
  mailbox: mailboxDir,
  pidFile: path.join(SEMO_ROOT, 'agents.pid'),
  hooks: path.join(SEMO_ROOT, 'shared', 'hooks'),

  botSession: (botId: string) => path.join(sessionsDir, botId),
  botMailbox: (botId: string) => path.join(mailboxDir, botId),
} as const;
