-- 106: office_id 컬럼을 agent_definitions / command_definitions 에도 확장
-- L2 tenant 격리의 기본 메커니즘 — skill_definitions 에 이미 존재, 동일 패턴으로 확장.
-- 모든 기존 레코드는 office_id=NULL (공개 L0 카탈로그) 로 유지.
-- drift 복구: 소스 테이블이 없으면 전체 섹션 skip (2026-04-23)
BEGIN;

-- 1+3. agent_definitions 확장
DO $$
BEGIN
  IF to_regclass('semo.agent_definitions') IS NULL THEN
    RAISE NOTICE '106 section agent_definitions skipped: table missing';
    RETURN;
  END IF;

  ALTER TABLE semo.agent_definitions
    ADD COLUMN IF NOT EXISTS office_id UUID DEFAULT NULL;

  CREATE INDEX IF NOT EXISTS idx_agent_definitions_office
    ON semo.agent_definitions(office_id)
    WHERE office_id IS NOT NULL;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_definitions_name_key'
      AND conrelid = 'semo.agent_definitions'::regclass
  ) THEN
    ALTER TABLE semo.agent_definitions DROP CONSTRAINT agent_definitions_name_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'semo' AND tablename = 'agent_definitions'
      AND indexname = 'agent_definitions_name_office_uniq'
  ) THEN
    CREATE UNIQUE INDEX agent_definitions_name_office_uniq
      ON semo.agent_definitions(name, COALESCE(office_id, '00000000-0000-0000-0000-000000000000'::uuid));
  END IF;
END $$;

-- 2+4. command_definitions 확장
DO $$
BEGIN
  IF to_regclass('semo.command_definitions') IS NULL THEN
    RAISE NOTICE '106 section command_definitions skipped: table missing';
    RETURN;
  END IF;

  ALTER TABLE semo.command_definitions
    ADD COLUMN IF NOT EXISTS office_id UUID DEFAULT NULL;

  CREATE INDEX IF NOT EXISTS idx_command_definitions_office
    ON semo.command_definitions(office_id)
    WHERE office_id IS NOT NULL;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'command_definitions_folder_name_key'
      AND conrelid = 'semo.command_definitions'::regclass
  ) THEN
    ALTER TABLE semo.command_definitions DROP CONSTRAINT command_definitions_folder_name_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'semo' AND tablename = 'command_definitions'
      AND indexname = 'command_definitions_folder_name_office_uniq'
  ) THEN
    CREATE UNIQUE INDEX command_definitions_folder_name_office_uniq
      ON semo.command_definitions(folder, name, COALESCE(office_id, '00000000-0000-0000-0000-000000000000'::uuid));
  END IF;
END $$;

COMMIT;
