---
name: sax-update
description: SAX 패키지 최신 버전 업데이트. Use when (1) "SAX 업데이트해줘", (2) "최신버전으로", (3) "SAX 동기화".
tools: [Bash, Read, Grep]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: sax-update 실행` 시스템 메시지를 첫 줄에 출력하세요.

# sax-update Skill

> SAX 패키지를 최신 버전으로 업데이트

## Purpose

설치된 SAX 패키지(sax-core, sax-po)를 GitHub 최신 버전으로 업데이트합니다.

## Quick Start

```bash
# 1. 현재 버전 확인
cat .claude/sax-core/VERSION
cat .claude/sax-po/VERSION 2>/dev/null || cat .claude/VERSION

# 2. submodule 업데이트 (submodule 방식인 경우)
cd .claude/sax-core && git pull origin main && cd ../..
cd .claude/sax-po && git pull origin main && cd ../.. 2>/dev/null

# 3. 업데이트 후 버전 확인
cat .claude/sax-core/VERSION
```

## Execution Flow

### Step 1: 설치 방식 감지

```bash
# submodule 방식 확인
if [ -f ".claude/sax-core/.git" ] || [ -d ".claude/sax-core/.git" ]; then
  echo "submodule 방식"
else
  echo "복사 방식 - 수동 업데이트 필요"
fi
```

### Step 2: 현재 버전 확인

```bash
echo "=== 현재 버전 ==="
echo "sax-core: $(cat .claude/sax-core/VERSION)"
echo "sax-po: $(cat .claude/sax-po/VERSION 2>/dev/null || cat .claude/VERSION)"
```

### Step 3: 업데이트 실행

**Submodule 방식**:

```bash
cd .claude/sax-core && git fetch origin && git pull origin main
cd .claude/sax-po && git fetch origin && git pull origin main
```

**복사 방식**:

```markdown
⚠️ 복사 방식으로 설치되어 있습니다.

수동 업데이트가 필요합니다:
1. docs 레포에서 최신 버전 확인
2. `rsync -av --delete sax/packages/sax-po/ .claude/sax-po/`
3. 또는 `git submodule add`로 submodule 방식으로 전환
```

### Step 4: 심링크 재설정

> **🔴 필수**: 업데이트 후 **모든 심링크(CLAUDE.md, agents, skills, commands/SAX)**가 올바르게 설정되어 있는지 확인하고 재설정합니다.
>
> ⚠️ **주의**: `commands/SAX` 심링크가 누락되면 `/SAX:*` 명령어가 인식되지 않습니다.

```bash
# .claude 디렉토리로 이동
cd .claude

# 기존 심링크 확인 및 재설정
# CLAUDE.md 심링크
if [ -L "CLAUDE.md" ]; then
  rm CLAUDE.md
fi
ln -sf sax-po/CLAUDE.md CLAUDE.md

# agents 심링크
if [ -L "agents" ]; then
  rm agents
fi
ln -sf sax-po/agents agents

# skills 심링크
if [ -L "skills" ]; then
  rm skills
fi
ln -sf sax-po/skills skills

# 🔴 commands/SAX 심링크 - 필수!
# Claude Code는 .claude/commands/SAX/*.md 에서 /SAX:* 명령어 인식
mkdir -p commands
if [ -L "commands/SAX" ]; then
  rm commands/SAX
fi
ln -sf ../sax-po/commands commands/SAX

cd ..
```

**심링크 확인**:

```bash
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/commands/SAX
```

**예상 출력**:

```text
.claude/CLAUDE.md -> sax-po/CLAUDE.md
.claude/agents -> sax-po/agents
.claude/skills -> sax-po/skills
.claude/commands/SAX -> ../sax-po/commands
```

### Step 5: 업데이트 결과 출력

```markdown
[SAX] Update: 업데이트 완료

| 패키지 | 이전 버전 | 현재 버전 |
|--------|----------|----------|
| sax-core | 0.1.0 | 0.2.0 |
| sax-po | 0.1.0 | 0.2.0 |

✅ SAX 패키지가 최신 버전으로 업데이트되었습니다.

**심링크 상태**:
- CLAUDE.md -> sax-po/CLAUDE.md ✅
- agents/ -> sax-po/agents/ ✅
- skills/ -> sax-po/skills/ ✅
- commands/SAX/ -> sax-po/commands/ ✅
```

### Step 6: 서브모듈 커밋 (선택)

업데이트 후 서브모듈 변경사항을 커밋할 수 있습니다:

```bash
git add .claude/sax-core .claude/sax-po
git commit -m ":bookmark: [SAX] Sync to v{new_version}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**커밋 메시지 형식**: `:bookmark: [SAX] Sync to v{version}`

- `{version}`: 업데이트된 메인 패키지(sax-po)의 버전

## SAX Message Format

```markdown
[SAX] Skill: sax-update 실행

=== 현재 버전 ===
- sax-core: {current_core_version}
- sax-po: {current_po_version}

[SAX] Update: 업데이트 중...

[SAX] Update: 업데이트 완료
- sax-core: {old} → {new}
- sax-po: {old} → {new}
```

## Error Handling

### 네트워크 오류
```markdown
❌ GitHub 연결 실패

네트워크 연결을 확인하세요.
```

### 권한 오류
```markdown
❌ Git 권한 오류

GitHub 인증을 확인하세요: `gh auth status`
```

### 이미 최신
```markdown
✅ 이미 최신 버전입니다.

- sax-core: 0.2.0
- sax-po: 0.2.0
```

## Related

- [health-check Skill](../health-check/SKILL.md) - 환경 검증
- [SAX Core Packaging](https://github.com/semicolon-devteam/sax-core/blob/main/PACKAGING.md)

## References

- [Update Workflow](references/update-workflow.md)
- [Version Check](references/version-check.md)
