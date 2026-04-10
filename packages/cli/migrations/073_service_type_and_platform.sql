-- 073: service_type 컬럼 + parent_service_id FK
-- services 테이블에 명시적 서비스 분류 + 플랫폼 그룹핑 지원

-- 1. service_type 컬럼 추가 (기본값 'general')
ALTER TABLE semo.services
  ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'general';

-- CHECK constraint (idempotent: 기존 constraint 있으면 skip)
DO $$ BEGIN
  ALTER TABLE semo.services
    ADD CONSTRAINT chk_service_type
    CHECK (service_type IN ('incubator', 'general', 'external', 'platform'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. parent_service_id (플랫폼 소속, 자기참조 FK)
ALTER TABLE semo.services
  ADD COLUMN IF NOT EXISTS parent_service_id UUID REFERENCES semo.services(service_id);

-- 3. 기존 데이터 자동 분류

-- 3a. 인큐베이터: PM 파이프라인(metadata.preset) 또는 인큐베이터 CP(metadata.incubator) 진행 중
UPDATE semo.services SET service_type = 'incubator'
WHERE service_type = 'general'
  AND lifecycle = 'build'
  AND (metadata->>'preset' IS NOT NULL OR metadata->>'incubator' IS NOT NULL);

-- 3b. 외부 수주 프로젝트
UPDATE semo.services SET service_type = 'external'
WHERE service_domain IN ('orbis', 'tether-mining', 'onto-media');

-- 3c. 플랫폼
UPDATE semo.services SET service_type = 'platform'
WHERE service_domain IN ('wise-platform');

-- 4. 하위 서비스 연결 (wise-platform)
UPDATE semo.services SET parent_service_id = (
  SELECT service_id FROM semo.services WHERE service_domain = 'wise-platform'
) WHERE service_domain IN ('orbis', 'tether-mining', 'onto-media');
