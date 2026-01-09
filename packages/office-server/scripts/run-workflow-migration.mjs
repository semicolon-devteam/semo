import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  // Test if table exists
  const { error: testError } = await supabase
    .from('workflow_definitions')
    .select('id')
    .limit(1);

  if (testError && testError.message.includes('does not exist')) {
    console.log('❌ Table does not exist. Please create via Supabase Dashboard.');
    return;
  }

  console.log('✅ Table exists! Inserting sample data...');

  // Get Demo Office ID
  const { data: offices } = await supabase
    .from('offices')
    .select('id, name')
    .eq('name', 'Demo Office')
    .limit(1);

  if (!offices || offices.length === 0) {
    console.log('❌ Demo Office not found');
    return;
  }

  const demoOfficeId = offices[0].id;
  console.log('Demo Office ID:', demoOfficeId);

  // Insert sample workflows
  const workflows = [
    {
      office_id: demoOfficeId,
      name: 'Feature Request',
      description: '새로운 기능 요청 처리',
      steps: [
        { name: 'brainstorming', agent: 'Researcher', description: '아이디어 조사 및 분석' },
        { name: 'design', agent: 'Designer', description: 'UI/UX 설계' },
        { name: 'implementation', agent: 'FE', description: '프론트엔드 구현' }
      ]
    },
    {
      office_id: demoOfficeId,
      name: 'Bug Fix',
      description: '버그 수정 워크플로우',
      steps: [
        { name: 'analysis', agent: 'QA', description: '버그 원인 분석' },
        { name: 'fix', agent: 'BE', description: '백엔드 수정' },
        { name: 'test', agent: 'QA', description: '수정 사항 테스트' }
      ]
    },
    {
      office_id: demoOfficeId,
      name: 'Refactoring',
      description: '코드 리팩토링',
      steps: [
        { name: 'review', agent: 'Architect', description: '코드 리뷰 및 개선점 분석' },
        { name: 'refactor', agent: 'BE', description: '코드 리팩토링 수행' },
        { name: 'test', agent: 'QA', description: '리팩토링 후 테스트' }
      ]
    },
    {
      office_id: demoOfficeId,
      name: 'Full Stack Feature',
      description: '풀스택 기능 개발 (FE + BE)',
      steps: [
        { name: 'planning', agent: 'Architect', description: '아키텍처 설계' },
        { name: 'backend', agent: 'BE', description: '백엔드 API 구현' },
        { name: 'frontend', agent: 'FE', description: '프론트엔드 구현' },
        { name: 'integration', agent: 'QA', description: '통합 테스트' }
      ]
    }
  ];

  for (const wf of workflows) {
    const { error: insertError } = await supabase
      .from('workflow_definitions')
      .upsert(wf, { onConflict: 'office_id,name' });

    if (insertError) {
      console.error(`❌ Failed to insert ${wf.name}:`, insertError.message);
    } else {
      console.log(`✅ Inserted: ${wf.name}`);
    }
  }

  // Verify
  const { data: result } = await supabase
    .from('workflow_definitions')
    .select('name, description')
    .eq('office_id', demoOfficeId);

  console.log('\n📋 Current workflows:', result);
}

runMigration().catch(console.error);
