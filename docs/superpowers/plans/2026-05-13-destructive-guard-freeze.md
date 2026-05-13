# Destructive Guard Activation + Freeze Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SEMO의 dormant 상태인 destructive guard를 봇 settings.json template 에 PreToolUse hook 으로 등록해 실제로 활성화하고, gstack `/careful` 의 추가 패턴 + safe exceptions 를 흡수하며, 로컬 careful mode 옵션 (`SEMO_CAREFUL_MODE`) 과 신규 `freeze` skill (디렉토리 락) 을 도입한다. 봇/로컬 양쪽에서 파괴적 명령을 차단하고, gstack KB 백로그 #7 "파괴적 명령 방지 강화" 를 종결한다.

**Architecture:**

- `packages/cli/src/commands/guard.ts` 의 `DESTRUCTIVE_PATTERNS` 배열 확장 + safe exceptions 헬퍼 추가 + 신규 `FREEZE_GUARD` HookGuard 추가
- `scripts/generate-bot-env.js` 의 settings.json template 에 PreToolUse hook 3종 등록 (destructive / skill-mirror / freeze)
- `semo guard freeze <dir>` / `semo guard unfreeze` CLI 서브커맨드 추가 (state file 기반)
- `skill_definitions` DB 에 `freeze` skill 등록 → PlanClaw 포함 모든 봇에 자동 노출

**Tech Stack:** TypeScript (guard.ts), Vitest (테스트), Node.js (generate-bot-env.js), Claude Code hook 명세 (settings.json), SEMO skill_definitions DB, `~/.semo/state/` state file

---

## File Structure

| 파일                                                                               | 책임                                                                                            | 변경 유형                                                       |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/cli/src/commands/guard.ts`                                               | DESTRUCTIVE_PATTERNS 확장, safe exceptions 헬퍼, FREEZE_GUARD HookGuard, freeze state file 유틸 | Modify (line 107-121, 553-581 부근 + 신규 섹션)                 |
| `packages/cli/src/commands/guard.test.ts`                                          | gstack 패턴 + safe exceptions + careful mode + freeze 테스트                                    | Modify (line 443-506 destructive describe 확장 + 신규 describe) |
| `packages/cli/src/index.ts` 또는 `packages/cli/src/commands/guard.ts`              | `semo guard freeze/unfreeze` CLI 서브커맨드 dispatch                                            | Modify (existing dispatch table)                                |
| `scripts/generate-bot-env.js`                                                      | 봇 settings.json template 에 PreToolUse hooks 등록                                              | Modify (line 264-303 settings 객체)                             |
| `~/.semo/state/freeze-dir.txt`                                                     | freeze 디렉토리 락 state file                                                                   | Runtime artifact (코드 변경 아님)                               |
| DB `semo.skill_definitions`                                                        | `freeze` skill 등록                                                                             | Insert via `semo skill create` 또는 직접 INSERT                 |
| KB `semo decision/superpowers-gstack-adoption-destructive-guard-freeze-2026-05-13` | 의사결정 기록                                                                                   | Insert via `semo kb upsert`                                     |

---

## Step 1: gstack 패턴 흡수 + safe exceptions

### Task 1: gstack 추가 패턴 테스트 작성 (RED)

**Files:**

- Modify: `packages/cli/src/commands/guard.test.ts:506` (destructive describe 끝 부분)

- [ ] **Step 1: 5개 신규 테스트 작성**

```ts
it('git checkout . → deny', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'git checkout .' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toContain('"decision":"deny"');
  expect(r.stdout).toContain('checkout');
});

it('git restore . → deny', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'git restore .' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toContain('"decision":"deny"');
});

it('DROP DATABASE foo → deny', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'psql -c "DROP DATABASE foo"' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toContain('DROP DATABASE');
});

it('kubectl delete pod → deny', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'kubectl delete pod foo' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toContain('kubectl delete');
});

it('docker system prune -a → deny', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'docker system prune -af' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toContain('docker system prune');
});
```

- [ ] **Step 2: 테스트 실행 — 5개 모두 FAIL 확인**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "destructive"`
Expected: 5 tests fail with "Expected … to contain '...' " (none of the new patterns trigger deny yet).

### Task 2: DESTRUCTIVE_PATTERNS 확장 (guard.ts:107-121)

**Files:**

- Modify: `packages/cli/src/commands/guard.ts:107-121`

- [ ] **Step 1: 5개 패턴 추가**

