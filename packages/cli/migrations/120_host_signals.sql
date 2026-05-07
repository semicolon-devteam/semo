-- 120_host_signals
--
-- BE-1 v2 — host filesystem signal snapshots for /api/system/health.
-- 액션아이템 3ac42503 의 후속 인프라.
--
-- 배경:
--   semo-dashboard (Next.js) 는 OKE Docker pod 안에서 동작 → host 의 pgrep / PID 파일 /
--   ~/.openclaw-{bot}/auth-profiles.json / log 파일에 직접 접근 불가.
--
--   따라서 v2 는 push 모델로 동작:
--     1. host(=Reus Mac mini) 에서 동작하는 sidecar daemon (별 트랙) 이 pgrep/PID/auth
--        파일을 주기적으로 스캔
--     2. 결과 스냅샷을 이 테이블에 UPSERT
--     3. dashboard /api/system/health 는 이 테이블을 읽어 신선한 (recorded_at >
--        NOW() - 5min) 행만 client 응답에 포함
--
-- v1 (DB-only) 와 호환: 이 테이블이 비어있어도 API 는 정상 동작 (host_signals=null/empty).

BEGIN;

CREATE TABLE IF NOT EXISTS semo.host_signals (
  id            BIGSERIAL PRIMARY KEY,
  source_host   TEXT NOT NULL,            -- 예: 'reus-mac-mini' — sidecar self-id
  signal_type   TEXT NOT NULL CHECK (signal_type IN (
    'process',          -- pgrep 결과 (slack-router/discord-router/openclaw-gateway)
    'pid_file',         -- ~/.semo/run/*.pid 살아있는 PID
    'auth_profile',     -- auth-profiles.json expires + token 형식
    'log_grep',         -- 로그 패턴 매칭 (Slack connected/socket failed 등)
    'ancestry'          -- ps PPID/TTY 검증 (cmux ancestry 가드와 동일)
  )),
  target_id     TEXT NOT NULL,            -- bot_id 또는 process 이름 (예: 'slack-router', 'planclaw')
  status        TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'fail', 'expired', 'unknown')),
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- pid, ppid, tty, expires_at, log_tail 등 구체적인 값
  observed_at   TIMESTAMPTZ NOT NULL,     -- sidecar 가 관측한 실제 시점
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,              -- 명시적 TTL — 없으면 freshness 만 사용
  UNIQUE (source_host, signal_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_host_signals_recent
  ON semo.host_signals (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_host_signals_target
  ON semo.host_signals (target_id, signal_type, recorded_at DESC);

COMMENT ON TABLE semo.host_signals IS
  'Host-level filesystem/process signals pushed by sidecar daemons. '
  'semo-dashboard reads only — write path is sidecar (host-resident) '
  'because dashboard pod has no host fs/process access. Migration 120, 2026-05-07.';

COMMIT;
