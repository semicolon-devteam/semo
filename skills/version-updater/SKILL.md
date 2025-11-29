---
name: version-updater
description: |
  SAX 패키지 버전 체크 및 업데이트 알림. Use when:
  (1) 새 세션 시작 시 자동 체크, (2) 수동 버전 확인 요청,
  (3) SAX 업데이트 실행.
tools: [Bash, Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: version-updater 호출` 시스템 메시지를 첫 줄에 출력하세요.

# Version Updater Skill

> SAX 패키지 버전 체크 및 업데이트 지원

## Purpose

모든 SAX 패키지에서 공통으로 사용되는 버전 관리 기능:

1. **새 세션 시작 시** 자동 버전 체크
2. **업데이트 가능 시** 사용자에게 알림
3. **업데이트 실행** 지원

## Trigger

### 자동 트리거

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (`.claude/sax-*` 존재)

### 수동 트리거

- "SAX 버전 확인", "버전 체크" 키워드
- "SAX 업데이트해줘" 요청

## Workflow

### 1. 버전 체크

```bash
# 설치된 패키지 확인
for pkg in sax-core sax-meta sax-po sax-next sax-qa; do
  if [ -d ".claude/$pkg" ]; then
    LOCAL=$(cat ".claude/$pkg/VERSION" 2>/dev/null || echo "unknown")
    REMOTE=$(gh api "repos/semicolon-devteam/$pkg/contents/VERSION" --jq '.content' 2>/dev/null | base64 -d || echo "unknown")
    echo "$pkg: local=$LOCAL remote=$REMOTE"
  fi
done
```

### 2. 업데이트 실행

```bash
# 서브모듈 업데이트
cd .claude/{package}
git fetch origin main
git reset --hard origin/main
cd -

# 심링크 재구성 (필요 시)
# install-sax.sh --refresh-links
```

## Output Format

### 업데이트 가능 시

```markdown
[SAX] Skill: version-updater 호출

## 📦 SAX 업데이트 알림

| 패키지 | 현재 버전 | 최신 버전 | 상태 |
|--------|----------|----------|------|
| sax-core | 1.2.0 | 1.3.0 | ⬆️ 업데이트 가능 |
| sax-meta | 0.22.2 | 0.22.2 | ✅ 최신 |
| sax-next | 0.25.0 | 0.26.0 | ⬆️ 업데이트 가능 |

**업데이트하려면**: "SAX 업데이트해줘"
```

### 최신 상태 시

```markdown
[SAX] Skill: version-updater 호출

## ✅ SAX 최신 버전 확인

| 패키지 | 버전 | 상태 |
|--------|------|------|
| sax-core | 1.3.0 | ✅ 최신 |
| sax-next | 0.26.0 | ✅ 최신 |

모든 SAX 패키지가 최신 상태입니다.
```

### 업데이트 완료 시

```markdown
[SAX] Skill: version-updater 호출

## 🔄 SAX 업데이트 완료

| 패키지 | 이전 버전 | 현재 버전 |
|--------|----------|----------|
| sax-core | 1.2.0 | 1.3.0 |
| sax-next | 0.25.0 | 0.26.0 |

업데이트가 완료되었습니다.
```

## SAX Message

```markdown
[SAX] Skill: version-updater 호출

{output}
```

## References

- [Update Process](references/update-process.md) - 상세 업데이트 절차

## Related

- [sax-core/PRINCIPLES.md](../../PRINCIPLES.md) - SAX 핵심 원칙
