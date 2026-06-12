-- 132_kb_supersession.sql
-- 지식 도서관 "폐가/최신판 관리"(G2) — 본문 supersession 컬럼.
-- 설계: docs/superpowers/specs/2026-06-12-knowledge-library-design.md (M1).
-- additive only / 멱등. ⚠️ kb_history(113) 트리거는 OLD 스냅샷(감사)만 보관 → 검색가능한 superseded 행이 아님.
--   따라서 "현행 유효 vs 폐기" 구분은 아래 컬럼으로 표현한다. 기존 행은 전부 is_latest=true(default)로 무해.
-- ⚠️ 검색 기본필터(is_latest) 적용은 코드 측 "검색 계약"(D4) 변경 + 회귀테스트 통과 후 별도 적용.

ALTER TABLE semo.knowledge_base
  ADD COLUMN IF NOT EXISTS is_latest     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS superseded_by BIGINT  NULL REFERENCES semo.knowledge_base(kb_id),
  ADD COLUMN IF NOT EXISTS supersedes    BIGINT  NULL REFERENCES semo.knowledge_base(kb_id),
  ADD COLUMN IF NOT EXISTS valid_from    TIMESTAMPTZ NULL,   -- 현실시간 유효 시작(미상=NULL 허용)
  ADD COLUMN IF NOT EXISTS valid_to      TIMESTAMPTZ NULL;   -- 폐기/만료(미상=NULL)

COMMENT ON COLUMN semo.knowledge_base.is_latest IS
  '현행 유효 장서 여부. 모순 대체 시 옛 행 false. 검색 기본은 is_latest=true (검색계약 D4).';
COMMENT ON COLUMN semo.knowledge_base.superseded_by IS '이 장서를 대체한 새 장서 kb_id.';

-- 현행 장서 빠른 조회용 partial index
CREATE INDEX IF NOT EXISTS idx_kb_is_latest
  ON semo.knowledge_base (domain, is_latest) WHERE is_latest = TRUE;
CREATE INDEX IF NOT EXISTS idx_kb_superseded_by
  ON semo.knowledge_base (superseded_by) WHERE superseded_by IS NOT NULL;

-- 현행 장서 뷰(검색계약 적용 전, 코드가 점진 채택)
CREATE OR REPLACE VIEW semo.v_kb_current AS
  SELECT * FROM semo.knowledge_base WHERE is_latest = TRUE;
