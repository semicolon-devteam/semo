-- SQLite DDL for SEMO KB (mirrors semo.knowledge_base on PG).
-- Solo profiles: used by SqliteKbStore.
--
-- Phase 2 initial: FTS5 keyword search. Vector search is wired separately via
-- sqlite-vec extension if loadable; otherwise `search()` falls back to FTS5.

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

-- FTS5 full-text index over content + key (no porter — multilingual content).
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_base_fts USING fts5(
  key,
  sub_key,
  content,
  content='knowledge_base',
  content_rowid='kb_id'
);

-- Optional vector column (binary blob). Populated by sqlite-vec when available;
-- otherwise left NULL and search falls back to FTS5.
CREATE TABLE IF NOT EXISTS knowledge_base_vectors (
  kb_id      INTEGER PRIMARY KEY REFERENCES knowledge_base(kb_id) ON DELETE CASCADE,
  embedding  BLOB NOT NULL,
  dim        INTEGER NOT NULL
);

-- Triggers: keep FTS in sync.
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
