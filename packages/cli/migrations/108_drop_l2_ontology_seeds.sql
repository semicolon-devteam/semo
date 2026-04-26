-- 108: L2 ontology seed cleanup
-- migration 017 시드된 세미콜론 L2 ontology 행(jungchipan, playland)을 제거.
-- 외부 OSS 신규 인스턴스에서는 자동 삭제되어 깨끗한 상태로 시작.
-- 기존 인스턴스에 해당 도메인 KB 데이터가 살아있으면 ontology 행은 보존 (안전).
--
-- 관련 인벤토리: docs/L2-INVENTORY.md (HIGH #1)

BEGIN;

DELETE FROM semo.ontology o
WHERE o.domain IN ('jungchipan', 'playland')
  AND NOT EXISTS (
    SELECT 1 FROM semo.knowledge_base kb WHERE kb.domain = o.domain
  );

COMMIT;
