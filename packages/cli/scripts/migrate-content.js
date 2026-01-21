#!/usr/bin/env node
/**
 * SEMO DB Content Migration Script
 *
 * 1. 기존 스킬 내용을 실제 SKILL.md 파일로 업데이트
 * 2. 워크플로우 테이블 생성
 * 3. Greenfield 워크플로우 시드 데이터 생성
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: '3.38.162.21',
  port: 5432,
  user: 'app',
  password: 'ProductionPassword2024!@#',
  database: 'appdb',
  ssl: false,
  connectionTimeoutMillis: 10000,
});

// 스킬 소스 경로
const SKILLS_PATH = path.join(__dirname, '..', '..', '..', 'semo-system', 'semo-skills');
const AGENTS_PATH = path.join(__dirname, '..', '..', '..', 'semo-system', 'semo-core', 'agents');

// 19개 핵심 스킬 목록
const CORE_SKILLS = [
  // Workflow
  { name: 'workflow-start', category: 'workflow', order: 1 },
  { name: 'workflow-progress', category: 'workflow', order: 2 },
  { name: 'workflow-resume', category: 'workflow', order: 3 },
  // Discovery
  { name: 'ideate', category: 'discovery', order: 10 },
  // Planning
  { name: 'create-epic', category: 'planning', order: 20 },
  { name: 'design-user-flow', category: 'planning', order: 21 },
  { name: 'generate-mockup', category: 'planning', order: 22 },
  // Solutioning
  { name: 'scaffold-domain', category: 'solutioning', order: 30 },
  { name: 'validate-architecture', category: 'solutioning', order: 31 },
  { name: 'generate-spec', category: 'solutioning', order: 32 },
  { name: 'design-tests', category: 'solutioning', order: 33 },
  // Implementation
  { name: 'create-sprint', category: 'implementation', order: 40 },
  { name: 'start-task', category: 'implementation', order: 41 },
  { name: 'review-task', category: 'implementation', order: 42 },
  { name: 'write-code', category: 'implementation', order: 43 },
  { name: 'run-code-review', category: 'implementation', order: 44 },
  { name: 'close-sprint', category: 'implementation', order: 45 },
  // Supporting
  { name: 'git-workflow', category: 'supporting', order: 50 },
  { name: 'notify-slack', category: 'supporting', order: 51 },
];

async function updateSkillsContent(client) {
  console.log('\n📚 스킬 내용 업데이트 중...\n');

  let updated = 0;
  let notFound = 0;

  for (const skill of CORE_SKILLS) {
    const skillPath = path.join(SKILLS_PATH, skill.name, 'SKILL.md');

    if (fs.existsSync(skillPath)) {
      const content = fs.readFileSync(skillPath, 'utf8');

      // frontmatter에서 description 추출
      const descMatch = content.match(/description:\s*\|?\s*([\s\S]*?)(?=\n[a-z]+:|---)/);
      const description = descMatch ? descMatch[1].trim().split('\n')[0] : null;

      // display_name 추출 (# 제목에서)
      const titleMatch = content.match(/^#\s+(.+?)(?:\s+Skill)?$/m);
      const displayName = titleMatch ? titleMatch[1] : skill.name;

      await client.query(`
        UPDATE semo.skills
        SET
          content = $1,
          description = COALESCE($2, description),
          display_name = COALESCE($3, display_name),
          updated_at = now()
        WHERE name = $4
      `, [content, description, displayName, skill.name]);

      console.log(`  ✓ ${skill.name} (${content.length} bytes)`);
      updated++;
    } else {
      console.log(`  ⚠ ${skill.name} - SKILL.md 없음`);
      notFound++;
    }
  }

  console.log(`\n  업데이트: ${updated}개, 미발견: ${notFound}개`);
}

async function updateAgentContent(client) {
  console.log('\n🤖 에이전트 내용 업데이트 중...\n');

  const orchestratorPath = path.join(AGENTS_PATH, 'orchestrator', 'orchestrator.md');

  if (fs.existsSync(orchestratorPath)) {
    const content = fs.readFileSync(orchestratorPath, 'utf8');

    await client.query(`
      UPDATE semo.agents
      SET
        content = $1,
        updated_at = now()
      WHERE name = 'orchestrator'
    `, [content]);

    console.log(`  ✓ orchestrator (${content.length} bytes)`);
  } else {
    console.log(`  ⚠ orchestrator.md 없음`);
  }
}

async function createWorkflowTables(client) {
  console.log('\n🔄 워크플로우 테이블 생성 중...\n');

  // 워크플로우 정의 테이블
  await client.query(`
    DROP TABLE IF EXISTS semo.workflow_node_executions CASCADE;
    DROP TABLE IF EXISTS semo.workflow_instances CASCADE;
    DROP TABLE IF EXISTS semo.workflow_nodes CASCADE;
    DROP TABLE IF EXISTS semo.workflow_definitions CASCADE;
  `);

  // 1. workflow_definitions
  await client.query(`
    CREATE TABLE semo.workflow_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      command_name VARCHAR(100) NOT NULL UNIQUE,  -- greenfield, brownfield
      name VARCHAR(200) NOT NULL,                  -- BMad Greenfield Project
      description TEXT,

      start_node_id UUID,  -- 첫 번째 노드 (FK 나중에 설정)

      is_active BOOLEAN DEFAULT true,
      version VARCHAR(20) DEFAULT '1.0.0',

      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('  ✓ semo.workflow_definitions');

  // 2. workflow_nodes
  await client.query(`
    CREATE TABLE semo.workflow_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      workflow_definition_id UUID NOT NULL REFERENCES semo.workflow_definitions(id),

      node_key VARCHAR(20) NOT NULL,     -- D0, D1, P1, P2, S1, I1, END
      name VARCHAR(200) NOT NULL,         -- Include Discovery?, Ideate
      phase VARCHAR(50),                  -- discovery, planning, solutioning, implementation

      node_type VARCHAR(50) NOT NULL,     -- task, decision, gateway
      skill_name VARCHAR(100),            -- ideate, create-epic (task 노드용)
      agent_name VARCHAR(100),            -- Analyst, PM (optional)

      -- decision 노드용
      decision_config JSONB,              -- { question, options: [{label, value, next_node_key}] }

      -- 다음 노드
      next_node_key VARCHAR(20),          -- 다음 노드 (단일)

      install_order INT DEFAULT 100,

      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),

      UNIQUE(workflow_definition_id, node_key)
    );
  `);
  console.log('  ✓ semo.workflow_nodes');

  // 3. workflow_instances (런타임)
  await client.query(`
    CREATE TABLE semo.workflow_instances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      workflow_definition_id UUID NOT NULL REFERENCES semo.workflow_definitions(id),
      instance_name VARCHAR(200) NOT NULL,  -- 사용자 지정 프로젝트 이름

      status VARCHAR(50) DEFAULT 'active',  -- active, paused, completed, failed
      current_node_id UUID REFERENCES semo.workflow_nodes(id),

      context JSONB DEFAULT '{}',           -- 워크플로우 컨텍스트 데이터

      started_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('  ✓ semo.workflow_instances');

  // 4. workflow_node_executions (실행 기록)
  await client.query(`
    CREATE TABLE semo.workflow_node_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      instance_id UUID NOT NULL REFERENCES semo.workflow_instances(id),
      node_id UUID NOT NULL REFERENCES semo.workflow_nodes(id),

      status VARCHAR(50) DEFAULT 'running',  -- running, completed, skipped, failed

      input_data JSONB,
      output_data JSONB,
      decision_result VARCHAR(50),           -- yes, no (decision 노드)

      started_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('  ✓ semo.workflow_node_executions');

  // 인덱스 생성
  await client.query(`
    CREATE INDEX idx_wf_nodes_definition ON semo.workflow_nodes(workflow_definition_id);
    CREATE INDEX idx_wf_instances_definition ON semo.workflow_instances(workflow_definition_id);
    CREATE INDEX idx_wf_instances_status ON semo.workflow_instances(status);
    CREATE INDEX idx_wf_executions_instance ON semo.workflow_node_executions(instance_id);
  `);
  console.log('  ✓ 인덱스 생성 완료');
}

async function seedGreenfieldWorkflow(client) {
  console.log('\n🌱 Greenfield 워크플로우 시드 데이터 생성 중...\n');

  // 1. 워크플로우 정의 생성
  const defResult = await client.query(`
    INSERT INTO semo.workflow_definitions (command_name, name, description)
    VALUES (
      'greenfield',
      'BMad Greenfield Project',
      'BMad Method Greenfield Workflow - 새 프로젝트를 처음부터 구축하는 4-Phase 워크플로우'
    )
    RETURNING id
  `);
  const workflowId = defResult.rows[0].id;
  console.log(`  ✓ workflow_definitions: greenfield (${workflowId})`);

  // 2. 노드 정의
  const nodes = [
    // Phase 1: Discovery (Optional)
    { key: 'D0', name: 'Include Discovery?', phase: 'discovery', type: 'decision',
      decision: { question: 'Discovery 단계를 포함하시겠습니까?', options: [
        { label: '예', value: 'yes', next: 'D1' },
        { label: '아니오', value: 'no', next: 'P1' }
      ]}, next: null },
    { key: 'D1', name: 'Ideate', phase: 'discovery', type: 'task', skill: 'ideate', agent: 'Analyst', next: 'P1' },

    // Phase 2: Planning
    { key: 'P1', name: 'Create PRD/Epic', phase: 'planning', type: 'task', skill: 'create-epic', agent: 'PM', next: 'P2' },
    { key: 'P2', name: 'Has UI?', phase: 'planning', type: 'decision',
      decision: { question: 'UI가 있는 프로젝트입니까?', options: [
        { label: '예', value: 'yes', next: 'P3' },
        { label: '아니오', value: 'no', next: 'S1' }
      ]}, next: null },
    { key: 'P3', name: 'Design User Flow', phase: 'planning', type: 'task', skill: 'design-user-flow', agent: 'UX Designer', next: 'P4' },
    { key: 'P4', name: 'Generate Mockup', phase: 'planning', type: 'task', skill: 'generate-mockup', agent: 'UX Designer', next: 'S1' },

    // Phase 3: Solutioning
    { key: 'S1', name: 'Scaffold Domain', phase: 'solutioning', type: 'task', skill: 'scaffold-domain', agent: 'Architect', next: 'S2' },
    { key: 'S2', name: 'Validate Architecture?', phase: 'solutioning', type: 'decision',
      decision: { question: '아키텍처 검증을 수행하시겠습니까?', options: [
        { label: '예', value: 'yes', next: 'S3' },
        { label: '아니오', value: 'no', next: 'S4' }
      ]}, next: null },
    { key: 'S3', name: 'Validate Architecture', phase: 'solutioning', type: 'task', skill: 'validate-architecture', agent: 'Architect', next: 'S4' },
    { key: 'S4', name: 'Generate Spec', phase: 'solutioning', type: 'task', skill: 'generate-spec', agent: 'PM', next: 'S5' },
    { key: 'S5', name: 'Design Tests?', phase: 'solutioning', type: 'decision',
      decision: { question: '테스트를 미리 설계하시겠습니까? (TDD)', options: [
        { label: '예', value: 'yes', next: 'S6' },
        { label: '아니오', value: 'no', next: 'S7' }
      ]}, next: null },
    { key: 'S6', name: 'Design Tests', phase: 'solutioning', type: 'task', skill: 'design-tests', agent: 'QA', next: 'S7' },
    { key: 'S7', name: 'Implementation Ready', phase: 'solutioning', type: 'gateway', next: 'I1' },

    // Phase 4: Implementation
    { key: 'I1', name: 'Sprint Plan', phase: 'implementation', type: 'task', skill: 'create-sprint', agent: 'SM', next: 'I2' },
    { key: 'I2', name: 'Start Task', phase: 'implementation', type: 'task', skill: 'start-task', agent: 'SM', next: 'I3' },
    { key: 'I3', name: 'Validate Story?', phase: 'implementation', type: 'decision',
      decision: { question: 'Task 검증이 필요합니까?', options: [
        { label: '예', value: 'yes', next: 'I4' },
        { label: '아니오', value: 'no', next: 'I5' }
      ]}, next: null },
    { key: 'I4', name: 'Review Task', phase: 'implementation', type: 'task', skill: 'review-task', agent: 'SM', next: 'I5' },
    { key: 'I5', name: 'Write Code', phase: 'implementation', type: 'task', skill: 'write-code', agent: 'DEV', next: 'I6' },
    { key: 'I6', name: 'Code Review', phase: 'implementation', type: 'task', skill: 'run-code-review', agent: 'DEV', next: 'I7' },
    { key: 'I7', name: 'Review Pass?', phase: 'implementation', type: 'decision',
      decision: { question: '코드 리뷰를 통과했습니까?', options: [
        { label: '예', value: 'yes', next: 'I8' },
        { label: '아니오 (수정 필요)', value: 'no', next: 'I5' }
      ]}, next: null },
    { key: 'I8', name: 'More Stories?', phase: 'implementation', type: 'decision',
      decision: { question: '스프린트에 더 진행할 Task가 있습니까?', options: [
        { label: '예', value: 'yes', next: 'I2' },
        { label: '아니오', value: 'no', next: 'I9' }
      ]}, next: null },
    { key: 'I9', name: 'Close Sprint', phase: 'implementation', type: 'task', skill: 'close-sprint', agent: 'SM', next: 'I10' },
    { key: 'I10', name: 'More Epics?', phase: 'implementation', type: 'decision',
      decision: { question: '더 진행할 Epic이 있습니까?', options: [
        { label: '예', value: 'yes', next: 'I1' },
        { label: '아니오', value: 'no', next: 'END' }
      ]}, next: null },
    { key: 'END', name: 'End', phase: 'implementation', type: 'gateway', next: null },
  ];

  // 노드 삽입
  const nodeIds = {};
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const result = await client.query(`
      INSERT INTO semo.workflow_nodes (
        workflow_definition_id, node_key, name, phase, node_type,
        skill_name, agent_name, decision_config, next_node_key, install_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      workflowId,
      n.key,
      n.name,
      n.phase,
      n.type,
      n.skill || null,
      n.agent || null,
      n.decision ? JSON.stringify(n.decision) : null,
      n.next,
      (i + 1) * 10
    ]);
    nodeIds[n.key] = result.rows[0].id;
  }
  console.log(`  ✓ workflow_nodes: ${nodes.length}개 노드 생성`);

  // 3. 시작 노드 설정
  await client.query(`
    UPDATE semo.workflow_definitions
    SET start_node_id = $1
    WHERE id = $2
  `, [nodeIds['D0'], workflowId]);
  console.log(`  ✓ start_node_id 설정: D0`);
}

async function createWorkflowFunctions(client) {
  console.log('\n⚙️ 워크플로우 함수 생성 중...\n');

  // 워크플로우 시작 함수
  await client.query(`
    CREATE OR REPLACE FUNCTION semo.start_workflow(
      p_command_name VARCHAR,
      p_instance_name VARCHAR
    ) RETURNS TABLE (
      instance_id UUID,
      workflow_name VARCHAR,
      start_node_key VARCHAR,
      start_node_name VARCHAR
    ) AS $$
    DECLARE
      v_workflow_id UUID;
      v_start_node_id UUID;
      v_instance_id UUID;
    BEGIN
      -- 워크플로우 정의 조회
      SELECT id, start_node_id INTO v_workflow_id, v_start_node_id
      FROM semo.workflow_definitions
      WHERE command_name = p_command_name AND is_active = true;

      IF v_workflow_id IS NULL THEN
        RAISE EXCEPTION 'Workflow not found: %', p_command_name;
      END IF;

      -- 인스턴스 생성
      INSERT INTO semo.workflow_instances (workflow_definition_id, instance_name, current_node_id)
      VALUES (v_workflow_id, p_instance_name, v_start_node_id)
      RETURNING id INTO v_instance_id;

      -- 결과 반환
      RETURN QUERY
      SELECT
        v_instance_id,
        wd.name::VARCHAR,
        wn.node_key::VARCHAR,
        wn.name::VARCHAR
      FROM semo.workflow_definitions wd
      JOIN semo.workflow_nodes wn ON wn.id = v_start_node_id
      WHERE wd.id = v_workflow_id;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('  ✓ semo.start_workflow()');

  // 노드 실행 시작 함수
  await client.query(`
    CREATE OR REPLACE FUNCTION semo.start_workflow_node(
      p_instance_id UUID,
      p_node_id UUID,
      p_input_data JSONB DEFAULT NULL
    ) RETURNS UUID AS $$
    DECLARE
      v_execution_id UUID;
    BEGIN
      -- 실행 기록 생성
      INSERT INTO semo.workflow_node_executions (instance_id, node_id, input_data)
      VALUES (p_instance_id, p_node_id, p_input_data)
      RETURNING id INTO v_execution_id;

      -- 인스턴스 현재 노드 업데이트
      UPDATE semo.workflow_instances
      SET current_node_id = p_node_id, updated_at = now()
      WHERE id = p_instance_id;

      RETURN v_execution_id;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('  ✓ semo.start_workflow_node()');

  // 노드 완료 함수
  await client.query(`
    CREATE OR REPLACE FUNCTION semo.complete_workflow_node(
      p_execution_id UUID,
      p_output_data JSONB DEFAULT NULL,
      p_decision_result VARCHAR DEFAULT NULL
    ) RETURNS TABLE (
      next_node_id UUID,
      next_node_key VARCHAR,
      next_node_name VARCHAR,
      next_node_type VARCHAR
    ) AS $$
    DECLARE
      v_instance_id UUID;
      v_node_id UUID;
      v_next_node_key VARCHAR;
      v_decision_config JSONB;
      v_node_type VARCHAR;
    BEGIN
      -- 실행 정보 조회
      SELECT instance_id, node_id INTO v_instance_id, v_node_id
      FROM semo.workflow_node_executions WHERE id = p_execution_id;

      -- 노드 정보 조회
      SELECT node_type, next_node_key, decision_config
      INTO v_node_type, v_next_node_key, v_decision_config
      FROM semo.workflow_nodes WHERE id = v_node_id;

      -- decision 노드인 경우 다음 노드 결정
      IF v_node_type = 'decision' AND p_decision_result IS NOT NULL THEN
        SELECT opt->>'next' INTO v_next_node_key
        FROM jsonb_array_elements(v_decision_config->'options') opt
        WHERE opt->>'value' = p_decision_result;
      END IF;

      -- 실행 완료 처리
      UPDATE semo.workflow_node_executions
      SET status = 'completed', output_data = p_output_data,
          decision_result = p_decision_result, completed_at = now()
      WHERE id = p_execution_id;

      -- 다음 노드 반환
      RETURN QUERY
      SELECT
        wn.id,
        wn.node_key::VARCHAR,
        wn.name::VARCHAR,
        wn.node_type::VARCHAR
      FROM semo.workflow_nodes wn
      JOIN semo.workflow_instances wi ON wi.workflow_definition_id = wn.workflow_definition_id
      WHERE wi.id = v_instance_id AND wn.node_key = v_next_node_key;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('  ✓ semo.complete_workflow_node()');

  // 워크플로우 진행 상황 조회 함수
  await client.query(`
    CREATE OR REPLACE FUNCTION semo.get_workflow_progress(p_instance_id UUID)
    RETURNS TABLE (
      instance_name VARCHAR,
      workflow_name VARCHAR,
      status VARCHAR,
      current_node_key VARCHAR,
      current_node_name VARCHAR,
      current_phase VARCHAR,
      completed_nodes INT,
      total_nodes INT
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        wi.instance_name::VARCHAR,
        wd.name::VARCHAR,
        wi.status::VARCHAR,
        wn.node_key::VARCHAR,
        wn.name::VARCHAR,
        wn.phase::VARCHAR,
        (SELECT COUNT(*)::INT FROM semo.workflow_node_executions
         WHERE instance_id = p_instance_id AND status = 'completed'),
        (SELECT COUNT(*)::INT FROM semo.workflow_nodes
         WHERE workflow_definition_id = wi.workflow_definition_id)
      FROM semo.workflow_instances wi
      JOIN semo.workflow_definitions wd ON wd.id = wi.workflow_definition_id
      LEFT JOIN semo.workflow_nodes wn ON wn.id = wi.current_node_id
      WHERE wi.id = p_instance_id;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('  ✓ semo.get_workflow_progress()');
}

async function main() {
  console.log('🔄 SEMO DB 콘텐츠 마이그레이션 시작\n');
  console.log('=' .repeat(50));

  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL 연결 성공');

    // 1. 스킬 내용 업데이트
    await updateSkillsContent(client);

    // 2. 에이전트 내용 업데이트
    await updateAgentContent(client);

    // 3. 워크플로우 테이블 생성
    await createWorkflowTables(client);

    // 4. Greenfield 워크플로우 시드 데이터
    await seedGreenfieldWorkflow(client);

    // 5. 워크플로우 함수 생성
    await createWorkflowFunctions(client);

    console.log('\n' + '=' .repeat(50));
    console.log('✅ 마이그레이션 완료!\n');

    // 결과 요약
    const skillCount = await client.query('SELECT COUNT(*) FROM semo.skills');
    const nodeCount = await client.query('SELECT COUNT(*) FROM semo.workflow_nodes');

    console.log('📊 결과 요약:');
    console.log(`   - semo.skills: ${skillCount.rows[0].count}개 (내용 업데이트)`);
    console.log(`   - semo.workflow_definitions: 1개 (greenfield)`);
    console.log(`   - semo.workflow_nodes: ${nodeCount.rows[0].count}개`);
    console.log(`   - 워크플로우 함수: 4개`);

    client.release();
  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
