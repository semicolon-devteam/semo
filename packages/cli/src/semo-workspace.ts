/**
 * semo-workspace — ~/.claude/semo/ 디렉토리 관리
 *
 * 봇 워크스페이스 스키마(DB SoT: bot_status/agent_personas)를 로컬에 미러링하여
 * 로컬 Claude Code 세션이 봇 환경과 동형(isomorphic) 구조로 동작하게 한다.
 *
 * v4.5.0: onboarding/init 통합 — 글로벌 단일 설정
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { getPool, getActiveBotIds, getBotWorkspaceFiles, getDelegations } from './database';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

// ============================================================
// Constants
// ============================================================

const SEMO_DIR = path.join(os.homedir(), '.claude', 'semo');
const BOTS_DIR = path.join(SEMO_DIR, 'bots');

function getCliVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ============================================================
// Directory Setup
// ============================================================

/**
 * ~/.claude/semo/ 디렉토리 트리 생성
 */
export function ensureSemoDir(): void {
  const dirs = [SEMO_DIR, BOTS_DIR];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============================================================
// Bot Mirrors
// ============================================================

/**
 * DB bot_workspace_files → ~/.claude/semo/bots/{botId}/ 미러링
 *
 * 1. getActiveBotIds() → 봇 목록
 * 2. 봇별 getBotWorkspaceFiles() → 파일 쓰기
 * 3. DB에 없는 orphan 파일 정리
 */
export async function populateBotMirrors(): Promise<{ bots: number; files: number }> {
  const botIds = await getActiveBotIds();
  if (botIds.length === 0) return { bots: 0, files: 0 };

  let totalFiles = 0;

  for (const botId of botIds) {
    const botDir = path.join(BOTS_DIR, botId);
    const files = await getBotWorkspaceFiles(botId);

    if (files.length === 0) continue;

    // 쓰기
    const writtenPaths = new Set<string>();
    for (const file of files) {
      const filePath = path.join(botDir, file.file_path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
      writtenPaths.add(file.file_path);
      totalFiles++;
    }

    // Orphan 정리: DB에 없는 로컬 파일 삭제
    if (fs.existsSync(botDir)) {
      cleanOrphans(botDir, botDir, writtenPaths);
    }
  }

  // 봇 디렉토리 중 DB에 없는 것 정리
  if (fs.existsSync(BOTS_DIR)) {
    const localBotDirs = fs
      .readdirSync(BOTS_DIR)
      .filter((f) => fs.statSync(path.join(BOTS_DIR, f)).isDirectory());
    for (const dir of localBotDirs) {
      if (!botIds.includes(dir)) {
        fs.rmSync(path.join(BOTS_DIR, dir), { recursive: true, force: true });
      }
    }
  }

  return { bots: botIds.length, files: totalFiles };
}

function cleanOrphans(baseDir: string, currentDir: string, validPaths: Set<string>): void {
  if (!fs.existsSync(currentDir)) return;

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      cleanOrphans(baseDir, fullPath, validPaths);
      // 빈 디렉토리 정리
      try {
        const remaining = fs.readdirSync(fullPath);
        if (remaining.length === 0) fs.rmdirSync(fullPath);
      } catch {
        /* ignore */
      }
    } else if (!validPaths.has(relativePath)) {
      fs.unlinkSync(fullPath);
    }
  }
}

// ============================================================
// SOUL.md / MEMORY.md / USER.md Generation
// ============================================================

/**
 * 로컬 오케스트레이터 SOUL.md 생성
 * (봇 SOUL.md와 동일 포맷 — bot_workspace_standard 준수)
 */
