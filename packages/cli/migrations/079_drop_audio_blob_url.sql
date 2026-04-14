-- 079: 미사용 audio_blob_url 컬럼 제거
-- Vercel Blob 도입 후 철회 (bytea 유지 결정). 077에서 추가된 컬럼 정리.

ALTER TABLE semo.meetings DROP COLUMN IF EXISTS audio_blob_url;
