/**
 * Detects whether a bot session is currently busy processing a message.
 * Uses the _current file (written by mailbox.markCurrent, cleared by clearCurrent)
 * and heartbeat freshness to distinguish "busy" from "dead".
 */
import * as fs from 'fs';
import * as path from 'path';

const HEARTBEAT_STALE_MS = 2 * 60_000; // 2 minutes — matches health-monitor threshold

export class BusyDetector {
  constructor(private readonly mailboxDir: string) {}

  /**
   * Returns true if the bot is alive AND currently processing a message.
   * - _current file non-empty → message in progress
   * - heartbeat fresh (< 2 min) → session is alive
   * - If heartbeat is stale, bot is dead/hung — not "busy" (health monitor will restart)
   */
  isBusy(botId: string): boolean {
    const currentPath = path.join(this.mailboxDir, botId, '_current');
    const heartbeatPath = path.join(this.mailboxDir, botId, 'heartbeat');

    // Check _current file
    let hasCurrentMessage = false;
    try {
      const content = fs.readFileSync(currentPath, 'utf8').trim();
      hasCurrentMessage = content.length > 0;
    } catch {
      return false; // No _current file → idle
    }

    if (!hasCurrentMessage) return false;

    // Verify bot is alive (heartbeat fresh)
    try {
      const stat = fs.statSync(heartbeatPath);
      const age = Date.now() - stat.mtimeMs;
      return age < HEARTBEAT_STALE_MS;
    } catch {
      return false; // No heartbeat → dead, not busy
    }
  }
}
