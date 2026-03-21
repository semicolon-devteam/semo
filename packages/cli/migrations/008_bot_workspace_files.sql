-- Bot workspace file storage for Dashboard DB-based access
-- Replaces local filesystem reads with DB queries

CREATE TABLE IF NOT EXISTS semo.bot_workspace_files (
    bot_id      TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    content     TEXT NOT NULL,
    file_size   INTEGER,
    file_hash   TEXT,                   -- SHA-256, 변경 감지용
    synced_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (bot_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_bwf_bot ON semo.bot_workspace_files(bot_id);
