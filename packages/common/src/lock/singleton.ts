/**
 * Singleton lockfile — prevent duplicate router/daemon instances.
 *
 * 사용:
 *   acquireSingletonLock('slack-router');
 *   // 다른 인스턴스가 살아있으면 process.exit(2) — Slack Socket Mode race 방지.
 *
 * 배경: 2026-05-01 인시던트 — slack-router 가 두 인스턴스 동시 실행되어
 * Slack Socket Mode 가 한 쪽을 kick off + 같은 로그 파일을 overwrite truncate.
 * 결정: semo decision/router-cmux-nudge-persistence (후속 backlog).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const LOCK_DIR = path.join(os.homedir(), '.semo', 'run');

export interface SingletonLockOptions {
  /** Lock file basename without extension. e.g. 'slack-router' → ~/.semo/run/slack-router.pid */
  name: string;
  /** Substring expected in the existing process command (validates not a PID-reuse). */
  cmdMatch: string;
  /** If true, log details before exit. Default true. */
  verbose?: boolean;
}

function isProcessAlive(pid: number, cmdMatch: string): boolean {
  try {
    // signal 0 — checks existence without sending.
    process.kill(pid, 0);
  } catch {
    return false;
  }
  // Validate command line to detect PID reuse.
  try {
    const cmd = execSync(`ps -p ${pid} -o command=`, { encoding: 'utf-8', timeout: 2000 }).trim();
    return cmd.includes(cmdMatch);
  } catch {
    // ps failed — assume the PID belongs to us (conservative: block startup).
    return true;
  }
}

/**
 * Acquire a singleton lock. Aborts the process (exit 2) if another live
 * instance with matching command already holds the lock.
 *
 * @returns the lock file path (caller may unlink on graceful shutdown).
 */
export function acquireSingletonLock(opts: SingletonLockOptions): string {
  const { name, cmdMatch, verbose = true } = opts;
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const lockPath = path.join(LOCK_DIR, `${name}.pid`);

  if (fs.existsSync(lockPath)) {
    const raw = fs.readFileSync(lockPath, 'utf-8').trim();
    const existingPid = Number.parseInt(raw, 10);
    if (Number.isFinite(existingPid) && existingPid > 0 && existingPid !== process.pid) {
      if (isProcessAlive(existingPid, cmdMatch)) {
        if (verbose) {
          console.error(
            `[singleton-lock] ${name} already running (pid=${existingPid}). ` +
              `Refusing to start a duplicate. Lock: ${lockPath}`,
          );
        }
        process.exit(2);
      }
      if (verbose) {
        console.warn(
          `[singleton-lock] ${name}: stale lock (pid=${existingPid} dead) — overwriting.`,
        );
      }
    }
  }

  fs.writeFileSync(lockPath, String(process.pid), { encoding: 'utf-8' });

  // Best-effort cleanup on graceful exit. SIGKILL/uncaught crashes leave a
  // stale lock, which the next acquire will detect and overwrite.
  const release = (): void => {
    try {
      const raw = fs.readFileSync(lockPath, 'utf-8').trim();
      if (Number.parseInt(raw, 10) === process.pid) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      // already gone
    }
  };
  process.on('exit', release);
  process.on('SIGINT', () => {
    release();
  });
  process.on('SIGTERM', () => {
    release();
  });

  return lockPath;
}
