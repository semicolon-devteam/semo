-- 007_flatten_skill_names.sql
-- Flat skill naming: botId/skillName → skillName + metadata.bot_ids
--
-- 1. metadata.bot_id (string) → metadata.bot_ids (array) 변환
-- 2. name에서 botId/ 프리픽스 제거

-- Step 1: metadata.bot_id → metadata.bot_ids 배열로 변환
UPDATE skill_definitions
SET metadata = (metadata - 'bot_id') || jsonb_build_object('bot_ids', jsonb_build_array(metadata->>'bot_id'))
WHERE metadata ? 'bot_id';

-- Step 2: name에서 botId/ 프리픽스 제거
UPDATE skill_definitions
SET name = SUBSTRING(name FROM POSITION('/' IN name) + 1)
WHERE name LIKE '%/%'
  AND office_id IS NULL;