기존 `DESTRUCTIVE_PATTERNS` 배열 끝 (line 120 `dd ...` 이후) 에 추가:

```ts
  [/git\s+(checkout|restore)\s+\.\s*$/i, 'git checkout/restore working tree'],
  [/DROP\s+DATABASE/i, 'SQL DROP DATABASE'],
  [/kubectl\s+delete\b/i, 'kubectl delete'],
  [/docker\s+rm\s+-[a-zA-Z]*f/i, 'docker rm --force'],
  [/docker\s+system\s+prune(\s+-[a-zA-Z]*a)?/i, 'docker system prune'],
```

- [ ] **Step 2: 테스트 실행 — 5개 모두 PASS 확인**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "destructive"`
Expected: All destructive tests pass (기존 6개 + 신규 5개 = 11개).

- [ ] **Step 3: 커밋**

```bash
git add packages/cli/src/commands/guard.ts packages/cli/src/commands/guard.test.ts
git commit -m "feat(guard): absorb gstack /careful patterns (git checkout/restore, DROP DATABASE, kubectl delete, docker prune)"
```

### Task 3: Safe exception 헬퍼 — false positive 차단

**Files:**

- Modify: `packages/cli/src/commands/guard.test.ts` (destructive describe 확장)
- Modify: `packages/cli/src/commands/guard.ts:107-121` 부근

- [ ] **Step 1: Safe exception 테스트 작성 (RED)**

```ts
it('rm -rf node_modules → pass (safe target)', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf node_modules' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toBe('');
});

it('rm -rf dist → pass (safe target)', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf dist' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toBe('');
});

it('rm -rf ./.next → pass (safe target with relative prefix)', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf ./.next' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toBe('');
});

it('rm -rf node_modules /etc → still deny (mixed)', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf node_modules /etc' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toContain('"decision":"deny"');
});
```

- [ ] **Step 2: 테스트 실행 — fail 확인**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "safe target"`
Expected: 3 tests fail (현재 rm 패턴이 모든 rm 호출을 차단). 마지막 mixed 테스트는 이미 pass.

- [ ] **Step 3: SAFE_RM_TARGETS 상수 + isOnlySafeRm 헬퍼 추가 (guard.ts:121 직후)**

```ts
const SAFE_RM_TARGETS = new Set([
  'node_modules',
  '.next',
  'dist',
  '__pycache__',
  '.cache',
  'build',
  '.turbo',
  'coverage',
]);

/** `rm -rf <targets>` 가 모두 안전 디렉토리(빌드 산출물)만 대상으로 하면 true. */
function isOnlySafeRm(command: string): boolean {
  // "rm <flags> <targets>" 만 처리. 다른 명령과 결합되면 false (보수적)
  if (!/^\s*rm\s+/i.test(command)) return false;
  if (/[;&|]|\$\(|`/.test(command)) return false; // shell composition → 보수 처리
  // flags 제거 후 target 추출
  const after = command.replace(/^\s*rm\s+/i, '');
  const tokens = after.split(/\s+/).filter(Boolean);
  const targets = tokens.filter((t) => !t.startsWith('-'));
  if (targets.length === 0) return false;
  return targets.every((t) => {
    const norm = t.replace(/^\.\//, '').replace(/\/+$/, '');
    return SAFE_RM_TARGETS.has(norm);
  });
}
```

- [ ] **Step 4: DESTRUCTIVE_GUARD.evaluate 수정 (guard.ts:558-580)**

`if (!command) return PASS;` 직후에 추가:

```ts
// gstack-style safe exception — 봇이 빌드 산출물 clean 가능하게
if (isOnlySafeRm(command)) return PASS;
```

- [ ] **Step 5: 테스트 실행 — safe 3개 pass, mixed 1개 여전히 deny**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "destructive"`
Expected: All 15 destructive tests pass.

- [ ] **Step 6: build + lint + tsc**

Run: `cd packages/cli && npm run build && cd ../.. && npm run lint && npx tsc --noEmit`
Expected: 모두 pass.

- [ ] **Step 7: 커밋**

```bash
git add packages/cli/src/commands/guard.ts packages/cli/src/commands/guard.test.ts
git commit -m "feat(guard): add safe rm exceptions (node_modules, dist, .next, etc) to destructive guard"
```

---

## Step 2: 로컬 careful mode (사용자 세션도 가드 옵션)

### Task 4: SEMO_CAREFUL_MODE env 인식 테스트 작성 (RED)

