-- 109: ontology JSON Schema description 일반화
-- migration 015 에서 KPI ontology 의 properties.project.description 에 세미콜론 L2 도메인
-- 예시("gameland, jungchipan")가 박혀 있었음. OSS 배포 시 외부 사용자에게 노출되므로 일반화.
--
-- 관련 인벤토리: docs/L2-INVENTORY.md (MEDIUM #2)

BEGIN;

UPDATE semo.ontology
SET
  schema = jsonb_set(
    schema,
    '{properties,metadata,properties,project,description}',
    '"프로젝트 ID (예: my-service)"'::jsonb
  ),
  version = version + 1
WHERE domain = 'kpi'
  AND schema #> '{properties,metadata,properties,project,description}'
      = '"프로젝트 ID (예: gameland, jungchipan)"'::jsonb;

COMMIT;