export async function generateSoulMd(): Promise<void> {
  const version = getCliVersion();

  // 봇 로스터 생성
  let botRoster = '';
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT bot_id, name, emoji, role, status
       FROM ${DB_SCHEMA}.bot_status
       WHERE status != 'retired'
       ORDER BY bot_id`,
    );
    if (result.rows.length > 0) {
      botRoster = '| Bot | Name | Role | Status |\n|-----|------|------|--------|\n';
      for (const row of result.rows) {
        botRoster += `| ${row.emoji || ''} ${row.bot_id} | ${row.name || row.bot_id} | ${row.role || '-'} | ${row.status || '-'} |\n`;
      }
    }
  } catch {
    botRoster = '_DB 연결 실패 — 봇 정보를 가져올 수 없습니다._\n';
  }

  // 위임 매트릭스 + 디스패치 테이블 (DB 기반 동적 생성)
  let delegationMatrix = '';
  let dispatchTable = '';
  try {
    const delegations = await getDelegations();
    if (delegations.length > 0) {
      delegationMatrix = '\n## Delegation Matrix\n\n';
      delegationMatrix += '| From | To | Type | Domains |\n|------|-----|------|--------|\n';
      for (const d of delegations) {
        delegationMatrix += `| ${d.from_bot_id} | ${d.to_bot_id} | ${d.delegation_type} | ${d.domains.join(', ')} |\n`;
      }
      // 디스패치 테이블: semiclaw → 타 봇 위임만 추출
      const scDelegations = delegations.filter((d) => d.from_bot_id === 'semiclaw');
      if (scDelegations.length > 0) {
        dispatchTable = '| 도메인 | 봇 | subagent_type |\n|--------|-----|---------------|\n';
        for (const d of scDelegations) {
          dispatchTable += `| ${d.domains.join(', ')} | ${d.to_bot_id} | ${d.to_bot_id} |\n`;
        }
      }
    }
  } catch {
    /* ignore */
  }

  const content = `# SEMO Local Orchestrator — SOUL

> v${version} | Generated by \`semo onboarding\`

## Identity

- **Name**: SemiClaw (로컬 세션)
- **Emoji**: :clipboard:
- **Role**: Semicolon 팀 PM/오케스트레이터 — 허브-앤-스포크 멀티에이전트 시스템의 허브
- **Type**: 로컬 Claude Code 세션에서 동작하는 SemiClaw 인스턴스

이 세션은 **SemiClaw**이다. 사용자의 작업 요청을 직접 처리하거나, 전문 봇 에이전트에 위임한다.

## Mission

1. 사용자의 작업 요청을 분석하고 적절한 봇 에이전트에 위임 (Hub-and-Spoke)
2. 직접 처리 가능한 PM/오케스트레이션 업무는 직접 수행
3. 봇 팀 간 컨텍스트 동기화를 KB 기반으로 유지
4. commitment 기반으로 작업 상태를 추적

## Bot Roster

${botRoster}
${delegationMatrix}
## Sub-Agent Dispatch Protocol

${dispatchTable || '_위임 대상 없음 (DB에서 bot_delegation 조회 실패)_'}

디스패치 절차:
1. commitment 생성 → 서브에이전트 spawn → 결과 수령
2. 서브에이전트에게는 commitment ID + 서비스 도메인 + 한 줄 설명만 전달
3. 나머지는 서브에이전트가 KB에서 직접 조회

## Operating Procedures

1. **KB-First**: 도메인 질문은 항상 \`semo kb search/get\`으로 KB 조회 후 답변
2. **SoT Discipline**: 봇 목록/도메인 구조/워크스페이스 규칙을 하드코딩하지 않음
3. **3-Party Sync**: 모든 변경은 DB ↔ KB ↔ 로컬 파일 영향을 고려

## Constraints

- \`~/.claude/semo/bots/\`는 DB 미러. 변경은 DB 수정 후 \`semo context sync\`로 반영
- 봇 에이전트 호출 시 \`~/.claude/agents/\`의 정의를 사용
- 스킬 실행 시 \`~/.claude/skills/\`의 정의를 사용

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;

  fs.writeFileSync(path.join(SEMO_DIR, 'SOUL.md'), content);
}

/**
 * KB 접근 가이드 인덱스
 */
export function generateMemoryMd(): void {
  const content = `# SEMO Memory Index

> KB(Knowledge Base)는 Single Source of Truth입니다.
> 이 파일은 KB 접근 가이드이며, 실제 데이터는 DB에 있습니다.

## KB 조회 명령어

| 명령어 | 설명 |
|--------|------|
| \`semo kb search "쿼리"\` | 벡터+텍스트 하이브리드 검색 |
| \`semo kb get <domain> <key> [sub_key]\` | domain+key 정확 조회 |
| \`semo kb list --domain <domain>\` | 도메인별 엔트리 목록 |
| \`semo kb upsert <domain> <key> [sub_key] --content "내용"\` | KB 항목 쓰기 |
| \`semo kb ontology --action <action>\` | 온톨로지 조회 |

## 봇 워크스페이스 미러

\`~/.claude/semo/bots/\` 디렉토리에 각 봇의 워크스페이스 파일이 미러링됩니다.
이 파일들은 \`semo context sync\` 시 DB에서 자동 갱신됩니다.

---

*Auto-generated by semo onboarding*
`;

  fs.writeFileSync(path.join(SEMO_DIR, 'MEMORY.md'), content);
}

