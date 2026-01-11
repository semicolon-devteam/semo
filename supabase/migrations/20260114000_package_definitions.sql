-- SEMO Package Definitions 테이블
-- CLI의 하드코딩된 EXTENSION_PACKAGES, SHORTNAME_MAPPING을 DB로 이전

-- 1. package_definitions 테이블 생성
CREATE TABLE IF NOT EXISTS package_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 패키지 식별
  name VARCHAR(100) NOT NULL UNIQUE,  -- 'semo-core', 'eng/nextjs', 'meta' 등
  display_name VARCHAR(100) NOT NULL, -- 'SEMO Core', 'Next.js', 'Meta' 등
  description TEXT,

  -- 분류
  layer VARCHAR(20) NOT NULL,  -- 'standard', 'biz', 'eng', 'ops', 'system', 'meta'
  package_type VARCHAR(20) DEFAULT 'extension',  -- 'standard', 'extension'

  -- 버전 정보
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',

  -- 다운로드 설정
  repo_url VARCHAR(255) DEFAULT 'https://github.com/semicolon-devteam/semo.git',
  source_path VARCHAR(255) NOT NULL,  -- 'semo-system/semo-core', 'packages/eng/nextjs'

  -- 자동 감지 파일
  detect_files TEXT[] DEFAULT '{}',  -- ['next.config.js', 'next.config.ts']

  -- 의존성
  depends_on TEXT[] DEFAULT '{}',  -- ['semo-core', 'semo-skills']

  -- 단축명 (별칭)
  aliases TEXT[] DEFAULT '{}',  -- ['next', 'nextjs']

  -- 메타데이터
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,  -- true면 필수 패키지 (Standard)
  install_order INTEGER DEFAULT 100,  -- 설치 순서 (낮을수록 먼저)

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_package_definitions_layer ON package_definitions(layer);
CREATE INDEX IF NOT EXISTS idx_package_definitions_type ON package_definitions(package_type);
CREATE INDEX IF NOT EXISTS idx_package_definitions_active ON package_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_package_definitions_aliases ON package_definitions USING GIN(aliases);

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_package_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_package_definitions_updated_at ON package_definitions;
CREATE TRIGGER trg_package_definitions_updated_at
  BEFORE UPDATE ON package_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_package_definitions_updated_at();

-- 4. RLS 정책 (읽기 전용 - 모두 허용)
ALTER TABLE package_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_definitions_read_all"
  ON package_definitions
  FOR SELECT
  USING (true);

-- 관리자만 쓰기 가능 (service_role)
CREATE POLICY "package_definitions_write_admin"
  ON package_definitions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE package_definitions IS 'SEMO CLI 패키지 정의 - Standard 및 Extension 패키지 정보';
COMMENT ON COLUMN package_definitions.name IS '패키지 고유명 (eng/nextjs, meta 등)';
COMMENT ON COLUMN package_definitions.layer IS '패키지 레이어 (standard, biz, eng, ops, system, meta)';
COMMENT ON COLUMN package_definitions.package_type IS '패키지 타입 (standard=필수, extension=선택)';
COMMENT ON COLUMN package_definitions.source_path IS 'Git 레포 내 소스 경로';
COMMENT ON COLUMN package_definitions.aliases IS '단축명 목록 (next, nextjs → eng/nextjs)';
