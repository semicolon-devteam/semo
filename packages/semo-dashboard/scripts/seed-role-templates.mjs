// 역할 템플릿 라이브러리 시드 — ~claw 봇 스펙에서 공통화 추출한 보편 역할 템플릿을
// public.agent_listings 에 등록(멱등). + plain 빈 템플릿.
//   node packages/semo-dashboard/scripts/seed-role-templates.mjs
//
// 소스: packages/semo-dashboard/seeds/agent-role-templates.json (Workflow 추출 결과, 버전관리)
// 스키마: migrations/016_agent_template_persona.sql (persona_template, is_template)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function envVal(file, key) {
  try {
    const m = fs.readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  } catch {
    return null;
  }
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  envVal(path.join(process.env.HOME, '.claude/semo/.env'), 'DATABASE_URL');
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const PLAIN = {
  agent_slug: 'plain',
  display_name: '새 직원',
  role_label: '커스텀 직원',
  dept: '기타',
  category: 'custom',
  short_desc:
    '역할을 직접 정의하는 빈 템플릿입니다. 설치 후 페르소나를 작성해 우리 팀만의 직원을 만드세요.',
  skills: [],
  generalized_persona:
    '당신은 {회사}의 직원이다.\n\n[역할]\n(이 직원이 맡을 역할과 담당 업무를 여기에 작성하세요.)\n\n[행동 원칙]\n- 묻기 전에 먼저 찾아본다. 확실하지 않으면 추측하지 않고 확인한다.\n- 결과를 한 번에 보고하고, 블로커는 즉시 알린다.\n- 외부로 나가는 행동은 신중히, 내부 작업은 적극적으로.',
};

async function main() {
  const seedPath = path.join(__dirname, '..', 'seeds', 'agent-role-templates.json');
  const templates = [...JSON.parse(fs.readFileSync(seedPath, 'utf8')), PLAIN];
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  let n = 0;
  for (const t of templates) {
    await client.query(
      `INSERT INTO public.agent_listings
         (agent_slug, display_name, role_label, dept, category, short_desc, skills, persona_template, is_template, audience, review_status, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,true,'customer','approved','preset')
       ON CONFLICT (agent_slug) DO UPDATE SET
         display_name=EXCLUDED.display_name, role_label=EXCLUDED.role_label, dept=EXCLUDED.dept,
         category=EXCLUDED.category, short_desc=EXCLUDED.short_desc, skills=EXCLUDED.skills,
         persona_template=EXCLUDED.persona_template, is_template=true`,
      [
        t.agent_slug,
        t.display_name,
        t.role_label,
        t.dept,
        t.category,
        t.short_desc,
        JSON.stringify(t.skills),
        t.generalized_persona,
      ],
    );
    n++;
  }
  console.log(`seeded ${n} role templates`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
