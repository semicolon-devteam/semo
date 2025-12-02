---
name: update
description: SAX 패키지 버전 업데이트 - version-updater skill 호출 (공통)
---

# /SAX:update Command

SAX 패키지의 최신 버전을 확인하고 업데이트합니다.

> **공통 커맨드**: 모든 SAX 패키지에서 사용 가능

## Trigger

- `/SAX:update` 명령어
- "SAX 업데이트", "SAX 버전 확인", "최신 버전" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **버전 확인**: 설치된 패키지의 현재 버전 vs 최신 버전 비교
2. **업데이트 실행**: 최신 버전으로 패키지 업데이트

## Action

`/SAX:update` 실행 시 `sax-core/skill:version-updater`를 호출합니다.

```markdown
[SAX] Skill: version-updater 호출

> sax-core/skills/version-updater 스킬을 호출합니다.
```

## Workflow

### Step 1: 설치된 패키지 확인

```bash
# 설치된 SAX 패키지 목록
ls -d .claude/sax-* 2>/dev/null | xargs -I {} basename {}
```

### Step 2: 버전 비교

각 패키지의 로컬 버전과 원격(GitHub) 버전을 비교합니다.

```bash
# 로컬 버전
cat .claude/sax-core/VERSION

# 원격 버전
gh api repos/semicolon-devteam/sax-core/contents/VERSION \
  --jq '.content' | base64 -d
```

### Step 3: 업데이트 알림

```markdown
[SAX] Skill: version-updater 호출

## SAX 업데이트 알림

| 패키지 | 현재 버전 | 최신 버전 | 상태 |
|--------|----------|----------|------|
| sax-core | 0.9.2 | 0.10.0 | ⬆️ 업데이트 가능 |
| sax-meta | 0.35.0 | 0.35.0 | ✅ 최신 |

업데이트를 진행할까요? (예/아니오)
```

### Step 4: 업데이트 실행

```bash
# 서브모듈 업데이트
cd .claude/sax-core
git fetch origin main
git reset --hard origin/main
cd ../..

# 심링크 갱신 (필요시)
# install-sax.sh 재실행
```

### Step 5: 완료 안내

```markdown
[SAX] Skill: version-updater 완료

✅ SAX 업데이트 완료

| 패키지 | 이전 버전 | 현재 버전 |
|--------|----------|----------|
| sax-core | 0.9.2 | 0.10.0 |

변경 내역: sax-core/CHANGELOG/0.10.0.md 참조
```

## Expected Output

### 업데이트 가능

```markdown
[SAX] Skill: version-updater 호출

## SAX 업데이트 알림

⬆️ **업데이트 가능한 패키지가 있습니다**

| 패키지 | 현재 버전 | 최신 버전 |
|--------|----------|----------|
| sax-core | 0.9.2 | 0.10.0 |

업데이트를 진행할까요?
```

### 모두 최신

```markdown
[SAX] Skill: version-updater 호출

## SAX 버전 확인

✅ **모든 패키지가 최신 버전입니다**

| 패키지 | 버전 |
|--------|------|
| sax-core | 0.10.0 |
| sax-meta | 0.35.0 |
```

## Auto-Update Trigger

새 세션 시작 시 자동으로 버전을 체크합니다:

**조건**:
1. 새 세션 (이전 대화 없음)
2. SAX 설치됨 (`.claude/sax-*` 존재)

**동작**:
- 백그라운드에서 버전 비교
- 업데이트 가능 시 알림 표시

## Related

- [version-updater Skill](../../skills/version-updater/SKILL.md)
- [SAX Core - Principles](../../PRINCIPLES.md)
