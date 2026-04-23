-- 099: Phase 3 — service_sections (141건) KB 이식 + DROP
-- 코드는 이미 KB 기반으로 전환됨 (section/{track}/{phase}/{section_key})

-- 1. service_sections → KB section/{track}/{phase}/{section_key}
-- drift 복구: 이미 DROP 된 소스 테이블은 to_regclass 가드로 skip (2026-04-23)
DO $$
DECLARE
  rec RECORD;
  _domain TEXT;
  _sub_key TEXT;
BEGIN
  IF to_regclass('semo.service_sections') IS NULL OR to_regclass('semo.services') IS NULL THEN
    RAISE NOTICE '099-1 skipped: source tables already dropped';
    RETURN;
  END IF;
  FOR rec IN SELECT * FROM semo.service_sections LOOP
    SELECT service_domain INTO _domain FROM semo.services WHERE service_id = rec.service_id;
    IF _domain IS NOT NULL THEN
      _sub_key := COALESCE(rec.track, 'plan') || '/' || rec.phase || '/' || rec.section_key;

      INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, metadata)
      VALUES (
        _domain, 'section', _sub_key,
        COALESCE(rec.content, ''),
        'migration-099',
        jsonb_build_object(
          'section_id', _sub_key,
          'service_id', rec.service_id,
          'phase', rec.phase,
          'track', COALESCE(rec.track, 'plan'),
          'section_key', rec.section_key,
          'title', COALESCE(rec.title, ''),
          'ordinal', COALESCE(rec.ordinal, 0),
          'status', COALESCE(rec.status, 'draft'),
          'source', COALESCE(rec.source, 'manual'),
          'reviewer_note', rec.reviewer_note,
          'qa_items', COALESCE(rec.qa_items, 'null'::jsonb),
          'slack_thread_ts', rec.slack_thread_ts,
          'kb_written_at', rec.kb_written_at::text,
          'created_at', rec.created_at::text
        )
      )
      ON CONFLICT (domain, key, sub_key) DO UPDATE SET
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    END IF;
  END LOOP;
END $$;

-- 2. 테이블 DROP
DROP TABLE IF EXISTS semo.service_sections CASCADE;
