-- 069: action_items — Single Source of Truth 전환
--
-- 변경 사항:
--   A. owner_domain, target_domain 컬럼 추가 (ontology FK)
--   B. 기존 데이터 마이그레이션 (project_id → target_domain, assignee → owner_domain)
--   C. NOT NULL + FK 제약조건 설정
--   D. project_id 컬럼 및 깨진 FK 제거
--   E. 테이블 리네이밍: service_action_items → action_items
--   F. 새 인덱스 생성
--   G. 하위호환 VIEW 생성
--   H. KB 스키마에서 action-item 키 제거
--
-- 배경:
--   - service_action_items.project_id FK가 migration 052에서 리네이밍 누락되어 깨진 상태
--   - KB와 DB 이중 구조 → DB를 유일한 SoT로 전환
--   - 액션 아이템은 반드시 주체(owner_domain: team/person/bot)가 있어야 함
--   - 대상 서비스/프로젝트(target_domain)는 선택적
--
-- 선행 조건: 068_migrate_incubator_data.sql

BEGIN;

-- ============================================================
-- 선행 검증: semicolon 도메인 존재 확인 (B5 폴백에 필요)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM semo.ontology WHERE domain = 'semicolon') THEN
    RAISE EXCEPTION 'ontology domain "semicolon" must exist before this migration';
  END IF;
END $$;

-- ============================================================
-- A. 새 컬럼 추가
-- ============================================================

ALTER TABLE semo.service_action_items
  ADD COLUMN IF NOT EXISTS owner_domain VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_domain VARCHAR(100);

-- ============================================================
-- B. 기존 데이터 마이그레이션
-- ============================================================

-- B1: target_domain ← project_id → services.service_domain
UPDATE semo.service_action_items ai
SET target_domain = s.service_domain
FROM semo.services s
WHERE ai.project_id = s.service_id
  AND ai.target_domain IS NULL;

-- B2: owner_domain ← assignee가 ontology domain과 직접 매칭 (team 타입)
UPDATE semo.service_action_items ai
SET owner_domain = o.domain
FROM semo.ontology o
WHERE o.entity_type = 'team'
  AND LOWER(ai.assignee) = LOWER(o.domain)
  AND ai.owner_domain IS NULL;

-- B3: owner_domain ← kb-sync 메타데이터의 kb_domain
UPDATE semo.service_action_items
SET owner_domain = metadata->>'kb_domain'
WHERE owner_domain IS NULL
  AND source = 'kb-sync'
  AND metadata->>'kb_domain' IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM semo.ontology WHERE domain = metadata->>'kb_domain'
  );

-- B4: owner_domain ← assignee가 nickname과 매칭
UPDATE semo.service_action_items ai
SET owner_domain = kb.domain
FROM semo.knowledge_base kb
WHERE kb.key = 'nickname'
  AND LOWER(TRIM(kb.content)) = LOWER(ai.assignee)
  AND ai.owner_domain IS NULL;

-- B5: owner_domain 남은 NULL → target_domain 폴백, 최종적으로 'semicolon'
UPDATE semo.service_action_items
SET owner_domain = COALESCE(target_domain, 'semicolon')
WHERE owner_domain IS NULL;

-- ============================================================
-- C. NOT NULL + FK 제약조건
-- ============================================================

ALTER TABLE semo.service_action_items
  ALTER COLUMN owner_domain SET NOT NULL;

ALTER TABLE semo.service_action_items
  ADD CONSTRAINT action_items_owner_domain_fkey
    FOREIGN KEY (owner_domain) REFERENCES semo.ontology(domain);

ALTER TABLE semo.service_action_items
  ADD CONSTRAINT action_items_target_domain_fkey
    FOREIGN KEY (target_domain) REFERENCES semo.ontology(domain);

-- ============================================================
-- D. project_id 컬럼 및 깨진 FK 제거
-- ============================================================

ALTER TABLE semo.service_action_items
  DROP CONSTRAINT IF EXISTS service_action_items_project_id_fkey;

DROP INDEX IF EXISTS semo.idx_service_action_items_project_status;

ALTER TABLE semo.service_action_items
  DROP COLUMN IF EXISTS project_id;

-- ============================================================
-- E. 테이블 리네이밍
-- ============================================================

ALTER TABLE semo.service_action_items RENAME TO action_items;

DO $$ BEGIN
  ALTER TRIGGER trg_service_action_items_updated ON semo.action_items
    RENAME TO trg_action_items_updated;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX semo.idx_service_action_items_assignee
    RENAME TO idx_action_items_assignee;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- F. 새 인덱스
-- ============================================================

CREATE INDEX idx_action_items_owner_status
  ON semo.action_items(owner_domain, status);

CREATE INDEX idx_action_items_target_status
  ON semo.action_items(target_domain, status)
  WHERE target_domain IS NOT NULL;

CREATE INDEX idx_action_items_created
  ON semo.action_items(created_at DESC);

-- ============================================================
-- G. 하위호환 VIEW (기존 코드가 service_action_items 참조 시 호환)
-- ============================================================

CREATE VIEW semo.service_action_items AS
  SELECT * FROM semo.action_items;

-- ============================================================
-- H. KB 스키마에서 action-item 키 제거
-- ============================================================

DELETE FROM semo.kb_type_schema
WHERE scheme_key = 'action-item';

COMMIT;