/**
 * 사용자 프로필 플레이스홀더
 */
export function generateUserMd(): void {
  const userMdPath = path.join(SEMO_DIR, 'USER.md');

  // 이미 존재하면 덮어쓰지 않음 (사용자가 커스텀할 수 있음)
  if (fs.existsSync(userMdPath)) return;

  const content = `# User Profile

> 이 파일은 사용자 프로필입니다.
> \`semo kb get {name} contact\`으로 KB에서 가져오거나 직접 수정하세요.

## 기본 정보

| 항목 | 값 |
|------|-----|
| **이름** | _설정 필요_ |
| **역할** | _설정 필요_ |

---

*수동 편집 가능 — semo onboarding이 덮어쓰지 않습니다*
`;

  fs.writeFileSync(userMdPath, content);
}

// ============================================================
// Thin Router (CLAUDE.md)
// ============================================================

/**
 * ~/.claude/CLAUDE.md를 얇은 라우터로 생성/교체
 *
 * @param kbFirstBlock - buildKbFirstBlock()의 결과 (index.ts에서 전달)
 */
export function generateThinRouter(kbFirstBlock: string): void {
  const version = getCliVersion();
  const globalClaudeMd = path.join(os.homedir(), '.claude', 'CLAUDE.md');

  const content = `# Global Claude Code Configuration

> **이 세션은 SemiClaw이다.** Semicolon 팀의 PM/오케스트레이터로서 작업을 직접 처리하거나 전문 봇에 위임한다.
> 상세 정체성: \`~/.claude/semo/SOUL.md\` | 봇 팀: \`~/.claude/semo/bots/\`
> SEMO v${version}

## cmux Environment

이 터미널은 **cmux** (Ghostty 기반 macOS 네이티브 터미널 멀티플렉서)에서 실행 중이다.
사용자는 여러 프로젝트를 동시에 멀티태스킹하며, 각 워크스페이스가 별도 프로젝트에 대응한다.

### cmux CLI 명령어

| 명령어 | 설명 |
|--------|------|
| \`cmux identify\` | 현재 워크스페이스/서피스/패인 식별 |
| \`cmux list-workspaces\` | 열린 워크스페이스 목록 |
| \`cmux tree [--workspace <ref>]\` | 워크스페이스 내 패인/서피스/탭 구조 |
| \`cmux read-screen --workspace <ref> [--surface <ref>] [--lines N]\` | 다른 탭/패인 화면 읽기 |
| \`cmux send --workspace <ref> <text>\` | 다른 탭에 텍스트 전송 |

### 활용 가이드라인

- 다른 워크스페이스에서 실행 중인 빌드/테스트 상태를 \`cmux read-screen\`으로 확인 가능
- 에러 로그나 서버 출력을 다른 패인에서 읽을 수 있음
- \`cmux tree\`로 현재 열려 있는 전체 작업 환경을 파악할 수 있음
- 사용자가 "다른 탭에서 뭐 돌아가고 있어?" 같은 질문을 하면 cmux 명령어로 확인

${kbFirstBlock}

---

## 3자 동기화 규칙 (NON-NEGOTIABLE)

> 모든 SEMO 프로젝트의 변경은 3자 동기화 관점에서 평가되어야 한다.
> 3자 = **소스코드** ↔ **KB 포함 DB** ↔ **봇 로컬 파일** (DB → 로컬 미러)

| 축 | 위치 | 예시 |
|----|------|------|
| **소스코드** | 각 프로젝트 레포 | API 라우트, 타입, 마이그레이션 |
| **KB 포함 DB** | semo-kb (PostgreSQL + 벡터 임베딩) | 프로세스, 봇 역할, 온톨로지 |
| **봇 로컬 파일** | \`~/.claude/semo/\` + \`~/.claude/semo/bots/{botId}/\` (DB→로컬 미러) | SOUL.md, skills/, memory/ |

**변경 시 체크리스트**:
1. **소스코드 변경** → KB와 봇 파일에 반영할 내용이 있는가?
2. **KB 변경** → 소스코드나 봇 파일과 불일치가 생기지 않는가?
3. **봇 파일 변경** → KB에 기록할 사항이 있는가? 소스코드와 정합성이 맞는가?

**추가 규칙**:
- SoT는 DB. 값이 필요하면 DB/KB에서 동적으로 읽는다.
- KB 쓰기는 \`semo kb upsert\` CLI를 사용한다 (임베딩 + 스키마 검증 포함).

---

## KB CLI 참조 가이드

| 정보 | 조회 명령 |
|------|-----------|
| 봇 프로필 | \`semo kb get {botId} identity\` |
| 봇 역할 | \`semo kb get {botId} role\` |
| SEMO 워크스페이스 규격 | \`semo kb get semo spec workspace-v2\` |
| 환경변수 | \`semo kb get semo infra env-config\` |
| 코딩 컨벤션 | \`semo kb get semo process coding-convention\` |
| 인시던트 기록 | \`semo kb get {service} incident {slug}\` |
| 의사결정 기록 | \`semo kb get semicolon decision {slug}\` |
| 경로 모를 때 | \`semo kb search "검색어"\` 또는 \`semo kb ontology --action routing-table\` |

---

## 공통 Enforcement Hooks

아래 훅은 \`~/.semo/shared/hooks/\`에 위치하며, 봇 + 로컬 세션 양쪽에서 사용:

| 훅 | 트리거 | 역할 |
|----|--------|------|
| \`context-router.sh\` | UserPromptSubmit | 메시지 키워드 → KB/GFP/INFRA 컨텍스트 힌트 주입 |
| \`decision-reminder.sh\` | Stop | 의사결정 패턴 감지 → KB 기록 안 했으면 차단 |
| \`commitment-guard.sh\` | Stop | 한국어 약속 패턴 → commitment 미등록 시 차단 |
| \`kb-first-guard.sh\` | Stop | KB 필요 질문에 KB 조회 없이 답변 시 차단 |
| \`response-length-guard.sh\` | Stop | 봇 응답 20줄 초과 시 차단 |
`;

  // 기존 파일 백업 (마이그레이션)
  if (fs.existsSync(globalClaudeMd)) {
    const existing = fs.readFileSync(globalClaudeMd, 'utf-8');
    // 이미 thin router인지 확인
    if (!existing.includes('Orchestrator profile:')) {
      const backupPath = globalClaudeMd + '.bak';
      fs.writeFileSync(backupPath, existing);
      console.log(chalk.gray(`  기존 CLAUDE.md 백업: ${backupPath}`));
    }
  }

  fs.writeFileSync(globalClaudeMd, content);
}

