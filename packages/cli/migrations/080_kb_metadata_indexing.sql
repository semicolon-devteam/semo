-- 080: GIN index on knowledge_base.metadata for JSONB filtering queries
-- Enables KB as universal data layer with metadata-based querying

CREATE INDEX IF NOT EXISTS idx_kb_metadata_gin
  ON semo.knowledge_base USING GIN(metadata jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_kb_metadata_status
  ON semo.knowledge_base((metadata->>'status'))
  WHERE metadata->>'status' IS NOT NULL;
