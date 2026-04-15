import * as path from 'path';
import * as os from 'os';

const SEMO_ROOT = path.join(os.homedir(), '.semo');

export const SEMO_WORKSPACES = path.join(SEMO_ROOT, 'workspaces');

export function resolveBotWorkspace(botId: string): string {
  return path.join(SEMO_WORKSPACES, botId);
}
