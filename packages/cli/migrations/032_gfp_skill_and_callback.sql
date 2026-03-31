-- 032_gfp_skill_and_callback.sql
-- GFP 스킬 등록 + 봇 콜백을 위한 인프라
--
-- 1. gfp-manager 스킬 등록 (봇이 GFP 프로젝트/섹션 조회·수정 가능)
-- 2. gfp_projects.service_domain → ontology 자동 등록을 위한 트리거
-- 3. KB write-back 출처 추적을 위한 gfp_phase_sections.kb_written_at 컬럼

BEGIN;

-- ============================================================
-- 1. gfp-manager 스킬 등록
-- ============================================================

INSERT INTO semo.skill_definitions (name, display_name, description, prompt, package, is_active, metadata, version)
VALUES (
  'gfp-manager',
  'GFP Pipeline Manager',
  'GFP(Greenfield Project Pipeline) 프로젝트 조회/섹션 수정/리서치 결과 반영. 봇이 GFP DB에 접근.',
  E'---\nname: gfp-manager\ndescription: GFP(Greenfield Project Pipeline) 프로젝트 조회/섹션 수정/리서치 결과 반영.\n---\n\n# GFP Pipeline Manager\n\nGFP 프로젝트의 섹션 생성/수정, 리서치 결과 반영, 상태 변경을 위한 스킬.\n봇(PlanClaw, GrowthClaw 등)이 대시보드 API를 통해 GFP DB에 접근한다.\n\n## API Endpoints\n\nBase URL: `${SEMO_DASHBOARD_URL}` (default: http://localhost:3000)\n\n### 프로젝트 조회\n```bash\n# 프로젝트 목록\ncurl -s ${SEMO_DASHBOARD_URL}/api/gfp | jq\n\n# 프로젝트 상세 (progress 포함)\ncurl -s ${SEMO_DASHBOARD_URL}/api/gfp/{gfp_id} | jq\n```\n\n### 섹션 조회/수정\n```bash\n# 섹션 목록 (페이즈별)\ncurl -s \"${SEMO_DASHBOARD_URL}/api/gfp/{gfp_id}/sections?phase=1\" | jq\n\n# 섹션 생성/수정 (upsert)\ncurl -X POST ${SEMO_DASHBOARD_URL}/api/gfp/{gfp_id}/sections \\\n  -H \"Content-Type: application/json\" \\\n  -d ''{ \"phase\": 1, \"section_key\": \"overview\", \"title\": \"Overview\", \"content\": \"...\", \"status\": \"pending-review\", \"source\": \"planclaw\" }''\n\n# 섹션 내용 업데이트 (재생성 결과 반영)\ncurl -X PATCH ${SEMO_DASHBOARD_URL}/api/gfp/{gfp_id}/sections \\\n  -H \"Content-Type: application/json\" \\\n  -d ''{ \"section_id\": \"...\", \"action\": \"update-content\", \"content\": \"수정된 내용\", \"status\": \"pending-review\" }''\n```\n\n### 봇 콜백 (결과 반영)\n```bash\n# PlanClaw: 재생성 결과 반영\ncurl -X POST ${SEMO_DASHBOARD_URL}/api/gfp/callback \\\n  -H \"Content-Type: application/json\" \\\n  -d ''{ \"type\": \"section-regeneration\", \"section_id\": \"...\", \"content\": \"재생성된 내용\", \"bot_id\": \"planclaw\" }''\n\n# GrowthClaw: 리서치 결과 반영\ncurl -X POST ${SEMO_DASHBOARD_URL}/api/gfp/callback \\\n  -H \"Content-Type: application/json\" \\\n  -d ''{ \"type\": \"research-result\", \"task_id\": \"...\", \"result\": \"리서치 결과 마크다운\", \"bot_id\": \"growthclaw\" }''\n```\n\n### 리서치 작업\n```bash\n# 리서치 목록\ncurl -s ${SEMO_DASHBOARD_URL}/api/gfp/{gfp_id}/research | jq\n\n# 리서치 결과 업데이트\ncurl -X PATCH ${SEMO_DASHBOARD_URL}/api/gfp/{gfp_id}/research \\\n  -H \"Content-Type: application/json\" \\\n  -d ''{ \"task_id\": \"...\", \"status\": \"completed\", \"result\": \"리서치 결과\" }''\n```\n\n## 규칙\n- 섹션 수정 시 status를 반드시 \"pending-review\"로 설정 (PO 재검토 필요)\n- source 필드로 출처 명시: planclaw / growthclaw / imported / manual\n- 콜백 API 사용 시 bot_id 필수\n',
  'core',
  true,
  '{"bot_ids": ["planclaw", "growthclaw"]}',
  '1.0'
)
ON CONFLICT (name, office_id) DO UPDATE SET
  prompt = EXCLUDED.prompt,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  metadata = EXCLUDED.metadata,
  is_active = true;

-- ============================================================
-- 2. kb_written_at 컬럼 추가 (KB write-back 추적)
-- ============================================================

ALTER TABLE semo.gfp_phase_sections
  ADD COLUMN IF NOT EXISTS kb_written_at TIMESTAMPTZ;

COMMIT;
