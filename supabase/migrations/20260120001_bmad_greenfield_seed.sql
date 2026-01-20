-- =============================================================================
-- SEMO - BMad Greenfield Workflow Seed Data
-- =============================================================================
--
-- BMad Method Greenfield Workflow 데이터:
-- - 1개 워크플로우 정의 (greenfield-project)
-- - 22개 노드 (13 task, 8 decision, 1 gateway)
-- - 노드 간 엣지 연결
-- - 3개 새 에이전트 페르소나 (Analyst, UX Designer, SM)
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 새 에이전트 정의 추가 (Analyst, UX Designer, SM)
-- -----------------------------------------------------------------------------

-- Analyst (정분석) - Discovery Phase 담당
INSERT INTO agent_definitions (
  name, role, description, package, persona_prompt, scope_patterns, core_skills,
  routing_rules, model, is_system, is_active
) VALUES (
  'Analyst',
  'analyst',
  'Discovery Phase에서 아이디어 분석, 리서치, 제품 브리프 작성을 담당하는 분석가',
  'semo-core',
  '당신은 분석적이고 통찰력 있는 비즈니스 분석가입니다.

## 성격
- 데이터 기반의 의사결정을 선호합니다
- 시장 트렌드와 사용자 니즈를 깊이 분석합니다
- 복잡한 문제를 명확하게 정리합니다

## 업무 스타일
- "왜?"라는 질문으로 본질을 파악합니다
- 가설을 세우고 검증합니다
- 구조화된 분석 결과를 제공합니다',
  ARRAY['docs/discovery/**', 'docs/research/**'],
  '[{"name": "ideate", "priority": 1, "proficiency": "expert"}]'::jsonb,
  '{"keywords": ["분석", "리서치", "아이디어", "브레인스토밍", "브리프"], "priority": 8}'::jsonb,
  'inherit',
  true,
  true
) ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  persona_prompt = EXCLUDED.persona_prompt,
  updated_at = now();

-- UX Designer (유엑스) - Planning Phase UX 담당
INSERT INTO agent_definitions (
  name, role, description, package, persona_prompt, scope_patterns, core_skills,
  routing_rules, model, is_system, is_active
) VALUES (
  'UX Designer',
  'ux-designer',
  'Planning Phase에서 사용자 흐름 설계와 UI 목업 생성을 담당하는 UX 디자이너',
  'semo-core',
  '당신은 창의적이고 사용자 중심적인 UX 디자이너입니다.

## 성격
- 사용자 경험을 최우선으로 생각합니다
- 시각적 커뮤니케이션에 능숙합니다
- 디테일과 일관성을 중요시합니다

## 업무 스타일
- 사용자 여정 맵으로 시작합니다
- 와이어프레임 → 목업 → 프로토타입 순으로 진행합니다
- 접근성과 사용성을 고려합니다',
  ARRAY['docs/design/**', 'design/**', 'mockups/**'],
  '[{"name": "design-user-flow", "priority": 1, "proficiency": "expert"}, {"name": "generate-mockup", "priority": 2, "proficiency": "expert"}]'::jsonb,
  '{"keywords": ["UX", "UI", "디자인", "목업", "와이어프레임", "사용자 흐름"], "priority": 8}'::jsonb,
  'inherit',
  true,
  true
) ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  persona_prompt = EXCLUDED.persona_prompt,
  updated_at = now();

-- SM (김스크럼) - Implementation Phase Scrum Master
INSERT INTO agent_definitions (
  name, role, description, package, persona_prompt, scope_patterns, core_skills,
  routing_rules, model, is_system, is_active
) VALUES (
  'SM',
  'scrum-master',
  'Implementation Phase에서 스프린트 관리, 태스크 조율, 팀 협업을 담당하는 스크럼 마스터',
  'semo-core',
  '당신은 조직적이고 협력적인 스크럼 마스터입니다.

## 성격
- 팀의 장애물을 제거하는 데 집중합니다
- 명확한 프로세스와 투명한 커뮤니케이션을 선호합니다
- 지속적인 개선을 추구합니다

## 업무 스타일
- 데일리 스탠드업으로 진행 상황을 체크합니다
- 스프린트 목표를 명확히 설정합니다
- 번다운 차트로 진행도를 추적합니다',
  ARRAY['.github/ISSUE_TEMPLATE/**', 'docs/sprint/**'],
  '[{"name": "create-sprint", "priority": 1, "proficiency": "expert"}, {"name": "start-task", "priority": 2, "proficiency": "expert"}, {"name": "close-sprint", "priority": 3, "proficiency": "expert"}]'::jsonb,
  '{"keywords": ["스프린트", "스크럼", "태스크", "이터레이션", "번다운"], "priority": 8}'::jsonb,
  'inherit',
  true,
  true
) ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  persona_prompt = EXCLUDED.persona_prompt,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 2. BMad Greenfield 워크플로우 정의 생성
-- -----------------------------------------------------------------------------