**Files:**

- Modify: `packages/cli/src/commands/guard.test.ts` (destructive describe 확장 또는 새 describe)

- [ ] **Step 1: 3개 테스트 추가**

`run(args, stdin, envOverride)` 헬퍼가 env 인자를 받는지 먼저 확인. 안 받으면 헬퍼 시그니처 확장 필요 (별도 작업). 받는다면:

```ts
it('NON_BOT_CWD + SEMO_CAREFUL_MODE=1 + rm -rf / → deny', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: NON_BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /etc' },
    }),
    { SEMO_CAREFUL_MODE: '1' },
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toContain('"decision":"deny"');
});

it('NON_BOT_CWD + SEMO_CAREFUL_MODE=ask + rm -rf / → ask', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: NON_BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /etc' },
    }),
    { SEMO_CAREFUL_MODE: 'ask' },
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toContain('"permissionDecision":"ask"');
});

it('NON_BOT_CWD + SEMO_CAREFUL_MODE unset + rm -rf / → pass (기존 동작)', () => {
  const r = run(
    ['guard', 'run', 'destructive'],
    JSON.stringify({
      cwd: NON_BOT_CWD,
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /etc' },
    }),
  );
  expect(r.code).toBe(0);
  expect(r.stdout).toBe('');
});
```

