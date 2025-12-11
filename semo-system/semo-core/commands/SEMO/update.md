---
name: update
description: SEMO 최신 버전으로 업데이트 (공통)
---

# /SEMO:update Command

SEMO를 최신 버전으로 업데이트합니다.

> **공통 커맨드**: 모든 SEMO 프로젝트에서 사용 가능

## Trigger

- `/SEMO:update` 명령어
- "SEMO 업데이트", "SEMO 버전 확인", "최신 버전" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **버전 확인**: 현재 설치된 SEMO 버전 vs 최신 버전 비교
2. **업데이트 실행**: semo-system을 최신 버전으로 갱신

## Action

`/SEMO:update` 실행 시 SEMO CLI의 update 명령을 호출합니다.

```markdown
[SEMO] Command: update 실행

> SEMO 버전을 확인하고 업데이트합니다.
```

## Workflow

### Step 1: 현재 버전 확인

```bash
# semo-system 존재 확인
ls semo-system/

# SEMO CLI로 상태 확인
npx @team-semicolon/semo-cli status
```

### Step 2: 최신 버전 확인

GitHub에서 최신 버전 정보 조회:

```bash
gh api repos/semicolon-devteam/semo/releases/latest --jq '.tag_name'
```

### Step 3: 클린 설치 여부 확인

업데이트 전 사용자에게 클린 설치 여부를 확인합니다:

```markdown
## 업데이트 방식 선택

1. **일반 업데이트**: 기존 설정 유지하며 업데이트
2. **클린 설치**: .claude/ 폴더를 완전히 삭제 후 재설치

클린 설치를 진행할까요? (권장: 설정 충돌 또는 문제 발생 시)
```

### Step 4: 업데이트 실행

**일반 업데이트:**

```bash
npx @team-semicolon/semo-cli update
```

또는 수동:

```bash
cd semo-system
git fetch origin main
git reset --hard origin/main
```

**클린 설치 (사용자가 선택한 경우):**

```bash
# 1. 기존 .claude 폴더 백업 (memory만 보존)
mkdir -p .claude-backup
cp -r .claude/memory .claude-backup/memory 2>/dev/null || true

# 2. .claude 폴더 완전 삭제
rm -rf .claude

# 3. SEMO 재설치
npx @team-semicolon/semo-cli init

# 4. memory 복원
cp -r .claude-backup/memory .claude/memory 2>/dev/null || true
rm -rf .claude-backup
```

### Step 5: 완료 안내

```markdown
[SEMO] Command: update 완료

SEMO 업데이트 완료

| 항목 | 이전 | 현재 |
|------|------|------|
| semo-core | v1.0.0 | v1.1.0 |
| semo-skills | v1.0.0 | v1.1.0 |
```

## Expected Output

### 업데이트 가능

```markdown
[SEMO] Command: update 실행

## SEMO 업데이트 알림

업데이트 가능한 항목이 있습니다

| 항목 | 현재 버전 | 최신 버전 |
|------|----------|----------|
| semo-core | v1.0.0 | v1.1.0 |
| semo-skills | v1.0.0 | v1.1.0 |

업데이트를 진행할까요?
```

### 이미 최신

```markdown
[SEMO] Command: update 실행

## SEMO 버전 확인

모든 구성 요소가 최신 버전입니다

| 항목 | 버전 |
|------|------|
| semo-core | v1.1.0 |
| semo-skills | v1.1.0 |
| semo-cli | v1.1.0 |
| semo-mcp | v2.0.0 |
```

## CLI Commands

```bash
# 상태 확인
npx @team-semicolon/semo-cli status

# 일반 업데이트
npx @team-semicolon/semo-cli update

# 클린 설치 (--clean 옵션)
npx @team-semicolon/semo-cli update --clean

# 강제 재설치
npx @team-semicolon/semo-cli init --force
```

## Auto-Update Check

새 세션 시작 시 자동으로 버전을 체크합니다:

**조건**:
1. 새 세션 (이전 대화 없음)
2. SEMO 설치됨 (`semo-system/` 존재)

**동작**:
- 백그라운드에서 버전 비교
- 업데이트 가능 시 알림 표시

## Related

- [SEMO CLI](../../packages/cli/)
- [SEMO Repository](https://github.com/semicolon-devteam/semo)
