-- Phase 6: meetings.service_id → target_domain 전환
-- service_id FK를 ontology domain 기반 target_domain으로 통일 (action_items 패턴과 동일)

-- Step 1: target_domain 컬럼 추가
ALTER TABLE semo.meetings
  ADD COLUMN IF NOT EXISTS target_domain VARCHAR(100)
  REFERENCES semo.ontology(domain);

-- Step 2: 기존 service_id → target_domain 데이터 마이그레이션
-- ontology에 등록된 도메인만 FK 위반 없이 안전하게 마이그레이션
UPDATE semo.meetings m
  SET target_domain = s.service_domain
  FROM semo.services s
  JOIN semo.ontology o ON o.domain = s.service_domain
  WHERE m.service_id = s.service_id
    AND m.service_id IS NOT NULL
    AND s.service_domain IS NOT NULL
    AND m.target_domain IS NULL;

-- Step 3: service_id는 당분간 유지 (하위호환)
COMMENT ON COLUMN semo.meetings.service_id IS 'DEPRECATED: Use target_domain instead. Will be removed after migration period.';

-- Step 4: 인덱스
CREATE INDEX IF NOT EXISTS idx_meetings_target_domain ON semo.meetings(target_domain)
  WHERE target_domain IS NOT NULL;
