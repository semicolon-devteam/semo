-- 042: GFP Parallel Tracks — SemiClaw 시작점 + InfraClaw 병렬 트랙
-- Track A (plan): PlanClaw Phase 1-9
-- Track B (infra): InfraClaw Phase 0-2

-- gfp_phase_sections에 track 컬럼 추가
ALTER TABLE semo.gfp_phase_sections
  ADD COLUMN track VARCHAR(10) NOT NULL DEFAULT 'plan';

-- UNIQUE 제약조건 변경: track 포함
ALTER TABLE semo.gfp_phase_sections
  DROP CONSTRAINT gfp_phase_sections_gfp_id_phase_section_key_key;
ALTER TABLE semo.gfp_phase_sections
  ADD CONSTRAINT gfp_phase_sections_gfp_id_track_phase_section_key_key
  UNIQUE(gfp_id, track, phase, section_key);

-- gfp_projects에 infra_phase 컬럼 추가
ALTER TABLE semo.gfp_projects
  ADD COLUMN infra_phase SMALLINT DEFAULT NULL;

-- 인프라 요구사항 테이블
CREATE TABLE semo.gfp_infra_requests (
  request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gfp_id        UUID NOT NULL REFERENCES semo.gfp_projects(gfp_id) ON DELETE CASCADE,
  source_phase  SMALLINT NOT NULL,
  source_section_id UUID REFERENCES semo.gfp_phase_sections(section_id),
  category      VARCHAR(50) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  priority      VARCHAR(10) NOT NULL DEFAULT 'normal',
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  slack_thread_ts VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gfp_infra_requests_project
  ON semo.gfp_infra_requests(gfp_id, status);
