-- 009_enforce_flat_skill_names.sql
-- Enforce flat skill names (strip any remaining slashes)
-- Also add CHECK constraint to prevent future slashes

-- Step 1: flat 이름이 이미 존재하면 slash 버전의 metadata.bot_ids를 flat 버전에 병합 후 삭제
-- (slash 버전에만 있는 bot_ids를 보존)
WITH slash_skills AS (
  SELECT id, name,
         SUBSTRING(name FROM POSITION('/' IN name) + 1) AS flat_name,
         metadata
  FROM skill_definitions
  WHERE name LIKE '%/%' AND office_id IS NULL
),
has_flat AS (
  SELECT s.id AS slash_id, s.flat_name, s.metadata AS slash_meta,
         f.id AS flat_id, f.metadata AS flat_meta
  FROM slash_skills s
  JOIN skill_definitions f ON f.name = s.flat_name AND f.office_id IS NULL
)
-- Merge bot_ids from slash version into flat version
UPDATE skill_definitions f
SET metadata = CASE
  WHEN f.metadata ? 'bot_ids' AND hf.slash_meta ? 'bot_ids'
    THEN jsonb_set(f.metadata, '{bot_ids}',
      (SELECT jsonb_agg(DISTINCT val)
       FROM (
         SELECT val FROM jsonb_array_elements(f.metadata->'bot_ids') val
         UNION
         SELECT val FROM jsonb_array_elements(hf.slash_meta->'bot_ids') val
       ) combined))
  WHEN hf.slash_meta ? 'bot_ids'
    THEN COALESCE(f.metadata, '{}'::jsonb) || jsonb_build_object('bot_ids', hf.slash_meta->'bot_ids')
  ELSE f.metadata
END
FROM has_flat hf
WHERE f.id = hf.flat_id;

-- Step 2: Delete slash versions that have a flat counterpart
DELETE FROM skill_definitions
WHERE name LIKE '%/%'
  AND office_id IS NULL
  AND SUBSTRING(name FROM POSITION('/' IN name) + 1) IN (
    SELECT name FROM skill_definitions WHERE name NOT LIKE '%/%' AND office_id IS NULL
  );

-- Step 3: Rename remaining slash versions (no flat counterpart)
UPDATE skill_definitions
SET name = SUBSTRING(name FROM POSITION('/' IN name) + 1)
WHERE name LIKE '%/%' AND office_id IS NULL;

-- Step 4: Prevent future slashes
ALTER TABLE skill_definitions
ADD CONSTRAINT skill_name_no_slash CHECK (name NOT LIKE '%/%');
