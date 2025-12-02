# claude-health

> .claude 디렉토리 구조 검증 및 자동 수정. Use when (1) SAX 업데이트 후 무결성 체크, (2) 심링크 깨짐 의심 시, (3) version-updater에서 자동 호출.

## 시스템 메시지

```
[SAX] Skill: claude-health 실행
```

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

## References

- [Fix Logic](references/fix-logic.md) - 자동 수정 로직 상세
