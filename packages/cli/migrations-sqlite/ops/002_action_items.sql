-- 002: action_items — Personal 프로파일용 SQLite 스키마.
--
-- PG semo.action_items (migration 069 이후) 의 SQLite 등가 변환:
--   UUID/VARCHAR/TEXT   → TEXT
--   SMALLINT/INTEGER    → INTEGER
--   TIMESTAMPTZ/DATE    → TEXT (ISO 8601 / YYYY-MM-DD, UTC)
--   JSONB               → TEXT (JSON string, 앱 레이어에서 parse)
--   NOW()               → datetime('now')  — UTC
--   FK to semo.ontology → 제거 (Personal ops.db 엔 ontology 테이블 없음)
--
-- UUID 생성은 앱 레이어(`crypto.randomUUID()`) 가 담당. SQLite DEFAULT 로는 생성 못 함.

CREATE TABLE IF NOT EXISTS action_items (
  action_item_id  TEXT PRIMARY KEY,
  owner_domain    TEXT NOT NULL,
  target_domain   TEXT,
  iteration_id    TEXT,
  description     TEXT NOT NULL,
  assignee        TEXT,
  deadline        TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  priority        TEXT NOT NULL DEFAULT 'normal',
  category        TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',
  related_url     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  completed_at    TEXT,
  metadata        TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_owner_status
  ON action_items(owner_domain, status);

CREATE INDEX IF NOT EXISTS idx_ai_target_status
  ON action_items(target_domain, status)
  WHERE target_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_created
  ON action_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_deadline
  ON action_items(deadline)
  WHERE deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_sort
  ON action_items(sort_order);
