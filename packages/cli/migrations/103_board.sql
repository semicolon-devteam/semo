-- 103: 파일 게시판 (자료실) — Dashboard CRUD + Introduction 공개 조회
-- 권한 enforce는 API 레이어에서 수행 (pg 직접 접근, RLS 미사용)
-- 파일 바이너리는 bytea로 저장 (meetings.audio_data 패턴 재사용)

BEGIN;

CREATE TABLE IF NOT EXISTS semo.board_categories (
  slug              TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  sort_order        INT DEFAULT 0,
  is_public_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semo.board_posts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                    TEXT NOT NULL,
  description              TEXT,
  category_slug            TEXT NOT NULL REFERENCES semo.board_categories(slug),
  uploader_id              UUID,
  uploader_email           TEXT,
  uploader_name_snapshot   TEXT,
  is_public                BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden                BOOLEAN NOT NULL DEFAULT FALSE,
  view_count               INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semo.board_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES semo.board_posts(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL,
  file_data    BYTEA NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_posts_public
  ON semo.board_posts (is_public, created_at DESC)
  WHERE is_hidden = FALSE;

CREATE INDEX IF NOT EXISTS idx_board_posts_category
  ON semo.board_posts (category_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_board_attachments_post
  ON semo.board_attachments (post_id);

-- 시드 카테고리
INSERT INTO semo.board_categories (slug, label, sort_order, is_public_allowed) VALUES
  ('materials',  '자료/문서',              10, TRUE),
  ('press',      '보도자료/외부 공개',     20, TRUE),
  ('recruiting', '채용/회사 소개',         30, TRUE)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
