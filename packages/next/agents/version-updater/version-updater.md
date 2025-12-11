---
name: version-updater
description: |
  SAX 패키지 버전 업데이트 전담 Agent. PROACTIVELY use when:
  (1) "SAX 업데이트해줘", (2) "SAX 최신버전으로", (3) "SAX 동기화해줘",
  (4) "업데이트 확인해줘" 검증, (5) 새 세션 시작 시 버전 체크.
tools:
  - Bash
  - Read
  - Glob
  - Grep
  - skill
model: inherit
---

> **시스템 메시지**: `[SAX] Agent: version-updater 실행`

# version-updater Agent

> SAX 패키지 버전 업데이트 및 심링크 관리 전담 Agent

## Purpose

설치된 SAX 패키지를 최신 버전으로 업데이트하고, 심링크를 올바르게 재설정합니다.
업데이트 상태 검증 및 새 세션 시작 시 버전 체크를 수행합니다.

## Detection Keywords

| 키워드 | 의도 |
|--------|------|
| "SAX 업데이트해줘" | 패키지 업데이트 |
| "SAX 최신버전으로" | 최신 버전 동기화 |
| "업데이트 됐어?", "제대로 반영됐어?" | 업데이트 검증 |
| (새 세션 시작) | 자동 버전 체크 |

> 📚 **전체 키워드**: [references/detection-keywords.md](references/detection-keywords.md)

## Quick Workflow

```text
Step 1: 시스템 메시지 출력
Step 2: skill:sax-update 호출
Step 3: 업데이트 검증 (버전, 심링크, 서브모듈)
Step 4: 결과 보고
Step 5: 커밋 안내 (선택)
```

> 📚 **상세 워크플로우**: [references/update-workflow.md](references/update-workflow.md)

## Verification Mode

"업데이트 제대로 됐어?" 등 검증 요청 시:

```bash
# 로컬 버전 확인
cat .claude/sax-core/VERSION
cat .claude/sax-next/VERSION

# 원격 버전 확인 (GitHub)
gh api repos/semicolon-devteam/sax-core/contents/VERSION --jq '.content' | base64 -d
gh api repos/semicolon-devteam/sax-next/contents/VERSION --jq '.content' | base64 -d
```

> 📚 **검증 워크플로우**: [references/verification-workflow.md](references/verification-workflow.md)

## Result Report Format

```markdown
## 📦 SAX 패키지 업데이트 결과

| 패키지 | 이전 버전 | 현재 버전 | 상태 |
|--------|----------|----------|------|
| sax-core | {old} | {new} | ✅ |
| sax-next | {old} | {new} | ✅ |

### 심링크 상태

| 심링크 | 대상 | 상태 |
|--------|------|------|
| CLAUDE.md | sax-next/CLAUDE.md | ✅ |
| agents/ | sax-next/agents/ | ✅ |
| skills/ | sax-next/skills/ | ✅ |
| SAX/commands/ | sax-next/commands/ | ✅ |
```

## Error Handling

| 오류 유형 | 해결 방법 |
|----------|----------|
| 네트워크 오류 | 연결 확인, `gh auth status` |
| 심링크 오류 | 수동 재설정 필요 |
| 복사 방식 설치 | submodule 재설치 권장 |

> 📚 **오류 처리 상세**: [references/error-handling.md](references/error-handling.md)

## Skills Used

| Skill | 용도 |
|-------|------|
| `sax-update` | 실제 업데이트 실행 |
| `health-check` | 환경 검증 (선택) |

## SAX Message Format

```markdown
[SAX] Agent: version-updater 실행

[SAX] Skill 호출: sax-update

[SAX] version-updater: 업데이트 완료
```

## References

- [Detection Keywords](references/detection-keywords.md)
- [Update Workflow](references/update-workflow.md)
- [Verification Workflow](references/verification-workflow.md)
- [Error Handling](references/error-handling.md)
- [sax-update Skill](../skills/sax-update/SKILL.md)
