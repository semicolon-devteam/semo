#!/usr/bin/env node
/**
 * SEMO DB Foreign Key 관계 설정
 *
 * 1. workflow_nodes.skill_name → skills.name
 * 2. workflow_nodes.agent_name → agents.name (agents 테이블 확장 필요)
 * 3. skills.package → packages.name
 * 4. agents.package → packages.name
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: '3.38.162.21',
  port: 5432,
  user: 'app',
  password: 'ProductionPassword2024!@#',
  database: 'appdb',
  ssl: false,
  connectionTimeoutMillis: 10000,
});

async function main() {
  console.log('🔗 SEMO DB Foreign Key 관계 설정\n');
  console.log('=' .repeat(50));

  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL 연결 성공\n');

    // =========================================================================
    // 1. agents 테이블에 워크플로우용 에이전트 추가
    // =========================================================================
    console.log('🤖 워크플로우 에이전트 추가...\n');

    const workflowAgents = [
      { name: 'Analyst', display_name: 'Analyst', description: 'Discovery 단계 분석가' },
      { name: 'PM', display_name: 'Product Manager', description: '기획 및 명세 담당' },
      { name: 'UX Designer', display_name: 'UX Designer', description: 'UI/UX 설계 담당' },
      { name: 'Architect', display_name: 'Software Architect', description: '아키텍처 설계 담당' },
      { name: 'QA', display_name: 'QA Engineer', description: '품질 보증 담당' },
      { name: 'SM', display_name: 'Scrum Master', description: '스프린트 관리 담당' },
      { name: 'DEV', display_name: 'Developer', description: '개발 담당' },
    ];

    for (const agent of workflowAgents) {
      await client.query(`
        INSERT INTO semo.agents (name, display_name, content, package, install_order)
        VALUES ($1, $2, $3, 'core', 100)
        ON CONFLICT (name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          updated_at = now()
      `, [agent.name, agent.display_name, `# ${agent.display_name}\n\n${agent.description}`]);
      console.log(`  ✓ ${agent.name}`);
    }

    // =========================================================================
    // 2. 컬럼 타입 변경 (VARCHAR → FK 준비)
    // =========================================================================
    console.log('\n📝 컬럼 구조 변경...\n');

    // workflow_nodes: skill_name, agent_name을 FK용 ID 컬럼으로 변경
    // 기존 이름 기반 데이터를 ID로 매핑

    // 2.1 새 컬럼 추가
    await client.query(`
      ALTER TABLE semo.workflow_nodes
      ADD COLUMN IF NOT EXISTS skill_id UUID,
      ADD COLUMN IF NOT EXISTS agent_id UUID;
    `);
    console.log('  ✓ workflow_nodes에 skill_id, agent_id 컬럼 추가');

    // 2.2 기존 데이터 매핑
    await client.query(`
      UPDATE semo.workflow_nodes wn
      SET skill_id = s.id
      FROM semo.skills s
      WHERE wn.skill_name = s.name;
    `);
    console.log('  ✓ skill_name → skill_id 매핑 완료');

    await client.query(`
      UPDATE semo.workflow_nodes wn
      SET agent_id = a.id
      FROM semo.agents a
      WHERE wn.agent_name = a.name;
    `);
    console.log('  ✓ agent_name → agent_id 매핑 완료');

    // =========================================================================
    // 3. skills, agents 테이블에 package_id 추가
    // =========================================================================
    console.log('\n📦 패키지 관계 설정...\n');

    // 3.1 새 컬럼 추가
    await client.query(`
      ALTER TABLE semo.skills
      ADD COLUMN IF NOT EXISTS package_id UUID;

      ALTER TABLE semo.agents
      ADD COLUMN IF NOT EXISTS package_id UUID;
    `);
    console.log('  ✓ skills, agents에 package_id 컬럼 추가');

    // 3.2 기존 데이터 매핑
    await client.query(`
      UPDATE semo.skills sk
      SET package_id = p.id
      FROM semo.packages p
      WHERE sk.package = p.name;
    `);

    await client.query(`
      UPDATE semo.agents ag
      SET package_id = p.id
      FROM semo.packages p
      WHERE ag.package = p.name;
    `);
    console.log('  ✓ package → package_id 매핑 완료');

    // =========================================================================
    // 4. Foreign Key 제약조건 추가
    // =========================================================================
    console.log('\n🔗 Foreign Key 제약조건 추가...\n');

    // 기존 FK 제거 (있으면)
    await client.query(`
      ALTER TABLE semo.workflow_nodes
      DROP CONSTRAINT IF EXISTS fk_workflow_nodes_skill,
      DROP CONSTRAINT IF EXISTS fk_workflow_nodes_agent;

      ALTER TABLE semo.skills
      DROP CONSTRAINT IF EXISTS fk_skills_package;

      ALTER TABLE semo.agents
      DROP CONSTRAINT IF EXISTS fk_agents_package;
    `);

    // workflow_nodes → skills
    await client.query(`
      ALTER TABLE semo.workflow_nodes
      ADD CONSTRAINT fk_workflow_nodes_skill
      FOREIGN KEY (skill_id) REFERENCES semo.skills(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log('  ✓ workflow_nodes.skill_id → skills.id');

    // workflow_nodes → agents
    await client.query(`
      ALTER TABLE semo.workflow_nodes
      ADD CONSTRAINT fk_workflow_nodes_agent
      FOREIGN KEY (agent_id) REFERENCES semo.agents(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log('  ✓ workflow_nodes.agent_id → agents.id');

    // skills → packages
    await client.query(`
      ALTER TABLE semo.skills
      ADD CONSTRAINT fk_skills_package
      FOREIGN KEY (package_id) REFERENCES semo.packages(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log('  ✓ skills.package_id → packages.id');

    // agents → packages
    await client.query(`
      ALTER TABLE semo.agents
      ADD CONSTRAINT fk_agents_package
      FOREIGN KEY (package_id) REFERENCES semo.packages(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log('  ✓ agents.package_id → packages.id');

    // =========================================================================
    // 5. 인덱스 추가
    // =========================================================================
    console.log('\n📇 인덱스 추가...\n');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_nodes_skill_id ON semo.workflow_nodes(skill_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_nodes_agent_id ON semo.workflow_nodes(agent_id);
      CREATE INDEX IF NOT EXISTS idx_skills_package_id ON semo.skills(package_id);
      CREATE INDEX IF NOT EXISTS idx_agents_package_id ON semo.agents(package_id);
    `);
    console.log('  ✓ FK 인덱스 생성 완료');

    // =========================================================================
    // 6. 뷰 생성 (조인된 데이터 조회용)
    // =========================================================================
    console.log('\n👁️ 조회용 뷰 생성...\n');

    await client.query(`
      CREATE OR REPLACE VIEW semo.v_workflow_nodes AS
      SELECT
        wn.id,
        wn.workflow_definition_id,
        wn.node_key,
        wn.name,
        wn.phase,
        wn.node_type,
        wn.skill_id,
        s.name AS skill_name,
        s.display_name AS skill_display_name,
        wn.agent_id,
        a.name AS agent_name,
        a.display_name AS agent_display_name,
        wn.decision_config,
        wn.next_node_key,
        wn.install_order
      FROM semo.workflow_nodes wn
      LEFT JOIN semo.skills s ON s.id = wn.skill_id
      LEFT JOIN semo.agents a ON a.id = wn.agent_id;
    `);
    console.log('  ✓ semo.v_workflow_nodes 뷰 생성');

    await client.query(`
      CREATE OR REPLACE VIEW semo.v_skills AS
      SELECT
        s.id,
        s.name,
        s.display_name,
        s.description,
        s.category,
        s.package_id,
        p.name AS package_name,
        p.display_name AS package_display_name,
        s.is_active,
        s.is_required,
        s.install_order,
        s.version,
        LENGTH(s.content) AS content_length,
        s.created_at,
        s.updated_at
      FROM semo.skills s
      LEFT JOIN semo.packages p ON p.id = s.package_id;
    `);
    console.log('  ✓ semo.v_skills 뷰 생성');

    await client.query(`
      CREATE OR REPLACE VIEW semo.v_agents AS
      SELECT
        a.id,
        a.name,
        a.display_name,
        a.package_id,
        p.name AS package_name,
        p.display_name AS package_display_name,
        a.is_active,
        a.install_order,
        LENGTH(a.content) AS content_length,
        a.created_at,
        a.updated_at
      FROM semo.agents a
      LEFT JOIN semo.packages p ON p.id = a.package_id;
    `);
    console.log('  ✓ semo.v_agents 뷰 생성');

    // =========================================================================
    // 결과 확인
    // =========================================================================
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Foreign Key 설정 완료!\n');

    // 관계 확인
    const fkCheck = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'semo'
      ORDER BY tc.table_name;
    `);

    console.log('📊 설정된 Foreign Key 관계:\n');
    fkCheck.rows.forEach(r => {
      console.log(`  ${r.table_name}.${r.column_name} → ${r.foreign_table_name}.${r.foreign_column_name}`);
    });

    // 에이전트 확인
    const agentCount = await client.query('SELECT COUNT(*) FROM semo.agents');
    console.log(`\n🤖 에이전트: ${agentCount.rows[0].count}개`);

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
