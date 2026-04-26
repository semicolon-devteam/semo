-- 111: 030 이 시드한 세미콜론 팀원 ontology rows 정리
-- migration 030 가 OSS fresh install 시 세미콜론 팀원 10명 (reus, garden, roki, yeomso,
-- bon, kyago, bae, harry, goni, kai) 의 ontology row 를 자동 시드했음.
-- 030 인라인은 이 migration 시리즈와 함께 INSERT 블록 제거.
-- 기존 인스턴스에서 이미 시드된 row 는 KB 데이터가 0건일 때만 삭제 (108 과 동일 패턴).
--
-- 관련 인벤토리: docs/L2-INVENTORY.md (HIGH — migration 030 team seeds)

BEGIN;

DELETE FROM semo.ontology o
WHERE o.domain IN (
  'reus','garden','roki','yeomso','bon','kyago','bae','harry','goni','kai'
)
  AND o.entity_type IN ('team', 'person')
  AND NOT EXISTS (
    SELECT 1 FROM semo.knowledge_base kb WHERE kb.domain = o.domain
  );

COMMIT;