- [ ] **Step 2: 테스트 실행 — 2개 fail (env override 동작 안 함)**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "CAREFUL"`
Expected: 처음 2개 fail.

### Task 5: DESTRUCTIVE_GUARD 에 careful mode 분기 추가

**Files:**

- Modify: `packages/cli/src/commands/guard.ts:553-581` (DESTRUCTIVE_GUARD)

- [ ] **Step 1: `botSessionOnly` 제거 + cwd 조건 분기로 변경**

기존:

```ts
const DESTRUCTIVE_GUARD: HookGuard = {
  name: 'destructive',
  triggers: ['PreToolUse'],
  botSessionOnly: true,
  description: 'Bash 도구의 파괴적 명령 차단 (deny JSON)',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const cwd = payload.cwd ?? '';
    if (!BOT_CWD_RE.test(cwd)) return PASS;
    ...
```

변경:

```ts
const DESTRUCTIVE_GUARD: HookGuard = {
  name: 'destructive',
  triggers: ['PreToolUse'],
  botSessionOnly: false, // 로컬에도 SEMO_CAREFUL_MODE 로 활성 가능
  description: 'Bash 도구의 파괴적 명령 차단 (봇: 항상 / 로컬: SEMO_CAREFUL_MODE 필요)',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const cwd = payload.cwd ?? '';
    const isBot = BOT_CWD_RE.test(cwd);
    const carefulMode = process.env.SEMO_CAREFUL_MODE ?? '';
    if (!isBot && !carefulMode) return PASS;
    const askMode = !isBot && carefulMode === 'ask';
    ...
```

마지막 deny 결과 부분 (line 574-579) 도 분기:

```ts
const reason = `[DESTRUCTIVE GUARD] 차단: ${found.join(', ')}. 이 명령은 ${isBot ? '봇 세션에서 실행할 수 없습니다' : 'careful mode 에서 차단되었습니다'}. 안전한 대안을 사용하세요.`;
const decisionPayload = askMode
  ? { permissionDecision: 'ask', permissionDecisionReason: reason }
  : { decision: 'deny', reason };
return {
  exitCode: 0,
  level: 'block',
  message: JSON.stringify(decisionPayload, undefined, 0),
};
```

- [ ] **Step 2: 테스트 실행 — 3개 모두 pass**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "CAREFUL"`

- [ ] **Step 3: 기존 봇 테스트 회귀 없음 확인**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "destructive"`
Expected: 모든 18개 (15 + 3) pass.

- [ ] **Step 4: 커밋**

```bash
git add packages/cli/src/commands/guard.ts packages/cli/src/commands/guard.test.ts
git commit -m "feat(guard): add SEMO_CAREFUL_MODE for local sessions (deny | ask)"
```

---

## Step 3: freeze skill (디렉토리 락)

### Task 6: freeze state file 유틸 + FREEZE_GUARD 테스트 작성 (RED)

**Files:**

- Modify: `packages/cli/src/commands/guard.test.ts` (신규 describe)

- [ ] **Step 1: freeze 테스트 4개 작성**

```ts
describe('semo guard run freeze', () => {
  const FREEZE_STATE = path.join(os.homedir(), '.semo', 'state', 'freeze-dir.txt');
  beforeEach(() => {
    try {
      fs.unlinkSync(FREEZE_STATE);
    } catch {}
  });

  it('freeze state 없음 → Edit pass', () => {
    const r = run(
      ['guard', 'run', 'freeze'],
      JSON.stringify({
        cwd: '/tmp',
        tool_name: 'Edit',
        tool_input: { file_path: '/tmp/x.txt' },
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('freeze 디렉토리 안 Edit → pass', () => {
    fs.mkdirSync(path.dirname(FREEZE_STATE), { recursive: true });
    fs.writeFileSync(FREEZE_STATE, '/tmp/allowed/');
    const r = run(
      ['guard', 'run', 'freeze'],
      JSON.stringify({
        cwd: '/tmp',
        tool_name: 'Edit',
        tool_input: { file_path: '/tmp/allowed/foo.txt' },
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('freeze 디렉토리 밖 Edit → deny', () => {
    fs.mkdirSync(path.dirname(FREEZE_STATE), { recursive: true });
    fs.writeFileSync(FREEZE_STATE, '/tmp/allowed/');
    const r = run(
      ['guard', 'run', 'freeze'],
      JSON.stringify({
        cwd: '/tmp',
        tool_name: 'Edit',
        tool_input: { file_path: '/tmp/elsewhere/foo.txt' },
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"decision":"deny"');
    expect(r.stdout).toContain('freeze');
  });

  it('Bash → pass (Edit/Write 만 가드)', () => {
    fs.mkdirSync(path.dirname(FREEZE_STATE), { recursive: true });
    fs.writeFileSync(FREEZE_STATE, '/tmp/allowed/');
    const r = run(
      ['guard', 'run', 'freeze'],
      JSON.stringify({
        cwd: '/tmp/elsewhere',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});
```

- [ ] **Step 2: 테스트 실행 — freeze guard 미등록으로 모두 fail**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "freeze"`
Expected: 'unknown guard name: freeze' 같은 에러로 4개 fail.

### Task 7: freeze 유틸 + FREEZE_GUARD HookGuard 추가

**Files:**

- Modify: `packages/cli/src/commands/guard.ts` (Imports + 유틸 + HookGuard 등록)

- [ ] **Step 1: freeze state file 유틸 추가 (guard.ts 의 `semoStateDir()` 근처, line 124 부근)**

```ts
function freezeStateFile(): string {
  return path.join(semoStateDir(), 'freeze-dir.txt');
}

function readFreezeDir(): string | null {
  try {
    const p = freezeStateFile();
    if (!fs.existsSync(p)) return null;
    const dir = fs.readFileSync(p, 'utf8').trim();
    if (!dir) return null;
    return dir.endsWith('/') ? dir : dir + '/';
  } catch {
    return null;
  }
}

function writeFreezeDir(dir: string): void {
  const p = freezeStateFile();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const norm = dir.endsWith('/') ? dir : dir + '/';
  fs.writeFileSync(p, norm);
}

function clearFreezeDir(): boolean {
  try {
    const p = freezeStateFile();
    if (!fs.existsSync(p)) return false;
    fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: FREEZE_GUARD HookGuard 추가 (DESTRUCTIVE_GUARD 직후, line 581 부근)**

```ts
const FREEZE_GUARD: HookGuard = {
  name: 'freeze',
  triggers: ['PreToolUse'],
  botSessionOnly: false,
  description: 'freeze 디렉토리 밖 Edit/Write 차단 (state file 기반)',
  async evaluate(payload: HookPayload | null): Promise<HookResult> {
    if (!payload) return PASS;
    const toolName = (payload.tool_name as string | undefined) ?? '';
    if (toolName !== 'Edit' && toolName !== 'Write') return PASS;
    const freezeDir = readFreezeDir();
    if (!freezeDir) return PASS;
    const filePath =
      ((payload.tool_input as Record<string, unknown> | undefined)?.file_path as
        | string
        | undefined) ?? '';
    if (!filePath) return PASS;
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    if (absPath.startsWith(freezeDir)) return PASS;
    const reason = `[FREEZE GUARD] 편집 차단: ${absPath} 은 freeze 디렉토리(${freezeDir}) 밖입니다. semo guard unfreeze 로 해제하거나 freeze 디렉토리 안에서 작업하세요.`;
    return {
      exitCode: 0,
      level: 'block',
      message: JSON.stringify({ decision: 'deny', reason }, undefined, 0),
    };
  },
};
```

- [ ] **Step 3: guards 등록 배열에 FREEZE_GUARD 추가**

guard.ts 의 guards 등록 배열 (예: `GUARDS = [...]` 또는 `guardMap` 같은 곳) 에 `FREEZE_GUARD` 추가. 위치는 `DESTRUCTIVE_GUARD` 근처. (정확한 위치는 Task 0 조사 시 확인 — guard.ts 끝 부분 dispatch table)

- [ ] **Step 4: 테스트 실행 — 4개 pass**

Run: `npx vitest run packages/cli/src/commands/guard.test.ts -t "freeze"`

### Task 8: `semo guard freeze <dir>` / `unfreeze` CLI 추가

**Files:**

- Modify: `packages/cli/src/commands/guard.ts` (CLI dispatch — `run` 명령 외에 `freeze`/`unfreeze` 서브)

- [ ] **Step 1: dispatch entry 추가 (guard.ts main 함수, switch 또는 dispatch table)**

`guard run <name>` 외에 `guard freeze <dir>` / `guard unfreeze` 처리:

```ts
// CLI dispatch 내부 (정확한 위치는 기존 code 패턴에 맞춤)
if (sub === 'freeze') {
  const dir = args[0];
  if (!dir) {
    console.error('Usage: semo guard freeze <directory>');
    process.exit(2);
  }
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) {
    console.error(`Directory not found: ${abs}`);
    process.exit(2);
  }
  writeFreezeDir(abs);
  console.log(`[freeze] Edits restricted to: ${abs}/`);
  console.log(`[freeze] state file: ${freezeStateFile()}`);
  process.exit(0);
}
if (sub === 'unfreeze') {
  const removed = clearFreezeDir();
  console.log(removed ? '[unfreeze] Lock cleared.' : '[unfreeze] No active lock.');
  process.exit(0);
}
```

- [ ] **Step 2: CLI smoke test (수동)**

```bash
cd packages/cli && npm run build && cd ../..
semo guard freeze /tmp
cat ~/.semo/state/freeze-dir.txt
# Expected: /tmp/
semo guard unfreeze
ls ~/.semo/state/freeze-dir.txt 2>&1
# Expected: No such file
```

- [ ] **Step 3: 커밋**

```bash
git add packages/cli/src/commands/guard.ts packages/cli/src/commands/guard.test.ts
git commit -m "feat(guard): add freeze/unfreeze CLI + FREEZE_GUARD HookGuard (gstack /freeze pattern)"
```

### Task 9: freeze skill SKILL.md 작성 + DB 등록

**Files:**

- Create: 임시 작성 후 DB INSERT (KB 메모리: 스킬 DB 등록은 직접 INSERT 필요)

- [ ] **Step 1: SKILL.md 본문 작성 (임시 파일)**

````bash
cat > /tmp/freeze-skill.md << 'EOF'
---
name: freeze
description: 디렉토리 편집 락. 특정 디렉토리 밖 Edit/Write 를 차단해서 사이드 이펙트 방지. /freeze {dir} 로 활성, /unfreeze 로 해제. 디버깅 중 다른 코드 우연히 수정 방지, 모듈 격리 작업 시 사용. gstack /freeze 패턴 동등.
---

# freeze

## 사용 시점
- 버그 디버깅 중 다른 코드 우연히 수정 방지
- 특정 모듈에만 변경 적용하고 싶을 때
- 봇 세션에서 작업 범위 명시적 제한

## 활성화
```bash
semo guard freeze /path/to/module
````

state file: `~/.semo/state/freeze-dir.txt`

## 해제

```bash
semo guard unfreeze
```

## 동작

- Edit / Write 도구만 가드 (Bash, Read, Grep 등은 통과)
- 락 디렉토리 밖 경로 → deny
- 락 디렉토리 안 또는 락 없음 → pass
  EOF

````

- [ ] **Step 2: skill_definitions DB INSERT (KB 메모리 참조 — `semo bots sync` 자동 등록 안 됨)**

```bash
# DB direct INSERT 또는 semo skill upsert (CLI 있다면)
semo skill create freeze --content "$(cat /tmp/freeze-skill.md)" --agents ""
# 또는 ~/.semo/workspaces/{bot}/skills/freeze/SKILL.md 에 직접 작성 후 semo bots sync
````

(정확한 명령은 SEMO skill 시스템 현황에 따라. KB feedback "skill-db-registration" 참조)

- [ ] **Step 3: 등록 확인**

```bash
semo skill list | grep freeze
# Expected: freeze 항목 노출
```

- [ ] **Step 4: ~/.claude/skills/freeze/SKILL.md mirror 확인**

```bash
ls ~/.claude/skills/freeze/SKILL.md
# semo bots sync 후 자동 생성되었는지 확인 (안 됐으면 사용자 syncGlobalCache 수동 실행)
```

---

## Step 4: 봇 활성화 (PreToolUse hook 등록)

### Task 10: settings.json template 에 PreToolUse 추가 (legacy + AgentSpec renderer 양쪽 sync)

**컨텍스트 (2026-05-13 발견)**:
SEMO 봇 정의 시스템이 transition 중 — `scripts/generate-bot-env.js` (legacy) → `packages/common/src/agents/renderers.ts` (AgentSpec projection). KB decision `portable-agent-spec-renderer-layer-2026-05-08` 명시:

- "Overflow/helper bots need explicit derivedFrom/replyAs metadata before replacing generate-bot-env fully" → legacy 도 fully replace 안 됨
- 따라서 **양쪽 모두 동일 PreToolUse 블록 추가** 필요

**Files:**

- Modify: `scripts/generate-bot-env.js:277-302` (legacy settings template)
- Modify: `packages/common/src/agents/renderers.ts:176-203` (AgentSpec claude-code target — 새 SoT)
- ⚠️ 두 파일 모두 untracked/dirty 상태 (transition 작업 진행 중) — 우리 변경은 별도 commit 분리, transition 작업자와 충돌 시 머지 협의

- [ ] **Step 1: legacy 에 PreToolUse 추가**

`scripts/generate-bot-env.js:289` 의 `Stop: [` 직전에 삽입:

```js
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            { type: 'command', command: '/usr/local/bin/semo guard run destructive', timeout: 3000 },
          ],
        },
        {
          matcher: 'Edit|Write',
          hooks: [
            { type: 'command', command: '/usr/local/bin/semo guard run skill-mirror', timeout: 3000 },
            { type: 'command', command: '/usr/local/bin/semo guard run freeze', timeout: 3000 },
          ],
        },
      ],
```

- [ ] **Step 1b: AgentSpec renderer 에도 동일 추가**

`packages/common/src/agents/renderers.ts:190` 의 `Stop: [` 직전에 동일 PreToolUse 블록 삽입. 단, hooks 객체가 `usesMailbox ? { ... } : {}` 패턴이므로 PreToolUse 는 mailbox 사용 봇만 등록 (현 설계와 일치) 또는 모든 봇에 등록 (보안 일관성 우선). **모든 봇 등록 권장** — destructive guard 는 mailbox 무관 모든 봇에 적용되어야:

```ts
// renderers.ts 의 hooks 정의 부분
hooks: {
  ...(usesMailbox ? {
    SessionStart: [...],
    Stop: [...],
  } : {}),
  PreToolUse: [
    { matcher: 'Bash', hooks: [{ type: 'command', command: '/usr/local/bin/semo guard run destructive', timeout: 3000 }] },
    { matcher: 'Edit|Write', hooks: [
      { type: 'command', command: '/usr/local/bin/semo guard run skill-mirror', timeout: 3000 },
      { type: 'command', command: '/usr/local/bin/semo guard run freeze', timeout: 3000 },
    ]},
  ],
},
```

- [ ] **Step 2: dry-run 으로 한 봇 (incubator) settings 검증**

```bash
node scripts/generate-bot-env.js --bot incubator --session-dir ~/.semo/sessions --mailbox-dir ~/.semo/mailbox --dry-run
```

Expected output 에 PreToolUse 블록 노출 확인.

- [ ] **Step 3: 실제 regenerate (incubator 만)**

```bash
node scripts/generate-bot-env.js --bot incubator --session-dir ~/.semo/sessions --mailbox-dir ~/.semo/mailbox
```

```bash
python3 -c "import json; d=json.load(open('/Users/reus/.semo/sessions/incubator/.claude/settings.json')); print(json.dumps(d['hooks'].get('PreToolUse', 'MISSING'), indent=2))"
```

Expected: PreToolUse 블록 정상 출력.

### Task 11: 봇 dry-run — incubator 에서 실제 차단 확인

- [ ] **Step 1: incubator 봇 세션 재기동 (cmux read-screen 확인)**

(incubator 봇은 현재 살아있음 — workspace:8 surface:61. 재기동 시 settings.json 새로 로드)

- [ ] **Step 2: incubator 에 위험 명령 시도 메시지**

```bash
scripts/cmux-send-safe.sh --workspace workspace:8 --surface surface:61 \
  --message "테스트 — 다음 Bash 명령 실행해줘: rm -rf /tmp/destructive-test-fake-target (실제 디렉토리 아님, hook 차단 확인 목적)"
```

- [ ] **Step 3: 결과 확인 (cmux read-screen)**

Expected: 봇이 명령 실행 시도 → destructive guard 가 deny → "[DESTRUCTIVE GUARD] 차단: rm -rf on root..." 응답.

(실패 시 → settings.json regenerate 또는 봇 재기동 필요)

---

## Step 5: Integration & Documentation

### Task 12: 7봇 + semobot 전체 regenerate (옵션)

- [ ] **Step 1: 사용자 확인 — 한꺼번에 regen 할지 점진 적용할지**

incubator 검증 통과 후 사용자 결정 받음.

- [ ] **Step 2: 전체 regen (사용자 OK 시)**

```bash
node scripts/generate-bot-env.js --all --session-dir ~/.semo/sessions --mailbox-dir ~/.semo/mailbox
```

- [ ] **Step 3: 봇 세션들 재기동 (또는 다음 자연 재기동 시 자동 적용)**

### Task 13: KB decision 기록

- [ ] **Step 1: KB upsert**

```bash
semo kb upsert semo decision/superpowers-gstack-adoption-destructive-guard-freeze-2026-05-13 \
  --decided-by reus --decided-at 2026-05-13 \
  --content "$(cat <<'EOF'
# Superpowers/gstack 도입 — destructive guard 활성 + freeze skill 도입

## 결정 (2026-05-13)
gstack /careful 패턴 흡수 (Step 1) + 로컬 careful mode (Step 2) + freeze skill (Step 3) 을 SEMO 가드 시스템에 통합. dormant 상태였던 destructive guard 를 봇 settings.json PreToolUse 에 등록해 실제로 활성화.

## 변경 사항
- packages/cli/src/commands/guard.ts: DESTRUCTIVE_PATTERNS 에 5개 패턴 추가, SAFE_RM_TARGETS 헬퍼, FREEZE_GUARD HookGuard, freeze state file 유틸, freeze/unfreeze CLI
- scripts/generate-bot-env.js: settings.json template 에 PreToolUse(Bash, Edit/Write) 등록
- skill_definitions: freeze skill 신규 등록

## 동작
- 봇 세션: 자동 활성. 봇이 rm -rf /, git push -f, DROP DATABASE 등 시도 시 deny
- 로컬 reus 세션: SEMO_CAREFUL_MODE=1 (deny) 또는 SEMO_CAREFUL_MODE=ask 시 활성
- 빌드 산출물 (node_modules, dist, .next 등) clean 은 safe exception 으로 허용
- freeze: semo guard freeze <dir> 후 다른 디렉토리 Edit/Write 차단. unfreeze 로 해제

## 배경
1번 turn (Codex CLI Superpowers 활성) + 2번 turn (Claude Code Superpowers install) + 3번 turn (gstack 7개 백로그 매핑) 후, 사용자가 T2-(7) 전체 (Step 1+2+3) 진행 결정. dogfood 로 superpowers:writing-plans 사용.

## 후속
- T2-(3) Sprint micro-workflow 포팅 — 별도 plan
- T1 (TDD, systematic-debugging, verification-before-completion) 사용 시작 — 즉시 가용
- gstack-improvement-backlog 메모리 #7 항목 "완료" 표시
EOF
)"
```

### Task 14: 메모리 업데이트

- [ ] **Step 1: 기존 gstack-backlog 메모리에 #7 완료 표시**

`/Users/reus/.claude/projects/-Users-reus-Desktop-Sources-semicolon-projects-semo/memory/project_gstack-improvement-backlog.md` 의 #7 행을 다음으로 변경:

```
| 7 | 파괴적 명령 방지 강화 | `/careful`, `/freeze` | 봇 훅에 디렉토리 스코프 락 + 위험 명령 경고 | 낮음 | **완료 (2026-05-13, decision/superpowers-gstack-adoption-...)** |
```

- [ ] **Step 2: 신규 메모리 작성 — superpowers/gstack 적용 결과**

`memory/project_superpowers-gstack-applied.md` 신규:

- 로컬 Codex CLI: `superpowers@openai-curated` enabled
- 로컬 Claude Code: superpowers plugin installed
- 봇 activation: destructive guard + freeze skill via Task 10
- PlanClaw 등 7봇 노출 경로: SEMO skill_definitions

### Task 15: 3자 동기화 체크

- [ ] **Step 1: 소스코드 commit** (이미 Task 별로 commit 했음)

```bash
git log --oneline -10 | head
```

Expected: feat(guard), feat(generate-bot-env) 커밋 3-5개.

- [ ] **Step 2: KB 기록 확인**

```bash
semo kb get semo decision/superpowers-gstack-adoption-destructive-guard-freeze-2026-05-13
semo skill list | grep freeze
```

- [ ] **Step 3: 봇 파일 확인**

```bash
ls ~/.semo/sessions/incubator/.claude/settings.json
python3 -c "import json; print('PreToolUse' in json.load(open('/Users/reus/.semo/sessions/incubator/.claude/settings.json'))['hooks'])"
```

Expected: True.

### Task 16: 사용 가이드 — PlanClaw / 로컬 reus

- [ ] **Step 1: PlanClaw 적용 확인**

freeze skill 이 `skill_definitions` 에 등록되어 PlanClaw 의 `~/.openclaw-planclaw/plugin-skills/` 로 sync 되는지 (또는 OpenClaw skill loader 가 DB 에서 조회 시 노출되는지). 미동작 시 OpenClaw 측 skill loader 별도 조사.

- [ ] **Step 2: 로컬 careful mode 사용법 문서**

`.claude/rules/dangerous-commands.md` 신규 (또는 기존 `.claude/CLAUDE.md` 에 한 줄 추가):

```markdown
## Careful Mode (Local Sessions)

로컬 클로드코드/코덱스 세션에서도 destructive guard 를 활성하려면:

- `export SEMO_CAREFUL_MODE=1` (deny — 봇과 동일 차단)
- `export SEMO_CAREFUL_MODE=ask` (ask — 경고 후 진행 가능)

freeze (디렉토리 락):

- `semo guard freeze <dir>` — 그 디렉토리 밖 Edit/Write 차단
- `semo guard unfreeze` — 해제
```

---

## Self-Review

**Spec coverage:**

- ✅ Step 1: gstack 패턴 흡수 + safe exceptions (Tasks 1-3)
- ✅ Step 2: 로컬 careful mode (Tasks 4-5)
- ✅ Step 3: freeze skill (Tasks 6-9)
- ✅ 봇 활성화 (Tasks 10-11) — 가장 중요 (dormant → live)
- ✅ KB decision + 메모리 + 3자 동기화 (Tasks 12-16)

**Placeholder scan:**

- Task 7 Step 3 "guards 등록 배열에 추가" 위치는 코드 진행 시 정확 라인 확인 필요 — 미상 — **이건 placeholder. Task 시작 시 grep 으로 dispatch table 확인 필요.**
- Task 9 Step 2 의 `semo skill create` 정확한 syntax 미확정 — KB feedback memo "skill DB 등록은 직접 INSERT" 참조하여 확정 필요.
- Task 16 Step 1 의 PlanClaw 적용 검증은 정확한 방법 미상 — OpenClaw skill loader 동작 확인 후 결정.

**Type consistency:** check OK — DESTRUCTIVE_PATTERNS, FREEZE_GUARD, SAFE_RM_TARGETS, freezeStateFile() 명칭 일관.

**Bite-sized check:** 16 tasks, 평균 4-6 step. 적절.

**Risk:** 봇 일괄 regenerate (Task 12) 는 봇 재기동 필요. incubator dry-run (Task 11) 통과 후 점진 적용 권장.

---

## Execution Choice

**1. Subagent-Driven (recommended)** — fresh subagent per task + 두 단계 review (between tasks).

**2. Inline Execution** — 이 세션에서 단계별 진행 + checkpoint 마다 사용자 확인.

작업이 16 task / 5 step group 으로 분리되어 있고 SEMO 가드 시스템 + 봇 settings + DB 모두 건드리므로 subagent-driven 보다 inline + 사용자 체크포인트가 안전. 다만 토큰 cost 가 높음.

— Plan 끝 —
