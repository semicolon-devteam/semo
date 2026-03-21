/**
 * SEMO Dashboard constants
 */

/**
 * Get bot workspace path (GitHub API path format)
 * @param botId Bot identifier
 * @returns GitHub path for bot workspace
 */
export function getBotWorkspacePath(botId: string): string {
  return `~/.openclaw-${botId}/workspace`;
}
