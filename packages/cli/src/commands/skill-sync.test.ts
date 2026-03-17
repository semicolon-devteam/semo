/**
 * skill-sync 테스트 — scanSkills 함수의 파일 스캔 로직 검증
 *
 * 실행: npx ts-node packages/cli/src/commands/skill-sync.test.ts
 *
 * 테스트 케이스:
 *   1. 빈 디렉토리 → 0개
 *   2. 공유 스킬만 → shared만 반환
 *   3. 봇 전용 스킬만 → botSpecific만 반환
 *   4. 공유 + 봇 전용 혼합
 *   5. SKILL.md 없는 디렉토리 → 스킵
 *   6. .skill 확장자 디렉토리 → 스킵
 *   7. 스킬 변경 감지 — 파일 수정 후 재스캔 시 새 내용 반환
 *   8. 스킬 추가 감지 — 새 디렉토리 추가 후 재스캔
 *   9. 스킬 삭제 감지 — SKILL.md 삭제 후 재스캔 시 제외
 *  10. 복수 봇의 전용 스킬 — botId 정확성
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { scanSkills } from "./skill-sync";

let tmpDir: string;
let passed = 0;
let failed = 0;

function setup(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-sync-test-"));
  fs.mkdirSync(path.join(dir, "semo-skills"), { recursive: true });
  fs.mkdirSync(path.join(dir, "bot-workspaces"), { recursive: true });
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

function makeSharedSkill(dir: string, name: string, content: string): void {
  const skillDir = path.join(dir, "semo-skills", name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);
}

function makeBotSkill(dir: string, botId: string, skillName: string, content: string): void {
  const skillDir = path.join(dir, "bot-workspaces", botId, "skills", skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);
}

// ─── 테스트 ───────────────────────────────────────────────

console.log("\n🧪 skill-sync.test.ts\n");

// 1. 빈 디렉토리
console.log("Case 1: 빈 디렉토리");
tmpDir = setup();
{
  const { shared, botSpecific } = scanSkills(tmpDir);
  assert(shared.length === 0, "shared = 0");
  assert(botSpecific.length === 0, "botSpecific = 0");
}
cleanup(tmpDir);

// 2. 공유 스킬만
console.log("Case 2: 공유 스킬만");
tmpDir = setup();
{
  makeSharedSkill(tmpDir, "code-review", "# Code Review\nprompt content");
  makeSharedSkill(tmpDir, "planning", "# Planning\nprompt content");
  const { shared, botSpecific } = scanSkills(tmpDir);
  assert(shared.length === 2, `shared = 2 (got ${shared.length})`);
  assert(botSpecific.length === 0, "botSpecific = 0");
  assert(shared[0].package === "semo-skills", "package = semo-skills");
  assert(shared[0].botId === null, "botId = null");
}
cleanup(tmpDir);

// 3. 봇 전용 스킬만
console.log("Case 3: 봇 전용 스킬만");
tmpDir = setup();
{
  makeBotSkill(tmpDir, "semiclaw", "github-issue-pipeline", "# GH Pipeline");
  const { shared, botSpecific } = scanSkills(tmpDir);
  assert(shared.length === 0, "shared = 0");
  assert(botSpecific.length === 1, `botSpecific = 1 (got ${botSpecific.length})`);
  assert(botSpecific[0].name === "semiclaw/github-issue-pipeline", `name = semiclaw/github-issue-pipeline`);
  assert(botSpecific[0].botId === "semiclaw", "botId = semiclaw");
  assert(botSpecific[0].package === "openclaw", "package = openclaw");
}
cleanup(tmpDir);

// 4. 공유 + 봇 전용 혼합
console.log("Case 4: 공유 + 봇 전용 혼합");
tmpDir = setup();
{
  makeSharedSkill(tmpDir, "code-review", "# Code Review");
  makeBotSkill(tmpDir, "semiclaw", "pipeline", "# Pipeline");
  makeBotSkill(tmpDir, "workclaw", "deploy", "# Deploy");
  const { shared, botSpecific } = scanSkills(tmpDir);
  assert(shared.length === 1, `shared = 1 (got ${shared.length})`);
  assert(botSpecific.length === 2, `botSpecific = 2 (got ${botSpecific.length})`);
}
cleanup(tmpDir);

// 5. SKILL.md 없는 디렉토리 → 스킵
console.log("Case 5: SKILL.md 없는 디렉토리");
tmpDir = setup();
{
  fs.mkdirSync(path.join(tmpDir, "semo-skills", "_archived"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "semo-skills", "valid-skill"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "semo-skills", "valid-skill", "SKILL.md"), "content");
  const { shared } = scanSkills(tmpDir);
  assert(shared.length === 1, `archived 스킵, shared = 1 (got ${shared.length})`);
}
cleanup(tmpDir);

// 6. .skill 확장자 디렉토리 → 스킵
console.log("Case 6: .skill 확장자 디렉토리");
tmpDir = setup();
{
  const dotSkillDir = path.join(tmpDir, "bot-workspaces", "semiclaw", "skills", "old-format.skill");
  fs.mkdirSync(dotSkillDir, { recursive: true });
  fs.writeFileSync(path.join(dotSkillDir, "SKILL.md"), "should be skipped");
  makeBotSkill(tmpDir, "semiclaw", "valid-skill", "# Valid");
  const { botSpecific } = scanSkills(tmpDir);
  assert(botSpecific.length === 1, `.skill 디렉토리 스킵, botSpecific = 1 (got ${botSpecific.length})`);
  assert(botSpecific[0].name === "semiclaw/valid-skill", "올바른 스킬만 반환");
}
cleanup(tmpDir);

// 7. 스킬 변경 감지 — 파일 수정 후 재스캔
console.log("Case 7: 스킬 변경 감지");
tmpDir = setup();
{
  makeSharedSkill(tmpDir, "review", "# v1 content");
  const scan1 = scanSkills(tmpDir);
  assert(scan1.shared[0].prompt === "# v1 content", "초기 스캔: v1");

  // 파일 수정
  fs.writeFileSync(
    path.join(tmpDir, "semo-skills", "review", "SKILL.md"),
    "# v2 updated content"
  );
  const scan2 = scanSkills(tmpDir);
  assert(scan2.shared[0].prompt === "# v2 updated content", "재스캔: v2 반영됨");
}
cleanup(tmpDir);

// 8. 스킬 추가 감지 — 새 디렉토리 추가 후 재스캔
console.log("Case 8: 스킬 추가 감지");
tmpDir = setup();
{
  makeSharedSkill(tmpDir, "existing", "# Existing");
  const scan1 = scanSkills(tmpDir);
  assert(scan1.shared.length === 1, "초기: 1개");

  // 새 스킬 추가
  makeSharedSkill(tmpDir, "new-skill", "# New Skill");
  const scan2 = scanSkills(tmpDir);
  assert(scan2.shared.length === 2, `추가 후: 2개 (got ${scan2.shared.length})`);
}
cleanup(tmpDir);

// 9. 스킬 삭제 감지 — SKILL.md 삭제 후 재스캔
console.log("Case 9: 스킬 삭제 감지");
tmpDir = setup();
{
  makeSharedSkill(tmpDir, "to-delete", "# Will be deleted");
  makeSharedSkill(tmpDir, "keep", "# Keep");
  const scan1 = scanSkills(tmpDir);
  assert(scan1.shared.length === 2, "초기: 2개");

  // SKILL.md 삭제
  fs.unlinkSync(path.join(tmpDir, "semo-skills", "to-delete", "SKILL.md"));
  const scan2 = scanSkills(tmpDir);
  assert(scan2.shared.length === 1, `삭제 후: 1개 (got ${scan2.shared.length})`);
  assert(scan2.shared[0].name === "keep", "남은 스킬: keep");
}
cleanup(tmpDir);

// 10. 복수 봇의 전용 스킬 — botId 정확성
console.log("Case 10: 복수 봇 botId 정확성");
tmpDir = setup();
{
  makeBotSkill(tmpDir, "semiclaw", "skill-a", "# A");
  makeBotSkill(tmpDir, "semiclaw", "skill-b", "# B");
  makeBotSkill(tmpDir, "workclaw", "skill-c", "# C");
  makeBotSkill(tmpDir, "infraclaw", "skill-d", "# D");
  const { botSpecific } = scanSkills(tmpDir);
  assert(botSpecific.length === 4, `총 4개 (got ${botSpecific.length})`);

  const semiclawSkills = botSpecific.filter(s => s.botId === "semiclaw");
  const workclawSkills = botSpecific.filter(s => s.botId === "workclaw");
  const infraclawSkills = botSpecific.filter(s => s.botId === "infraclaw");
  assert(semiclawSkills.length === 2, `semiclaw: 2개 (got ${semiclawSkills.length})`);
  assert(workclawSkills.length === 1, `workclaw: 1개 (got ${workclawSkills.length})`);
  assert(infraclawSkills.length === 1, `infraclaw: 1개 (got ${infraclawSkills.length})`);
}
cleanup(tmpDir);

// ─── 결과 ──────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`총 ${passed + failed}개 테스트: ✅ ${passed} passed, ❌ ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