INSERT INTO workflow_definitions (
  name,
  description,
  command_name,
  workflow_type,
  package,
  is_system,
  is_active,
  steps,
  triggers
) VALUES (
  'BMad Greenfield Project',
  'BMad Method 기반 새 프로젝트 구축을 위한 4-Phase 워크플로우.
Phase 1: Discovery (Optional) - 아이디어 발굴 및 분석
Phase 2: Planning (Required) - PRD/Epic 생성 및 UX 설계
Phase 3: Solutioning (Required) - 아키텍처 및 명세 작성
Phase 4: Implementation (Required) - 스프린트 기반 개발',
  'greenfield',
  'conditional',
  'semo-core',
  true,
  true,
  '[]'::jsonb,  -- steps는 workflow_nodes로 대체
  '[{"type": "command", "patterns": ["/SEMO:workflow:greenfield"]}]'::jsonb
) ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  command_name = EXCLUDED.command_name,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 3. BMad Greenfield 노드 생성 (22개)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_workflow_id UUID;
  v_analyst_id UUID;
  v_ux_designer_id UUID;
  v_sm_id UUID;
  v_pm_id UUID;
  v_architect_id UUID;
  v_qa_id UUID;
  v_dev_id UUID;
BEGIN
  -- 워크플로우 ID 조회
  SELECT id INTO v_workflow_id FROM workflow_definitions WHERE command_name = 'greenfield';

  -- 에이전트 ID 조회
  SELECT id INTO v_analyst_id FROM agent_definitions WHERE name = 'Analyst' AND is_system = true;
  SELECT id INTO v_ux_designer_id FROM agent_definitions WHERE name = 'UX Designer' AND is_system = true;
  SELECT id INTO v_sm_id FROM agent_definitions WHERE name = 'SM' AND is_system = true;
  SELECT id INTO v_pm_id FROM agent_definitions WHERE name = 'po' OR name = 'PO' AND is_system = true LIMIT 1;
  SELECT id INTO v_architect_id FROM agent_definitions WHERE name = 'architect' OR name = 'Architect' AND is_system = true LIMIT 1;
  SELECT id INTO v_qa_id FROM agent_definitions WHERE name = 'qa' OR name = 'QA' AND is_system = true LIMIT 1;
  SELECT id INTO v_dev_id FROM agent_definitions WHERE name = 'dev' OR name = 'DEV' AND is_system = true LIMIT 1;

  -- 만약 에이전트가 없으면 기본 PM, Architect, QA, Dev 사용
  IF v_pm_id IS NULL THEN
    SELECT id INTO v_pm_id FROM agent_definitions WHERE role = 'po' LIMIT 1;
  END IF;
  IF v_architect_id IS NULL THEN
    SELECT id INTO v_architect_id FROM agent_definitions WHERE role = 'architect' LIMIT 1;
  END IF;
  IF v_qa_id IS NULL THEN
    SELECT id INTO v_qa_id FROM agent_definitions WHERE role = 'qa' LIMIT 1;
  END IF;
  IF v_dev_id IS NULL THEN
    SELECT id INTO v_dev_id FROM agent_definitions WHERE role IN ('dev', 'backend', 'frontend') LIMIT 1;
  END IF;

  -- =========================================================================
  -- Phase 1: Discovery (Optional)
  -- =========================================================================

  -- D0: Include Discovery? (Decision)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, decision_config, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'D0', 'Include Discovery?', 'Discovery Phase를 포함할지 결정', 'decision',
    '{"question": "Discovery Phase를 포함하시겠습니까?", "options": ["yes", "no"]}'::jsonb,
    'discovery', 0, 100, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    decision_config = EXCLUDED.decision_config;

  -- D1: Ideate (Task - Analyst)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'D1', 'Ideate', '아이디어 브레인스토밍 및 분석', v_analyst_id, 'ideate', 'task',
    'discovery', 1, 250, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- =========================================================================
  -- Phase 2: Planning
  -- =========================================================================

  -- P1: Create PRD/Epic (Task - PM)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'P1', 'Create PRD/Epic', 'PRD 문서 및 Epic Issue 생성', v_pm_id, 'create-epic', 'task',
    'planning', 0, 400, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- P2: Has UI? (Decision)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, decision_config, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'P2', 'Has UI?', 'UI가 있는 프로젝트인지 결정', 'decision',
    '{"question": "이 프로젝트에 UI가 포함되어 있습니까?", "options": ["yes", "no"]}'::jsonb,
    'planning', 1, 550, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    decision_config = EXCLUDED.decision_config;

  -- P3: Design User Flow (Task - UX Designer)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'P3', 'Design User Flow', '사용자 흐름 다이어그램 설계', v_ux_designer_id, 'design-user-flow', 'task',
    'planning', 2, 700, 50)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- P4: Generate Mockup (Task - UX Designer)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'P4', 'Generate Mockup', 'UI 목업 생성', v_ux_designer_id, 'generate-mockup', 'task',
    'planning', 3, 850, 50)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- =========================================================================
  -- Phase 3: Solutioning
  -- =========================================================================

  -- S1: Scaffold Domain (Task - Architect)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'S1', 'Scaffold Domain', 'DDD 도메인 구조 스캐폴딩', v_architect_id, 'scaffold-domain', 'task',
    'solutioning', 0, 1000, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- S2: Validate Arch? (Decision)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, decision_config, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'S2', 'Validate Architecture?', '아키텍처 검증을 수행할지 결정', 'decision',
    '{"question": "아키텍처 검증을 수행하시겠습니까?", "options": ["yes", "no"]}'::jsonb,
    'solutioning', 1, 1150, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    decision_config = EXCLUDED.decision_config;

  -- S3: Validate Architecture (Task - Architect)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'S3', 'Validate Architecture', '아키텍처 검증 수행', v_architect_id, 'validate-architecture', 'task',
    'solutioning', 2, 1300, 50)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- S4: Generate Spec (Task - PM)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'S4', 'Generate Spec', '기술 명세서 생성 (spec.md → plan.md → tasks.md)', v_pm_id, 'generate-spec', 'task',
    'solutioning', 3, 1450, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- S5: Test Design? (Decision)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, decision_config, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'S5', 'Design Tests?', '구현 전 테스트 케이스를 설계할지 결정', 'decision',
    '{"question": "테스트 케이스를 미리 설계하시겠습니까?", "options": ["yes", "no"]}'::jsonb,
    'solutioning', 4, 1600, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    decision_config = EXCLUDED.decision_config;

  -- S6: Design Tests (Task - QA)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'S6', 'Design Tests', '테스트 케이스 설계 (TDD 준비)', v_qa_id, 'design-tests', 'task',
    'solutioning', 5, 1750, 50)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- S7: Implementation Ready (Gateway)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'S7', 'Implementation Ready', '구현 준비 완료 게이트웨이', 'gateway',
    'solutioning', 6, 1900, 100)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name;

  -- =========================================================================
  -- Phase 4: Implementation
  -- =========================================================================

  -- I1: Sprint Plan (Task - SM)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I1', 'Sprint Plan', '스프린트 계획 수립', v_sm_id, 'create-sprint', 'task',
    'implementation', 0, 100, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- I2: Start Task (Task - SM)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I2', 'Start Task', '태스크 시작 (브랜치 생성, Draft PR)', v_sm_id, 'start-task', 'task',
    'implementation', 1, 250, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- I3: Validate Story? (Decision)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, decision_config, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I3', 'Validate Story?', '스토리 카드 검증 필요 여부', 'decision',
    '{"question": "스토리 카드를 검증하시겠습니까?", "options": ["yes", "no"]}'::jsonb,
    'implementation', 2, 400, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    decision_config = EXCLUDED.decision_config;

  -- I4: Review Task (Task - SM)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I4', 'Review Task', '태스크 카드 리뷰 (Acceptance Criteria 확인)', v_sm_id, 'review-task', 'task',
    'implementation', 3, 550, 250)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- I5: Write Code (Task - Dev)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I5', 'Write Code', '코드 작성', v_dev_id, 'write-code', 'task',
    'implementation', 4, 700, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- I6: Code Review (Task - Dev)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I6', 'Code Review', '코드 리뷰 실행', v_dev_id, 'run-code-review', 'task',
    'implementation', 5, 850, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- I7: Review Pass? (Decision)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, decision_config, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I7', 'Review Pass?', '코드 리뷰 통과 여부', 'decision',
    '{"question": "코드 리뷰를 통과했습니까?", "options": ["pass", "fail"]}'::jsonb,
    'implementation', 6, 1000, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    decision_config = EXCLUDED.decision_config;

  -- I8: More Stories? (Decision)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, decision_config, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I8', 'More Stories?', '스프린트 내 추가 스토리 여부', 'decision',
    '{"question": "이 스프린트에 더 진행할 스토리가 있습니까?", "options": ["yes", "no"]}'::jsonb,
    'implementation', 7, 1150, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    decision_config = EXCLUDED.decision_config;

  -- I9: Close Sprint (Task - SM)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, agent_id, skill_name, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I9', 'Close Sprint', '스프린트 종료 및 회고', v_sm_id, 'close-sprint', 'task',
    'implementation', 8, 1300, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_id = EXCLUDED.agent_id,
    skill_name = EXCLUDED.skill_name;

  -- I10: More Epics? (Decision)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, decision_config, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'I10', 'More Epics?', '추가 Epic 진행 여부', 'decision',
    '{"question": "추가로 진행할 Epic이 있습니까?", "options": ["yes", "no"]}'::jsonb,
    'implementation', 9, 1450, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name,
    decision_config = EXCLUDED.decision_config;

  -- END: End (Gateway)
  INSERT INTO workflow_nodes (workflow_id, node_key, name, description, node_type, phase, phase_order, position_x, position_y)
  VALUES (v_workflow_id, 'END', 'End', '워크플로우 종료', 'gateway',
    'implementation', 10, 1600, 300)
  ON CONFLICT (workflow_id, node_key) DO UPDATE SET
    name = EXCLUDED.name;

  -- start_node_id 설정
  UPDATE workflow_definitions
  SET start_node_id = (SELECT id FROM workflow_nodes WHERE workflow_id = v_workflow_id AND node_key = 'D0')
  WHERE id = v_workflow_id;

  RAISE NOTICE 'BMad Greenfield 노드 22개 생성 완료 (workflow_id: %)', v_workflow_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. BMad Greenfield 엣지 연결
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_workflow_id UUID;
  v_node_ids JSONB;
