-- 097: Phase 1 — 빈/최소 데이터 service 테이블 6개 DROP
-- service_iterations (0건), service_incidents (0건), service_infra_requests (0건),
-- service_research_tasks (0건), feature_discovery_sessions (1건), feature_conversation_sessions (1건)
-- 코드는 이미 KB 기반으로 전환됨

-- 1. FK 제약 제거: action_items.iteration_id → service_iterations
ALTER TABLE semo.action_items DROP COLUMN IF EXISTS iteration_id;

-- 2. FK 제약 제거: service_features.iteration_id → service_iterations
ALTER TABLE semo.service_features DROP COLUMN IF EXISTS iteration_id;

-- 3. FK 제약 제거: service_sections.iteration_id (있을 경우)
ALTER TABLE semo.service_sections DROP COLUMN IF EXISTS iteration_id;

-- 4. 기존 세션 데이터 KB로 이식 (1건씩)
-- feature_discovery_sessions → KB session/discovery/{session_id}
DO $$
DECLARE
  rec RECORD;
  _domain TEXT;
BEGIN
  FOR rec IN SELECT * FROM semo.feature_discovery_sessions LOOP
    SELECT service_domain INTO _domain FROM semo.services WHERE service_id = rec.service_id;
    IF _domain IS NOT NULL THEN
      INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, metadata)
      VALUES (
        _domain, 'session', 'discovery/' || rec.session_id,
        COALESCE(rec.source_url, ''),
        'migration-097',
        jsonb_build_object(
          'session_id', rec.session_id,
          'service_id', rec.service_id,
          'source_url', rec.source_url,
          'status', rec.status,
          'candidates', rec.candidates,
          'confirmed', rec.confirmed,
          'screenshots', rec.screenshots,
          'error', rec.error,
          'created_at', rec.created_at::text
        )
      )
      ON CONFLICT (domain, key, sub_key) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- feature_conversation_sessions → KB session/conversation/{session_id}
DO $$
DECLARE
  rec RECORD;
  _domain TEXT;
BEGIN
  FOR rec IN SELECT * FROM semo.feature_conversation_sessions LOOP
    SELECT service_domain INTO _domain FROM semo.services WHERE service_id = rec.service_id;
    IF _domain IS NOT NULL THEN
      INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, metadata)
      VALUES (
        _domain, 'session', 'conversation/' || rec.session_id,
        '',
        'migration-097',
        jsonb_build_object(
          'session_id', rec.session_id,
          'service_id', rec.service_id,
          'mode', rec.mode,
          'status', rec.status,
          'features', rec.features,
          'slack_channel', rec.slack_channel,
          'slack_thread_ts', rec.slack_thread_ts,
          'created_at', rec.created_at::text
        )
      )
      ON CONFLICT (domain, key, sub_key) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- 5. 테이블 DROP (자식 테이블 먼저)
DROP TABLE IF EXISTS semo.feature_discovery_sessions CASCADE;
DROP TABLE IF EXISTS semo.feature_conversation_sessions CASCADE;
DROP TABLE IF EXISTS semo.service_research_tasks CASCADE;
DROP TABLE IF EXISTS semo.service_infra_requests CASCADE;
DROP TABLE IF EXISTS semo.service_incidents CASCADE;
DROP TABLE IF EXISTS semo.service_iterations CASCADE;
