/**
 * @file lib/constants.ts
 * @description SEMO 대시보드 공용 상수 및 경로 헬퍼.
 * @module lib/constants
 */

/**
 * 봇 워크스페이스 GitHub 경로를 반환한다.
 *
 * @param botId - 봇 식별자 (e.g. "workclaw")
 * @returns 레포 내 워크스페이스 경로 (e.g. "semo-system/bot-workspaces/workclaw")
 *
 * @example
 * getBotWorkspacePath('workclaw') // "semo-system/bot-workspaces/workclaw"
 */
export function getBotWorkspacePath(botId: string): string {
  return `semo-system/bot-workspaces/${botId}`;
}
