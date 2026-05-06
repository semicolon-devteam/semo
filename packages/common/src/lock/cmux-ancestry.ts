/**
 * cmux pane 자손 검증 가드 — router 류가 daemon(launchd/nohup) 으로 띄워지면
 * cmux nudge 가 침묵 실패한다 (router-operations.md 의 NON-NEGOTIABLE).
 *
 * 부팅 시점에 호출하여 daemon 화 감지 시 즉시 process.exit(1).
 *
 * 우회: SEMO_SKIP_ANCESTRY_CHECK=1 (테스트/예외 운영용).
 *
 * 배경: KB semo decision/router-cmux-nudge-persistence (2026-05-01)
 *       후속 액션 — semo action-items 7db6a0cd (재발 예방).
 */

export interface CmuxAncestryCheckOptions {
  /** 호출 컨텍스트 이름 (로그 prefix). 예: "slack-router", "discord-router". */
  name: string;
  /**
   * fatal 모드 (default true) — daemon 감지 시 process.exit(1).
   * false 로 두면 경고만 찍고 계속 진행.
   */
  fatal?: boolean;
}

export interface CmuxAncestryCheckResult {
  ok: boolean;
  ppid: number;
  hasCmuxEnv: boolean;
  reason?: string;
}

/**
 * cmux pane ancestry 검증.
 *
 * 시그널:
 * - process.ppid === 1 → launchd 자손 = daemon 화
 * - CMUX_* env var 부재 → cmux pane shell 자손 아님
 *
 * 둘 중 하나라도 daemon 시그널이면 fail.
 */
export function assertCmuxAncestry(opts: CmuxAncestryCheckOptions): CmuxAncestryCheckResult {
  const { name, fatal = true } = opts;
  if (process.env.SEMO_SKIP_ANCESTRY_CHECK === '1') {
    console.warn(`[${name}] cmux ancestry check skipped (SEMO_SKIP_ANCESTRY_CHECK=1)`);
    return { ok: true, ppid: process.ppid, hasCmuxEnv: false, reason: 'skipped' };
  }

  const ppid = process.ppid;
  const hasCmuxEnv = !!(
    process.env.CMUX_SURFACE_ID ||
    process.env.CMUX_PANE_ID ||
    process.env.CMUX_PANEL_ID ||
    process.env.CMUX_WORKSPACE_ID ||
    process.env.CMUX_SOCKET_PATH
  );

  // PPID === 1 (launchd / init) 은 명백히 daemon. macOS launchctl, Linux systemd 모두 동일.
  const isDaemonPpid = ppid === 1;

  if (isDaemonPpid || !hasCmuxEnv) {
    const reason = isDaemonPpid
      ? `daemon 화 감지 (ppid=${ppid}, launchd/init 자손)`
      : `cmux env var 부재 (CMUX_* 없음, ppid=${ppid})`;
    const msg =
      `[${name}] FATAL: cmux pane 자손이 아닙니다 — ${reason}.\n` +
      `cmux nudge 가 침묵 실패합니다 (router-operations.md NON-NEGOTIABLE).\n` +
      `해결: 살아있는 cmux pane 안에서 router 를 띄우세요. 예시는 router-operations.md 참조.\n` +
      `우회: SEMO_SKIP_ANCESTRY_CHECK=1 (긴급 테스트용)`;
    if (fatal) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg);
    return { ok: false, ppid, hasCmuxEnv, reason };
  }

  console.log(`[${name}] cmux ancestry OK (ppid=${ppid})`);
  return { ok: true, ppid, hasCmuxEnv };
}
