-- 071: service 타입 deprecated KB 엔트리 정리 + DB 트리거
-- migration 070에서 services 테이블로 데이터 복사 완료 후 스키마만 제거했으나,
-- 레거시 KB 엔트리가 남아있고 raw SQL 쓰기 차단이 없었음.

BEGIN;

-- Part A: service 타입 도메인의 deprecated KB 엔트리 삭제
-- (migration 070에서 이미 services 테이블로 데이터 복사 완료)
DELETE FROM semo.knowledge_base kb
USING semo.ontology o
WHERE kb.domain = o.domain
  AND o.entity_type = 'service'
  AND kb.key IN ('status', 'po', 'tech-stack', 'service-url', 'bm', 'repo', 'slack-channel')
  AND kb.sub_key = '';

-- Part B: raw SQL 통한 deprecated 키 쓰기 차단 트리거
CREATE OR REPLACE FUNCTION semo.reject_deprecated_service_kb_keys()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.key IN ('status', 'po', 'tech-stack', 'service-url', 'bm', 'repo', 'slack-channel')
     AND NEW.sub_key = ''
     AND EXISTS (
       SELECT 1 FROM semo.ontology
       WHERE domain = NEW.domain AND entity_type = 'service'
     )
  THEN
    RAISE EXCEPTION 'KB key "%" is deprecated for service-type domains. Use: semo service update --domain %', NEW.key, NEW.domain;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reject_deprecated_service_kb
  BEFORE INSERT OR UPDATE ON semo.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION semo.reject_deprecated_service_kb_keys();

COMMIT;
