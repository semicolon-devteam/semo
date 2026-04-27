-- 112: pipeline 키 스키마 정합화 + role/po 트리거 services 드리프트 복구
--
-- 두 이슈 동시 수정:
--   1. `semo kb upsert <domain> role po` 가 `relation "semo.services" does not exist` 로 실패
--      (migration 072 가 만든 trg_sync_role_po 트리거가 migration 101 에서 DROP 된 services 테이블을 참조)
--   2. service 타입 `pipeline` 키가 schema=singleton 이지만 실제 데이터는 sub_key='config' (migration-100 이식 + SoT 문서)
--      → 신규 도메인 등록 시 sub_key='' 로 들어가 도메인 간 형태 갈라짐
--
-- KB 트래킹:
--   - semo process kb-role-upsert-services-drift  (2026-04-27)
--   - semo process pipeline-key-schema-sot-mismatch (2026-04-27)
--
-- 선행 조건: 111

BEGIN;

-- ============================================================
-- 1. role/po 동기화 트리거 재구성: services 테이블 → KB pipeline/config metadata
-- ============================================================
-- 기존 트리거는 DROP 된 semo.services.owner_name 을 UPDATE 하려 해서 항상 실패.
-- pipeline/config metadata.owner_name 이 이제 SoT 이므로 그곳을 업데이트한다.
-- 무한 재귀 방지: pipeline/config 업데이트는 key='role' 조건과 매칭되지 않으므로 트리거 재진입 없음.

DROP TRIGGER IF EXISTS trg_sync_role_po ON semo.knowledge_base;

CREATE OR REPLACE FUNCTION semo.sync_role_po_to_owner()
RETURNS TRIGGER AS $$
DECLARE
  _owner text;
BEGIN
  IF NEW.key = 'role' AND NEW.sub_key = 'po' THEN
    _owner := TRIM(SPLIT_PART(NEW.content, ',', 1));
    UPDATE semo.knowledge_base
       SET metadata  = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{owner_name}', to_jsonb(_owner), true),
           updated_at = NOW()
     WHERE domain = NEW.domain
       AND key = 'pipeline'
       AND sub_key = 'config';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_role_po
  AFTER INSERT OR UPDATE ON semo.knowledge_base
  FOR EACH ROW
  WHEN (NEW.key = 'role' AND NEW.sub_key = 'po')
  EXECUTE FUNCTION semo.sync_role_po_to_owner();

-- ============================================================
-- 2. pipeline 키 schema: singleton → collection (sub_key='config' SoT)
-- ============================================================
-- 기존 17개 도메인은 sub_key='config' 로 존재 (migration-100).
-- service-metadata-sot 문서, 글로벌 CLAUDE.md, 코드(channel-router, dashboard 등)
-- 모두 'pipeline/config' 를 가정. schema 만 어긋나 있어 schema 를 데이터에 맞춘다.

UPDATE semo.kb_type_schema
   SET key_type = 'collection',
       value_hint = 'sub_key=''config'' 고정. metadata: {service_id, project_name, owner_name, current_phase, infra_phase, status, lifecycle, service_type, parent_service_id, tech_stack, service_url, repo, slack_channel, launched_at, ...}',
       scheme_description = '프로젝트 파이프라인 워크플로우 상태 (sub_key=''config'' 단일 사용)'
 WHERE type_key = 'service'
   AND scheme_key = 'pipeline';

-- ============================================================
-- 3. 신규 등록 도메인 백필: pipeline (sub_key='') → pipeline/config
-- ============================================================
-- migration-100 이후 등록되었지만 schema=singleton 강제로 sub_key='' 로 들어간 행을
-- sub_key='config' 로 이동. 충돌 시(이미 config 가 있으면) sub_key='' 행은 그대로 두고
-- 사람이 확인 후 정리하도록 남긴다.

UPDATE semo.knowledge_base AS kb
   SET sub_key = 'config',
       updated_at = NOW()
 WHERE key = 'pipeline'
   AND sub_key = ''
   AND NOT EXISTS (
     SELECT 1 FROM semo.knowledge_base kb2
      WHERE kb2.domain = kb.domain
        AND kb2.key = 'pipeline'
        AND kb2.sub_key = 'config'
   );

COMMIT;
