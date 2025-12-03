---
name: sax-architecture-checker
description: |
  .claude 디렉토리 구조 검증 및 자동 수정. Use when:
  (1) SAX 업데이트 후 무결성 체크, (2) 심링크 깨짐 의심 시,
  (3) version-updater에서 자동 호출, (4) 새 세션 시작 시.
tools: [Bash, Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: sax-architecture-checker 호출` 시스템 메시지를 첫 줄에 출력하세요.

# sax-architecture-checker Skill

> .claude 디렉토리 구조 검증 및 자동 수정

## 호출 모드

| 모드 | 동작 | 사용 상황 |
|------|------|----------|
| (기본) | 검증 + 자동 수정 | 수동 호출, 업데이트 후 |
| `--check-only` | 검증만 수행, 수정 안함 | version-updater Phase 2에서 호출 |

### --check-only 모드

검증만 수행하고 자동 수정하지 않습니다:

**출력 포맷** (version-updater 파싱용):

```markdown
[SAX] Skill: sax-architecture-checker --check-only 실행

## 구조 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| sax-core | ✅ | 존재 |
| sax-{pkg} | ✅ | sax-pm |
| CLAUDE.md | ✅ | 심링크 유효 |
| agents/ | ⚠️ | 깨진 심링크 2개 |
| skills/ | ✅ | 8 symlinks |
| commands/SAX | ❌ | .merged 마커 누락 |

**결과**: ⚠️ 문제 발견 (자동 수정 필요)
```

**결과 상태**:

- `✅ 구조 정상` - 모든 검증 통과
- `⚠️ 문제 발견` - 수정 필요 (version-updater가 기본 모드로 재호출 결정)

## Purpose

SAX가 설치된 `.claude` 디렉토리의 구조를 검증하고, 문제 발견 시 자동으로 수정합니다.

## Trigger

- `/SAX:health` 명령어
- `version-updater` 업데이트 완료 후 자동 호출
- "심링크 확인", ".claude 확인", "SAX 상태" 키워드

## Workflow

### 1. 패키지 감지

```bash
PKG=$(for p in po next qa meta pm backend infra; do
  [ -d ".claude/sax-$p" ] && echo $p && break
done)
```

### 2. 검증 항목

| 항목 | 검증 | 수정 |
|------|------|------|
| sax-core | 디렉토리 존재 | - |
| sax-{pkg} | 디렉토리 존재 | - |
| CLAUDE.md | 심링크 유효성 | 재생성 |
| agents/ | .merged 마커 + 심링크 | 재생성 |
| skills/ | .merged 마커 + 심링크 | 재생성 |
| commands/SAX/ | .merged 마커 + 심링크 | 재생성 |

### 3. 검증 실행

```bash
# 깨진 심링크 탐지
find .claude -type l ! -exec test -e {} \; -print 2>/dev/null

# .merged 마커 확인
[ -f ".claude/agents/.merged" ] && echo "agents: OK" || echo "agents: MISSING"
[ -f ".claude/skills/.merged" ] && echo "skills: OK" || echo "skills: MISSING"
[ -f ".claude/commands/SAX/.merged" ] && echo "commands/SAX: OK" || echo "commands/SAX: MISSING"
```

### 4. 자동 수정

문제 발견 시 `install-sax.sh`와 동일한 로직으로 수정:

```bash
# CLAUDE.md 수정
rm -f ".claude/CLAUDE.md"
ln -s "sax-$PKG/CLAUDE.md" ".claude/CLAUDE.md"

# 병합 디렉토리 수정
# → references/fix-logic.md 참조
```

### 5. 결과 보고

```markdown
## .claude 디렉토리 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| 패키지 | ✅ | sax-pm |
| CLAUDE.md | ✅ | sax-pm/CLAUDE.md |
| agents/ | ⚠️ → ✅ | 심링크 2개 재생성 |
| skills/ | ✅ | 8 symlinks |
| commands/SAX | ❌ → ✅ | 디렉토리 생성 + 4 symlinks |

**결과**: 2개 항목 자동 수정됨
```

## 🔴 세션 재시작 권장

> **심링크 재설정 후에는 세션 재시작을 권장합니다.**

### 재시작이 필요한 경우

| 상황 | 재시작 필요 | 이유 |
|------|-------------|------|
| 심링크 디렉토리 → 실제 디렉토리 변환 | ✅ 권장 | Claude Code가 캐시한 경로 무효화 |
| 새 skill/agent 심링크 추가 | ✅ 권장 | 새 컴포넌트 인식 필요 |
| 깨진 심링크 수정 | ⚠️ 선택 | 기존 캐시에 따라 다름 |
| .merged 마커만 추가 | ❌ 불필요 | 경로 변경 없음 |

### 결과 메시지에 안내 포함

심링크가 재설정된 경우 아래 안내를 출력:

```markdown
⚠️ **세션 재시작 권장**

심링크 구조가 변경되었습니다. Claude Code가 변경된 경로를 인식하도록
**새 세션을 시작**하는 것을 권장합니다.

재시작 방법: Claude Code 창을 닫고 다시 열기
```

### 판단 기준

```bash
# 심링크 재설정 여부 감지
SYMLINK_CHANGED=false

# 심링크 디렉토리가 실제 디렉토리로 변환된 경우
if [ "$dir_was_symlink" = true ]; then
  SYMLINK_CHANGED=true
fi

# 새 심링크가 생성된 경우
if [ $new_symlinks_count -gt 0 ]; then
  SYMLINK_CHANGED=true
fi
```

## References

- [Fix Logic](references/fix-logic.md) - 자동 수정 로직 상세
