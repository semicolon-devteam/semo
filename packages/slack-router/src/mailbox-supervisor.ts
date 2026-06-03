/**
 * mailbox-supervisor — 콜드스타트 계층. 봇 inbox 에 작업이 도착하면 `semo runtime serve --bot {id}`
 * 워커를 on-demand 로 child_process spawn 한다. cmux/surface-map 의존 0 → 동적·휴면 봇 모두 깨움.
 *
 * 안전: **opt-in 봇만** 관리(config 가 serve-worker 대상으로 표시한 봇). 라이브 OpenClaw 7봇(socket-mode)은
 *       표시 안 됐으므로 건드리지 않는다. 봇당 워커 1 은 serve 의 advisory lock 이 최종 보장(여기선 best-effort).
 *
 * 하드닝(Codex #6): detached:false + parent exit 시 SIGTERM 전파, 종료 추적, spawn backoff, max workers,
 *                   crash 시 즉시 재spawn 금지. "실패=consumed" 는 serve 의 책임(여기선 워커 생애만 관리).
 *
 * 설계: docs/superpowers/specs/2026-06-03-dynamic-agent-runtime-redesign.md (Phase 2).
 */
import { spawn, type ChildProcess } from 'node:child_process';

export interface SupervisorOptions {
  /** `semo` CLI 실행 커맨드+선행인자. 기본: ['npx','tsx','packages/cli/src/index.ts'] (repo 실행). */
  serveCommand?: string[];
  /** 워커 cwd (repo 루트). */
  cwd?: string;
  /** 동시 워커 상한. */
  maxWorkers?: number;
  /** 같은 봇 재spawn 최소 간격(ms) — crash loop 방지. */
  respawnBackoffMs?: number;
  /** 워커 ephemeral idle-exit (ms). serve 가 이 시간 동안 새 메시지 없으면 종료 → 다음 도착 시 재spawn. 0=forever. */
  idleExitMs?: number;
  /** 워커 로그 파일 디렉토리(없으면 부모 stdio inherit). */
  logDir?: string;
  /** spawn 함수 주입(테스트용). */
  spawnFn?: typeof spawn;
  /** 환경변수. */
  env?: NodeJS.ProcessEnv;
  log?: (msg: string) => void;
}

interface WorkerEntry {
  child: ChildProcess;
  startedAt: number;
}

export class MailboxSupervisor {
  private readonly workers = new Map<string, WorkerEntry>();
  private readonly lastSpawnAt = new Map<string, number>();
  private readonly serveCommand: string[];
  private readonly cwd: string;
  private readonly maxWorkers: number;
  private readonly respawnBackoffMs: number;
  private readonly idleExitMs: number;
  private readonly spawnFn: typeof spawn;
  private readonly env: NodeJS.ProcessEnv;
  private readonly log: (msg: string) => void;
  private shuttingDown = false;

  constructor(opts: SupervisorOptions = {}) {
    this.serveCommand = opts.serveCommand ?? ['npx', 'tsx', 'packages/cli/src/index.ts'];
    this.cwd = opts.cwd ?? process.cwd();
    this.maxWorkers = opts.maxWorkers ?? 12;
    this.respawnBackoffMs = opts.respawnBackoffMs ?? 15_000;
    this.idleExitMs = opts.idleExitMs ?? 60_000;
    this.spawnFn = opts.spawnFn ?? spawn;
    this.env = opts.env ?? process.env;
    this.log = opts.log ?? ((m) => console.log(m));
  }

  /** 현재 살아있는 워커 botId 들. */
  activeBots(): string[] {
    return [...this.workers.keys()];
  }

  /**
   * 봇에 작업이 도착했을 때 호출. 워커가 없고(중복 방지) 백오프/상한을 통과하면 serve 워커 spawn.
   * @returns 'spawned' | 'already-running' | 'backoff' | 'max-workers' | 'shutting-down'
   */
  ensureWorker(
    botId: string,
  ): 'spawned' | 'already-running' | 'backoff' | 'max-workers' | 'shutting-down' {
    if (this.shuttingDown) return 'shutting-down';
    if (this.workers.has(botId)) return 'already-running';
    if (this.workers.size >= this.maxWorkers) {
      this.log(`[supervisor] max workers(${this.maxWorkers}) — defer ${botId}`);
      return 'max-workers';
    }
    const last = this.lastSpawnAt.get(botId);
    if (last !== undefined && Date.now() - last < this.respawnBackoffMs) {
      return 'backoff';
    }
    this.spawnWorker(botId);
    return 'spawned';
  }

  private spawnWorker(botId: string): void {
    const [cmd, ...preArgs] = this.serveCommand;
    const args = [...preArgs, 'runtime', 'serve', '--bot', botId];
    // ephemeral: idle 초과 시 워커 자가 종료 → 새 inbox 도착 시 supervisor 가 재spawn (좀비/유휴 방지).
    if (this.idleExitMs > 0) args.push('--idle-exit-ms', String(this.idleExitMs));
    const child = this.spawnFn(cmd, args, {
      cwd: this.cwd,
      env: this.env,
      detached: false, // 부모(slack-router)와 생명주기 결합 — 부모 죽으면 같이 정리
      stdio: 'inherit',
    });
    this.lastSpawnAt.set(botId, Date.now());
    this.workers.set(botId, { child, startedAt: Date.now() });
    this.log(`[supervisor] spawned serve --bot ${botId} (pid ${child.pid ?? '?'})`);

    child.once('exit', (code, signal) => {
      this.workers.delete(botId);
      this.log(`[supervisor] worker ${botId} exited (code=${code} signal=${signal})`);
    });
    child.once('error', (err) => {
      this.workers.delete(botId);
      this.log(`[supervisor] worker ${botId} spawn error: ${err.message}`);
    });
  }

  /** 부모 종료 시 모든 워커에 SIGTERM 전파(좀비 방지). */
  shutdown(): void {
    this.shuttingDown = true;
    for (const [botId, w] of this.workers) {
      try {
        w.child.kill('SIGTERM');
        this.log(`[supervisor] SIGTERM → ${botId} (pid ${w.child.pid ?? '?'})`);
      } catch {
        /* 이미 종료 */
      }
    }
  }
}