// .env는 이제 ~/.claude/semo/.env에 직접 저장됨 (index.ts writeSemoEnvFile)
// setupConfigEnvLink 제거 — v4.5.0

// ============================================================
// Session Enforcement (v4.17+)
// ============================================================

const SHARED_HOOKS = path.join(os.homedir(), '.semo', 'shared', 'hooks');

function resolveSemoProjectRules(): string {
  if (process.env.SEMO_PROJECT_RULES) return process.env.SEMO_PROJECT_RULES;
  if (process.env.SEMO_HOME) return path.join(process.env.SEMO_HOME, '.claude', 'rules');
  return path.join(process.cwd(), '.claude', 'rules');
}

const SEMO_PROJECT_RULES = resolveSemoProjectRules();

interface EnforcementHookDef {
  trigger: string;
  script: string;
  timeout: number;
}

const ENFORCEMENT_HOOKS: EnforcementHookDef[] = [
  { trigger: 'UserPromptSubmit', script: 'context-router.sh', timeout: 3000 },
  { trigger: 'Stop', script: 'kb-first-guard.sh', timeout: 5000 },
  { trigger: 'Stop', script: 'response-length-guard.sh', timeout: 3000 },
  { trigger: 'Stop', script: 'url-validator-guard.sh', timeout: 3000 },
  { trigger: 'Stop', script: 'decision-reminder.sh', timeout: 5000 },
  { trigger: 'Stop', script: 'kb-search-loop-guard.sh', timeout: 5000 },
  { trigger: 'Stop', script: 'inbox-drain-prompt.sh', timeout: 3000 },
];

