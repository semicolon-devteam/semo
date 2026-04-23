-- 106: office_id 컬럼을 agent_definitions / command_definitions 에도 확장
-- L2 tenant 격리의 기본 메커니즘 — skill_definitions 에 이미 존재, 동일 패턴으로 확장.
-- 모든 기존 레코드는 office_id=NULL (공개 L0 카탈로그) 로 유지.
BEGIN;

-- 1. agent_definitions 에 office_id 추가 (이미 있으면 no-op)
ALTER TABLE IF EXISTS semo.agent_definitions
  ADD COLUMN IF NOT EXISTS office_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_definitions_office
  ON semo.agent_definitions(office_id)
  WHERE office_id IS NOT NULL;

-- 2. command_definitions 에 office_id 추가
ALTER TABLE IF EXISTS semo.command_definitions
  ADD COLUMN IF NOT EXISTS office_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_command_definitions_office
  ON semo.command_definitions(office_id)
  WHERE office_id IS NOT NULL;

-- 3. agent_definitions 의 name 유니크 제약을 (name, office_id) 복합으로 완화
-- 같은 이름의 agent 를 L0(NULL)과 L2(특정 office)가 동시에 보유 가능하도록.
-- 기존 UNIQUE(name) 이 있으면 drop 후 재생성. 없으면 skip.
DO $$
BEGIN
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

-- 4. command_definitions 의 (folder, name) 유니크 제약도 (folder, name, office_id) 복합으로 완화
DO $$
BEGIN
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
