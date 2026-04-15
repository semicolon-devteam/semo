-- 098: Phase 2 — service_features(6건), service_materials(33건), 부수 3개 테이블 KB 이식 + DROP
-- 코드는 이미 KB 기반으로 전환됨 (Phase 2a+2b)

-- 1. service_features (6건) → KB feature/{feature_id}
DO $$
DECLARE
  rec RECORD;
  _domain TEXT;
  _slug TEXT;
BEGIN
  FOR rec IN SELECT * FROM semo.service_features LOOP
    SELECT service_domain INTO _domain FROM semo.services WHERE service_id = rec.service_id;
    IF _domain IS NOT NULL THEN
      _slug := lower(regexp_replace(rec.name, '[^a-zA-Z0-9가-힣]+', '-', 'g'));
      _slug := regexp_replace(_slug, '^-|-$', '', 'g');
      IF _slug = '' THEN _slug := left(rec.feature_id::text, 8); END IF;

      INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, metadata)
      VALUES (
        _domain, 'feature', rec.feature_id::text,
        COALESCE(rec.description, ''),
        'migration-098',
        jsonb_build_object(
          'feature_id', rec.feature_id,
          'slug', _slug,
          'service_id', rec.service_id,
          'name', rec.name,
          'category', COALESCE(rec.category, 'core'),
          'status', COALESCE(rec.status, 'active'),
          'parent_id', rec.parent_id,
          'sort_order', COALESCE(rec.sort_order, 0),
          'feature_metadata', COALESCE(rec.metadata, '{}'::jsonb),
          'created_at', rec.created_at::text
        )
      )
      ON CONFLICT (domain, key, sub_key) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- 2. service_materials (33건) → KB material/{material_id}
DO $$
DECLARE
  rec RECORD;
  _domain TEXT;
BEGIN
  FOR rec IN SELECT * FROM semo.service_materials LOOP
    SELECT service_domain INTO _domain FROM semo.services WHERE service_id = rec.service_id;
    IF _domain IS NOT NULL THEN
      INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, metadata)
      VALUES (
        _domain, 'material', rec.material_id::text,
        COALESCE(rec.content, ''),
        'migration-098',
        jsonb_build_object(
          'material_id', rec.material_id,
          'service_id', rec.service_id,
          'material_type', COALESCE(rec.material_type, 'planning-doc'),
          'phase_mapping', COALESCE(rec.phase_mapping, 'null'::jsonb),
          'screenshot_data', rec.screenshot_data,
          'stitch_share_url', rec.stitch_share_url,
          'created_at', rec.created_at::text
        )
      )
      ON CONFLICT (domain, key, sub_key) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- 3. deploy_verifications → KB deploy-verify/{infra_phase}/{date}
DO $$
DECLARE
  rec RECORD;
  _domain TEXT;
  _date TEXT;
BEGIN
  FOR rec IN SELECT * FROM semo.deploy_verifications LOOP
    SELECT service_domain INTO _domain FROM semo.services WHERE service_id = rec.service_id;
    IF _domain IS NOT NULL THEN
      _date := to_char(rec.created_at, 'YYYY-MM-DD');
      INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, metadata)
      VALUES (
        _domain, 'deploy-verify', rec.infra_phase || '/' || _date,
        '',
        'migration-098',
        jsonb_build_object(
          'verification_id', rec.verification_id,
          'service_id', rec.service_id,
          'infra_phase', rec.infra_phase,
          'checks', rec.checks,
          'overall_status', rec.overall_status,
          'verified_by', rec.verified_by,
          'created_at', rec.created_at::text
        )
      )
      ON CONFLICT (domain, key, sub_key) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- 4. 테이블 DROP
DROP TABLE IF EXISTS semo.feature_status_transitions CASCADE;
DROP TABLE IF EXISTS semo.deploy_verifications CASCADE;
DROP TABLE IF EXISTS semo.service_kpi_metrics CASCADE;
DROP TABLE IF EXISTS semo.service_features CASCADE;
DROP TABLE IF EXISTS semo.service_materials CASCADE;
