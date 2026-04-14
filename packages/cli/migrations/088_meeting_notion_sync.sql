ALTER TABLE semo.meetings
  ADD COLUMN IF NOT EXISTS notion_page_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notion_url TEXT,
  ADD COLUMN IF NOT EXISTS notion_sync_status VARCHAR(20) DEFAULT 'pending'
    CHECK (notion_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS notion_sync_error TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_notion_sync
  ON semo.meetings(notion_sync_status)
  WHERE notion_sync_status = 'failed';
