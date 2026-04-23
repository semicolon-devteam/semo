import type Database from 'better-sqlite3';

/**
 * Solo 프로파일에서 SQLite DB 를 사용할 때 호출되는 idempotent 초기화.
 * 실제 DDL 파일은 `packages/cli/migrations-sqlite/001_knowledge_base.sql` 에 있으나,
 * 어댑터 단독 사용 시에도 스키마가 갖춰지도록 어댑터 내부에 duplicate 을 유지한다.
 */
export const KB_DDL = `
CREATE TABLE IF NOT EXISTS knowledge_base (
  kb_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  domain      TEXT NOT NULL,
  key         TEXT NOT NULL,
  sub_key     TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL,
  metadata    TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(domain, key, sub_key)
);

CREATE INDEX IF NOT EXISTS idx_kb_domain      ON knowledge_base(domain);
CREATE INDEX IF NOT EXISTS idx_kb_created_by  ON knowledge_base(created_by);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_base_fts USING fts5(
  key, sub_key, content,
  content='knowledge_base',
  content_rowid='kb_id'
);

CREATE TABLE IF NOT EXISTS knowledge_base_vectors (
  kb_id      INTEGER PRIMARY KEY REFERENCES knowledge_base(kb_id) ON DELETE CASCADE,
  embedding  BLOB NOT NULL,
  dim        INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS knowledge_base_ai AFTER INSERT ON knowledge_base BEGIN
  INSERT INTO knowledge_base_fts(rowid, key, sub_key, content)
  VALUES (new.kb_id, new.key, new.sub_key, new.content);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_base_ad AFTER DELETE ON knowledge_base BEGIN
  INSERT INTO knowledge_base_fts(knowledge_base_fts, rowid, key, sub_key, content)
  VALUES ('delete', old.kb_id, old.key, old.sub_key, old.content);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_base_au AFTER UPDATE ON knowledge_base BEGIN
  INSERT INTO knowledge_base_fts(knowledge_base_fts, rowid, key, sub_key, content)
  VALUES ('delete', old.kb_id, old.key, old.sub_key, old.content);
  INSERT INTO knowledge_base_fts(rowid, key, sub_key, content)
  VALUES (new.kb_id, new.key, new.sub_key, new.content);
END;
`;

export function applyKbSchema(db: Database.Database): void {
  db.exec(KB_DDL);
}
