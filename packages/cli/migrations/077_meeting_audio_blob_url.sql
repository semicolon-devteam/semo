-- 077: meetings 테이블에 Vercel Blob URL 컬럼 추가
-- 오디오 파일을 DB bytea 대신 Blob Storage에 저장
ALTER TABLE semo.meetings ADD COLUMN IF NOT EXISTS audio_blob_url TEXT;