/**
 * 봇 세션 settings.json에 enforcement 훅이 없으면 추가.
 * 기존 훅은 건드리지 않고 누락된 훅만 append.
 */
export function ensureEnforcementHooks(sessionDir: string): { added: string[] } {
  const settingsPath = path.join(sessionDir, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return { added: [] };

  let settings: any;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return { added: [] };
  }

  if (!settings.hooks) settings.hooks = {};

  const added: string[] = [];

  for (const def of ENFORCEMENT_HOOKS) {
    const scriptPath = path.join(SHARED_HOOKS, def.script);
    if (!fs.existsSync(scriptPath)) continue;

    const command = `bash ${SHARED_HOOKS}/${def.script}`;

    if (!settings.hooks[def.trigger]) {
      settings.hooks[def.trigger] = [{ matcher: '', hooks: [] }];
    }

    const triggerGroup = settings.hooks[def.trigger];
    // Find the first matcher group (or create one)
    let group = triggerGroup[0];
    if (!group) {
      group = { matcher: '', hooks: [] };
      triggerGroup.push(group);
    }
    if (!group.hooks) group.hooks = [];

    // Check if already present
    const exists = group.hooks.some((h: any) => h.command && h.command.includes(def.script));
    if (!exists) {
      group.hooks.push({ type: 'command', command, timeout: def.timeout });
      added.push(def.script);
    }
  }

  if (added.length > 0) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  return { added };
}

/**
 * 봇 세션에 프로젝트 rules/ 심링크 생성.
 * 이미 존재하면 skip, 타겟이 없으면 skip.
 * @returns true if symlink was created
 */
export function ensureRulesSymlink(sessionDir: string): boolean {
  if (!fs.existsSync(SEMO_PROJECT_RULES)) return false;

  const linkPath = path.join(sessionDir, '.claude', 'rules');
  const claudeDir = path.join(sessionDir, '.claude');
  if (!fs.existsSync(claudeDir)) return false;

  if (fs.existsSync(linkPath)) {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      // Already a symlink — check target matches
      const target = fs.readlinkSync(linkPath);
      if (target === SEMO_PROJECT_RULES) return false; // already correct
      fs.unlinkSync(linkPath); // stale symlink, recreate
    } else {
      return false; // real directory — don't touch
    }
  }

  fs.symlinkSync(SEMO_PROJECT_RULES, linkPath, 'dir');
  return true;
}