BEGIN
  -- 워크플로우 ID 조회
  SELECT id INTO v_workflow_id FROM workflow_definitions WHERE command_name = 'greenfield';

  -- 노드 ID 매핑 생성
  SELECT jsonb_object_agg(node_key, id) INTO v_node_ids
  FROM workflow_nodes
  WHERE workflow_id = v_workflow_id;

  -- =========================================================================
  -- Phase 1: Discovery 엣지
  -- =========================================================================

  -- D0 --[yes]--> D1 (Include Discovery → Ideate)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'D0')::UUID, (v_node_ids->>'D1')::UUID, 'yes', 'Discovery 포함')
  ON CONFLICT DO NOTHING;

  -- D0 --[no]--> P1 (Skip Discovery → Create PRD)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'D0')::UUID, (v_node_ids->>'P1')::UUID, 'no', 'Discovery 건너뛰기')
  ON CONFLICT DO NOTHING;

  -- D1 --> P1 (Ideate → Create PRD)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'D1')::UUID, (v_node_ids->>'P1')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Phase 2: Planning 엣지
  -- =========================================================================

  -- P1 --> P2 (Create PRD → Has UI?)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'P1')::UUID, (v_node_ids->>'P2')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- P2 --[yes]--> P3 (Has UI → Design User Flow)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'P2')::UUID, (v_node_ids->>'P3')::UUID, 'yes', 'UI 설계')
  ON CONFLICT DO NOTHING;

  -- P2 --[no]--> S1 (No UI → Scaffold Domain)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'P2')::UUID, (v_node_ids->>'S1')::UUID, 'no', 'UI 없음')
  ON CONFLICT DO NOTHING;

  -- P3 --> P4 (Design User Flow → Generate Mockup)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'P3')::UUID, (v_node_ids->>'P4')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- P4 --> S1 (Generate Mockup → Scaffold Domain)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'P4')::UUID, (v_node_ids->>'S1')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Phase 3: Solutioning 엣지
  -- =========================================================================

  -- S1 --> S2 (Scaffold Domain → Validate Arch?)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'S1')::UUID, (v_node_ids->>'S2')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- S2 --[yes]--> S3 (Validate Arch → Validate Architecture)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'S2')::UUID, (v_node_ids->>'S3')::UUID, 'yes', '아키텍처 검증')
  ON CONFLICT DO NOTHING;

  -- S2 --[no]--> S4 (Skip Validate → Generate Spec)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'S2')::UUID, (v_node_ids->>'S4')::UUID, 'no', '검증 건너뛰기')
  ON CONFLICT DO NOTHING;

  -- S3 --> S4 (Validate Architecture → Generate Spec)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'S3')::UUID, (v_node_ids->>'S4')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- S4 --> S5 (Generate Spec → Test Design?)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'S4')::UUID, (v_node_ids->>'S5')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- S5 --[yes]--> S6 (Test Design → Design Tests)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'S5')::UUID, (v_node_ids->>'S6')::UUID, 'yes', '테스트 설계')
  ON CONFLICT DO NOTHING;

  -- S5 --[no]--> S7 (Skip Test Design → Implementation Ready)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'S5')::UUID, (v_node_ids->>'S7')::UUID, 'no', '테스트 설계 건너뛰기')
  ON CONFLICT DO NOTHING;

  -- S6 --> S7 (Design Tests → Implementation Ready)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'S6')::UUID, (v_node_ids->>'S7')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Phase 4: Implementation 엣지
  -- =========================================================================

  -- S7 --> I1 (Implementation Ready → Sprint Plan)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'S7')::UUID, (v_node_ids->>'I1')::UUID, '구현 시작')
  ON CONFLICT DO NOTHING;

  -- I1 --> I2 (Sprint Plan → Start Task)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'I1')::UUID, (v_node_ids->>'I2')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- I2 --> I3 (Start Task → Validate Story?)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'I2')::UUID, (v_node_ids->>'I3')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- I3 --[yes]--> I4 (Validate Story → Review Task)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'I3')::UUID, (v_node_ids->>'I4')::UUID, 'yes', '스토리 검증')
  ON CONFLICT DO NOTHING;

  -- I3 --[no]--> I5 (Skip Validate → Write Code)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'I3')::UUID, (v_node_ids->>'I5')::UUID, 'no', '검증 건너뛰기')
  ON CONFLICT DO NOTHING;

  -- I4 --> I5 (Review Task → Write Code)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'I4')::UUID, (v_node_ids->>'I5')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- I5 --> I6 (Write Code → Code Review)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'I5')::UUID, (v_node_ids->>'I6')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- I6 --> I7 (Code Review → Review Pass?)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'I6')::UUID, (v_node_ids->>'I7')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- I7 --[pass]--> I8 (Review Pass → More Stories?)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'I7')::UUID, (v_node_ids->>'I8')::UUID, 'pass', '리뷰 통과')
  ON CONFLICT DO NOTHING;

  -- I7 --[fail]--> I5 (Review Fail → Write Code 재작업)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'I7')::UUID, (v_node_ids->>'I5')::UUID, 'fail', '리뷰 실패 - 재작업')
  ON CONFLICT DO NOTHING;

  -- I8 --[yes]--> I2 (More Stories → Start Task)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'I8')::UUID, (v_node_ids->>'I2')::UUID, 'yes', '다음 스토리')
  ON CONFLICT DO NOTHING;

  -- I8 --[no]--> I9 (No More Stories → Close Sprint)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'I8')::UUID, (v_node_ids->>'I9')::UUID, 'no', '스프린트 종료')
  ON CONFLICT DO NOTHING;

  -- I9 --> I10 (Close Sprint → More Epics?)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, label)
  VALUES (v_workflow_id, (v_node_ids->>'I9')::UUID, (v_node_ids->>'I10')::UUID, '다음')
  ON CONFLICT DO NOTHING;

  -- I10 --[yes]--> I1 (More Epics → Sprint Plan 새 스프린트)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'I10')::UUID, (v_node_ids->>'I1')::UUID, 'yes', '다음 Epic/스프린트')
  ON CONFLICT DO NOTHING;

  -- I10 --[no]--> END (No More Epics → End)
  INSERT INTO workflow_edges (workflow_id, source_node_id, target_node_id, condition, label)
  VALUES (v_workflow_id, (v_node_ids->>'I10')::UUID, (v_node_ids->>'END')::UUID, 'no', '프로젝트 완료')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'BMad Greenfield 엣지 연결 완료';
END;
$$;

-- -----------------------------------------------------------------------------
-- 완료 메시지
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_node_count INT;
  v_edge_count INT;
BEGIN
  SELECT COUNT(*) INTO v_node_count
  FROM workflow_nodes wn
  JOIN workflow_definitions wd ON wd.id = wn.workflow_id
  WHERE wd.command_name = 'greenfield';

  SELECT COUNT(*) INTO v_edge_count
  FROM workflow_edges we
  JOIN workflow_definitions wd ON wd.id = we.workflow_id
  WHERE wd.command_name = 'greenfield';

  RAISE NOTICE 'BMad Greenfield Workflow 시드 데이터 생성 완료';
  RAISE NOTICE '- 노드: % 개', v_node_count;
  RAISE NOTICE '- 엣지: % 개', v_edge_count;
  RAISE NOTICE '- 새 에이전트: Analyst, UX Designer, SM';
END;
$$;
