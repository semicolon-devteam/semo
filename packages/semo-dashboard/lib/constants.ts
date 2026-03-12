/**
 * SEMO Dashboard constants
 */

/**
 * Get bot workspace path
 * @param botId Bot identifier
 * @returns Full workspace path
 */
export function getBotWorkspacePath(botId: string): string {
  return `semo-system/bot-workspaces/${botId}`;
}
