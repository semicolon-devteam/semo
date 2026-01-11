-- =============================================================================
-- SEMO Office - Agent Definitions Table
-- =============================================================================
--
-- 11개 SEMO 에이전트를 DB 기반으로 관리하기 위한 테이블
-- agent_personas는 오피스별 인스턴스, agent_definitions는 시스템 에이전트 정의
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- agent_definitions: 시스템 에이전트 정의 (SEMO 에이전트 저장)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,  -- 'orchestrator', 'architect', 'backend', 'frontend', 'dev', 'qa', 'devops', 'po', 'sm'
  description TEXT,

  -- 분류
  package VARCHAR(50) NOT NULL DEFAULT 'semo-core',  -- 'semo-core', 'meta', 'office', 'custom'

  -- 페르소나 프롬프트 (에이전트 시스템 메시지)
  persona_prompt TEXT NOT NULL,

  -- 담당 영역 패턴
  scope_patterns TEXT[] DEFAULT '{}',  -- ['src/app/**', 'components/**']

  -- 코어 스킬 (JSONB로 상세 정보 포함)
  core_skills JSONB DEFAULT '[]'::jsonb,
  -- 예: [
  --   {"name": "write-code", "priority": 1, "proficiency": "expert"},
  --   {"name": "create-pr", "priority": 2, "proficiency": "standard"}
  -- ]

  -- 라우팅 규칙 (Orchestrator용)
  routing_rules JSONB DEFAULT '{}'::jsonb,
  -- 예: {
  --   "keywords": ["코드 작성", "구현", "개발"],
  --   "file_patterns": ["*.ts", "*.tsx"],
  --   "priority": 10
  -- }

  -- 내부 라우팅 (에이전트가 스킬을 선택하는 규칙)
  internal_routing JSONB DEFAULT '{}'::jsonb,
  -- 예: {
  --   "default_skill": "write-code",
  --   "skill_selection": [
  --     {"condition": "테스트", "skill": "write-test"},
  --     {"condition": "리뷰", "skill": "run-code-review"}
  --   ]
  -- }

  -- 모델 설정
  model VARCHAR(20) DEFAULT 'inherit',  -- 'inherit', 'opus', 'sonnet', 'haiku'

  -- 아바타 설정 (오피스 UI용)
  avatar_config JSONB DEFAULT '{
    "sprite": "agent_default",
    "color": "#3B82F6"
  }'::jsonb,

  -- 메타데이터
  version VARCHAR(20) DEFAULT '1.0.0',
  is_system BOOLEAN DEFAULT false,  -- 시스템 에이전트 여부
  is_active BOOLEAN DEFAULT true,

  -- 오피스 연결 (NULL이면 글로벌)
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 유니크 제약
  CONSTRAINT agent_definitions_name_office_unique UNIQUE NULLS NOT DISTINCT (name, office_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_definitions_name ON agent_definitions(name);
CREATE INDEX IF NOT EXISTS idx_agent_definitions_role ON agent_definitions(role);
CREATE INDEX IF NOT EXISTS idx_agent_definitions_package ON agent_definitions(package);
CREATE INDEX IF NOT EXISTS idx_agent_definitions_office ON agent_definitions(office_id);
CREATE INDEX IF NOT EXISTS idx_agent_definitions_active ON agent_definitions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_definitions_system ON agent_definitions(is_system) WHERE is_system = true;

-- GIN 인덱스 (JSONB 검색용)
CREATE INDEX IF NOT EXISTS idx_agent_definitions_skills_gin ON agent_definitions USING GIN(core_skills);
CREATE INDEX IF NOT EXISTS idx_agent_definitions_routing_gin ON agent_definitions USING GIN(routing_rules);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trigger_agent_definitions_updated_at ON agent_definitions;
CREATE TRIGGER trigger_agent_definitions_updated_at
  BEFORE UPDATE ON agent_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- RLS 정책
ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_definitions_service_policy ON agent_definitions
  FOR ALL USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE agent_definitions;

-- -----------------------------------------------------------------------------
-- agent_skill_mappings: 에이전트-스킬 매핑 테이블 (M:N 관계)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_skill_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결
  agent_id UUID NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skill_definitions(id) ON DELETE CASCADE,

  -- 매핑 정보
  priority INT DEFAULT 0,  -- 높을수록 우선
  proficiency VARCHAR(20) DEFAULT 'standard' CHECK (proficiency IN (
    'expert',    -- 전문가 수준
    'standard',  -- 표준 수준
    'basic'      -- 기본 수준
  )),

  -- 제한사항
  restrictions TEXT[] DEFAULT '{}',  -- ['no-force-push', 'require-review']

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 유니크 제약: 에이전트-스킬 조합 유일
  UNIQUE(agent_id, skill_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_skill_mappings_agent ON agent_skill_mappings(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skill_mappings_skill ON agent_skill_mappings(skill_id);
CREATE INDEX IF NOT EXISTS idx_agent_skill_mappings_priority ON agent_skill_mappings(priority DESC);

-- RLS 정책
ALTER TABLE agent_skill_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_skill_mappings_service_policy ON agent_skill_mappings
  FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- 함수: 에이전트 라우팅 (요청 → 에이전트 매칭)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION route_to_agent(
  p_input TEXT,
  p_office_id UUID DEFAULT NULL
)
RETURNS TABLE (
  agent_id UUID,
  agent_name VARCHAR(100),
  agent_role VARCHAR(50),
  match_score INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id AS agent_id,
    ad.name AS agent_name,
    ad.role AS agent_role,
    (
      -- 키워드 매칭 점수
      COALESCE((
        SELECT COUNT(*)::INT
        FROM jsonb_array_elements_text(ad.routing_rules->'keywords') AS kw
        WHERE p_input ILIKE '%' || kw || '%'
      ), 0) * 10
      +
      -- 우선순위 점수
      COALESCE((ad.routing_rules->>'priority')::INT, 0)
    ) AS match_score
  FROM agent_definitions ad
  WHERE ad.is_active = true
    AND (ad.office_id IS NULL OR ad.office_id = p_office_id)
    AND ad.routing_rules IS NOT NULL
    AND jsonb_array_length(COALESCE(ad.routing_rules->'keywords', '[]'::jsonb)) > 0
  ORDER BY match_score DESC, ad.name
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 함수: 에이전트의 스킬 목록 조회
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_agent_skills(
  p_agent_name VARCHAR(100)
)
RETURNS TABLE (
  skill_id UUID,
  skill_name VARCHAR(100),
  skill_category VARCHAR(50),
  priority INT,
  proficiency VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.id AS skill_id,
    sd.name AS skill_name,
    sd.category AS skill_category,
    asm.priority,
    asm.proficiency
  FROM agent_definitions ad
  INNER JOIN agent_skill_mappings asm ON ad.id = asm.agent_id
  INNER JOIN skill_definitions sd ON asm.skill_id = sd.id
  WHERE ad.name = p_agent_name
    AND sd.is_active = true
  ORDER BY asm.priority DESC, sd.name;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 뷰: 에이전트 개요
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW agent_overview AS
SELECT
  ad.id,
  ad.name,
  ad.role,
  ad.package,
  ad.description,
  ad.is_system,
  ad.is_active,
  (
    SELECT COUNT(*)
    FROM agent_skill_mappings asm
    WHERE asm.agent_id = ad.id
  ) AS skill_count,
  (
    SELECT jsonb_agg(sd.name ORDER BY asm.priority DESC)
    FROM agent_skill_mappings asm
    INNER JOIN skill_definitions sd ON asm.skill_id = sd.id
    WHERE asm.agent_id = ad.id
    LIMIT 5
  ) AS top_skills
FROM agent_definitions ad
WHERE ad.is_active = true;

-- -----------------------------------------------------------------------------
-- 완료 메시지
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'agent_definitions 테이블 생성 완료';
  RAISE NOTICE '- 11개 Agent 저장 준비됨';
  RAISE NOTICE '- agent_skill_mappings M:N 테이블 생성됨';
  RAISE NOTICE '- 라우팅 함수 생성됨';
  RAISE NOTICE '- 스킬 조회 함수 생성됨';
END;
$$;
