-- 세션 별칭 컬럼 추가
ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS alias TEXT;
