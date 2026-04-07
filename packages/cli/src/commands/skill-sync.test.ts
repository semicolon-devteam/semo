/**
 * skill-sync 테스트 — scanSkills 함수의 파일 스캔 로직 검증
 *
 * 실행: npx ts-node packages/cli/src/commands/skill-sync.test.ts
 *
 * 테스트 케이스:
 *   1. 빈 디렉토리 → 0개
 *   2. 봇 전용 스킬 → flat name으로 반환
 *   3. 복수 봇의 전용 스킬 — botId 정확성
 *   4. .skill 확장자 디렉토리 → 스킵
 *   5. SKILL.md 없는 디렉토리 → 스킵
 *   6. 스킬 변경 감지 — 파일 수정 후 재스캔
 *   7. 스킬 추가 감지 — 새 디렉토리 추가 후 재스캔
 *   8. 스킬 삭제 감지 — SKILL.md 삭제 후 재스캔
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scanSkills } from './skill-sync';

let tmpDir: string;
let passed = 0;
let failed = 0;

function setup(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-sync-test-'));
  fs.mkdirSync(path.join(dir, 'bot-workspaces'), { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

function makeBotSkill(
  dir: string,
  botId: string,
  skillName: string,
  content: string,
  refs?: Record<string, string>,
): void {
  const skillDir = path.join(dir, 'bot-workspaces', botId, 'skills', skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
  if (refs) {
    const refsDir = path.join(skillDir, 'references');
    fs.mkdirSync(refsDir, { recursive: true });
    for (const [name, refContent] of Object.entries(refs)) {
      fs.writeFileSync(path.join(refsDir, name), refContent);
    }
  }
}

// ─── 테스트 ───────────────────────────────────────────────

console.log('\n🧪 skill-sync.test.ts\n');

// 1. 빈 디렉토리
console.log('Case 1: 빈 디렉토리');
tmpDir = setup();
{
  const skills = scanSkills(tmpDir);
  assert(skills.length === 0, 'skills = 0');
}
cleanup(tmpDir);

// 2. 봇 전용 스킬 — flat name
console.log('Case 2: 봇 전용 스킬 flat name');
tmpDir = setup();
{
  makeBotSkill(tmpDir, 'semiclaw', 'github-issue-pipeline', '# GH Pipeline');
  const skills = scanSkills(tmpDir);
  assert(skills.length === 1, `skills = 1 (got ${skills.length})`);
  assert(
    skills[0].name === 'github-issue-pipeline',
    `name = github-issue-pipeline (got ${skills[0].name})`,
  );
  assert(skills[0].botId === 'semiclaw', 'botId = semiclaw');
  assert(skills[0].package === 'openclaw', 'package = openclaw');
}
cleanup(tmpDir);

// 3. 복수 봇의 전용 스킬 — botId 정확성
console.log('Case 3: 복수 봇 botId 정확성');
tmpDir = setup();
{
  makeBotSkill(tmpDir, 'semiclaw', 'skill-a', '# A');
  makeBotSkill(tmpDir, 'semiclaw', 'skill-b', '# B');
  makeBotSkill(tmpDir, 'workclaw', 'skill-c', '# C');
  makeBotSkill(tmpDir, 'infraclaw', 'skill-d', '# D');
  const skills = scanSkills(tmpDir);
  assert(skills.length === 4, `총 4개 (got ${skills.length})`);

  const semiclawSkills = skills.filter((s: { botId: string }) => s.botId === 'semiclaw');
  const workclawSkills = skills.filter((s: { botId: string }) => s.botId === 'workclaw');
  const infraclawSkills = skills.filter((s: { botId: string }) => s.botId === 'infraclaw');
  assert(semiclawSkills.length === 2, `semiclaw: 2개 (got ${semiclawSkills.length})`);
  assert(workclawSkills.length === 1, `workclaw: 1개 (got ${workclawSkills.length})`);
  assert(infraclawSkills.length === 1, `infraclaw: 1개 (got ${infraclawSkills.length})`);
}
cleanup(tmpDir);

// 4. .skill 확장자 디렉토리 → 스킵
console.log('Case 4: .skill 확장자 디렉토리');
tmpDir = setup();
{
  const dotSkillDir = path.join(tmpDir, 'bot-workspaces', 'semiclaw', 'skills', 'old-format.skill');
  fs.mkdirSync(dotSkillDir, { recursive: true });
  fs.writeFileSync(path.join(dotSkillDir, 'SKILL.md'), 'should be skipped');
  makeBotSkill(tmpDir, 'semiclaw', 'valid-skill', '# Valid');
  const skills = scanSkills(tmpDir);
  assert(skills.length === 1, `.skill 디렉토리 스킵, skills = 1 (got ${skills.length})`);
  assert(skills[0].name === 'valid-skill', '올바른 스킬만 반환');
}
cleanup(tmpDir);

// 5. SKILL.md 없는 디렉토리 → 스킵
console.log('Case 5: SKILL.md 없는 디렉토리');
tmpDir = setup();
{
  const emptyDir = path.join(tmpDir, 'bot-workspaces', 'semiclaw', 'skills', 'no-skill-md');
  fs.mkdirSync(emptyDir, { recursive: true });
  makeBotSkill(tmpDir, 'semiclaw', 'valid-skill', 'content');
  const skills = scanSkills(tmpDir);
  assert(skills.length === 1, `SKILL.md 없는 디렉토리 스킵, skills = 1 (got ${skills.length})`);
}
cleanup(tmpDir);

// 6. 스킬 변경 감지 — 파일 수정 후 재스캔
console.log('Case 6: 스킬 변경 감지');
tmpDir = setup();
{
  makeBotSkill(tmpDir, 'semiclaw', 'review', '# v1 content');
  const scan1 = scanSkills(tmpDir);
  assert(scan1[0].prompt === '# v1 content', '초기 스캔: v1');

  fs.writeFileSync(
    path.join(tmpDir, 'bot-workspaces', 'semiclaw', 'skills', 'review', 'SKILL.md'),
    '# v2 updated content',
  );
  const scan2 = scanSkills(tmpDir);
  assert(scan2[0].prompt === '# v2 updated content', '재스캔: v2 반영됨');
}
cleanup(tmpDir);

// 7. 스킬 추가 감지 — 새 디렉토리 추가 후 재스캔
console.log('Case 7: 스킬 추가 감지');
tmpDir = setup();
{
  makeBotSkill(tmpDir, 'semiclaw', 'existing', '# Existing');
  const scan1 = scanSkills(tmpDir);
  assert(scan1.length === 1, '초기: 1개');

  makeBotSkill(tmpDir, 'semiclaw', 'new-skill', '# New Skill');
  const scan2 = scanSkills(tmpDir);
  assert(scan2.length === 2, `추가 후: 2개 (got ${scan2.length})`);
}
cleanup(tmpDir);

// 8. 스킬 삭제 감지 — SKILL.md 삭제 후 재스캔
console.log('Case 8: 스킬 삭제 감지');
tmpDir = setup();
{
  makeBotSkill(tmpDir, 'semiclaw', 'to-delete', '# Will be deleted');
  makeBotSkill(tmpDir, 'semiclaw', 'keep', '# Keep');
  const scan1 = scanSkills(tmpDir);
  assert(scan1.length === 2, '초기: 2개');

  fs.unlinkSync(path.join(tmpDir, 'bot-workspaces', 'semiclaw', 'skills', 'to-delete', 'SKILL.md'));
  const scan2 = scanSkills(tmpDir);
  assert(scan2.length === 1, `삭제 후: 1개 (got ${scan2.length})`);
  assert(scan2[0].name === 'keep', '남은 스킬: keep');
}
cleanup(tmpDir);

// 9. references/ 있는 스킬 → referenceFiles 맵 반환
console.log('Case 9: references/ 있는 스킬');
tmpDir = setup();
{
  makeBotSkill(tmpDir, 'semiclaw', 'adhoc-meeting', '# Adhoc Meeting', {
    'meeting-template.md': '# Template',
    'decision-template.md': '# Decision',
  });
  const skills = scanSkills(tmpDir);
  assert(skills.length === 1, 'skills = 1');
  assert(skills[0].referenceFiles !== undefined, 'referenceFiles 존재');
  assert(Object.keys(skills[0].referenceFiles!).length === 2, 'referenceFiles 2개');
  assert(
    skills[0].referenceFiles!['meeting-template.md'] === '# Template',
    'meeting-template 내용 일치',
  );
  assert(
    skills[0].referenceFiles!['decision-template.md'] === '# Decision',
    'decision-template 내용 일치',
  );
}
cleanup(tmpDir);

// 10. references/ 없는 스킬 → referenceFiles undefined
console.log('Case 10: references/ 없는 스킬');
tmpDir = setup();
{
  makeBotSkill(tmpDir, 'semiclaw', 'simple-skill', '# Simple');
  const skills = scanSkills(tmpDir);
  assert(skills.length === 1, 'skills = 1');
  assert(skills[0].referenceFiles === undefined, 'referenceFiles undefined');
}
cleanup(tmpDir);

// ─── 결과 ──────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`총 ${passed + failed}개 테스트: ✅ ${passed} passed, ❌ ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
