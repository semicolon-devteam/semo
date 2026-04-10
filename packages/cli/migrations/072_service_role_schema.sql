-- 072: 서비스 Role 시스템 표준화
--
-- 변경 사항:
--   1. kb_type_schema에 'role' collection 키 추가 (service 타입)
--   2. 사용되지 않는 'members' 키 제거
--   3. role/po upsert 시 services.owner_name 자동 동기화 trigger
--
-- 배경:
--   서비스별 역할(PO, 개발, 디자인 등)이 base-information에 자유형으로 섞여있어
--   검색/조회 불가. role/{role-name} collection 키로 표준화.
--
-- 선행 조건: 071

BEGIN;

-- ============================================================
-- 1. role collection 키 추가
-- ============================================================

INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order, key_type)
VALUES ('service', 'role', '서비스 역할 매핑 (PO, 개발, 디자인 등)', false,
        'role/po, role/lead-dev, role/backend, role/frontend, role/designer, role/ops, role/planner. content는 ontology team 도메인 (소문자). 복수: 쉼표 구분.', 15, 'collection')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. members 키 제거 (dead key — 전체 서비스 KB 엔트리 0건)
-- ============================================================

DELETE FROM semo.kb_type_schema
WHERE type_key = 'service' AND scheme_key = 'members';

-- ============================================================
-- 3. role/po → services.owner_name 동기화 trigger
-- ============================================================

CREATE OR REPLACE FUNCTION semo.sync_role_po_to_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.key = 'role' AND NEW.sub_key = 'po' THEN
    UPDATE semo.services
    SET owner_name = TRIM(SPLIT_PART(NEW.content, ',', 1))
    WHERE service_domain = NEW.domain;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 trigger가 있으면 교체
DROP TRIGGER IF EXISTS trg_sync_role_po ON semo.knowledge_base;

CREATE TRIGGER trg_sync_role_po
  AFTER INSERT OR UPDATE ON semo.knowledge_base
  FOR EACH ROW
  WHEN (NEW.key = 'role' AND NEW.sub_key = 'po')
  EXECUTE FUNCTION semo.sync_role_po_to_owner();

COMMIT;
