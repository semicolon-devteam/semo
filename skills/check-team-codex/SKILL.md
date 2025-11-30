---
name: check-team-codex
description: 코드를 Team Codex 표준에 검증. Use when (1) 커밋 전, (2) 검증 단계, (3) 품질 게이트.
tools: [Bash, Read, Grep]
---

# Check Team Codex Skill

@./../_shared/quality-gates.md
@./../_shared/kotlin-patterns.md

> 코드를 Semicolon 팀 표준에 맞게 자동 검증

## 규칙 참조 (SoT)

> **모든 Team Codex 규칙은 sax-core/TEAM_RULES.md에서 관리됩니다.**

```bash
# 로컬 참조
.claude/sax-core/TEAM_RULES.md

# 원격 참조
gh api repos/semicolon-devteam/sax-core/contents/TEAM_RULES.md --jq '.content' | base64 -d
```

## Quick Start

```bash
# Pre-commit 필수 체크
./gradlew ktlintCheck && ./gradlew compileKotlin

# Debug 코드 확인
grep -r "println" src/main/ --include="*.kt"

# .block() 확인
grep -r "\.block()" src/main/ --include="*.kt"

# TODO 확인
grep -r "TODO\|FIXME" src/main/ --include="*.kt"
```

## 검증 항목

| 항목 | 명령어 | 기대 결과 |
|------|--------|----------|
| ktlint | `./gradlew ktlintCheck` | 0 violations |
| Compile | `./gradlew compileKotlin` | BUILD SUCCESSFUL |
| Tests | `./gradlew test` | All passed |

## 금지 사항

| 항목 | 설명 | 검출 |
|------|------|------|
| `.block()` | Reactive 위반 | `grep -r "\.block()" src/` |
| `println` | Debug 코드 | `grep -r "println" src/main/` |
| `enum class` | 직렬화 문제 | `grep -r "enum class" src/` |
| `@Suppress` | 경고 무시 | `grep -r "@Suppress" src/` |

## Severity Levels

| Level | 항목 | 조치 |
|-------|------|------|
| 🔴 CRITICAL | .block(), 컴파일 에러, 테스트 실패 | PR 차단 |
| 🟡 WARNING | println, TODO, @Suppress | 수정 권장 |
| 🟢 INFO | 스타일 제안 | 선택적 |

## Output Format

```markdown
[SAX] Skill: check-team-codex 실행

## 검사 결과

| Check | Status |
|-------|--------|
| ktlint | ✅ 0 violations |
| Compile | ✅ BUILD SUCCESSFUL |
| .block() | ✅ 없음 |
| println | ⚠️ 2개 발견 |

### 🟡 WARNING

- `PostService.kt:45`: println 발견
- `UserService.kt:23`: println 발견

**조치**: Debug 코드를 제거하세요.
```

## Related Skills

- `verify-reactive` - Reactive 패턴 검증
- `implement` - v0.4.x CODE phase에서 사용
- `git-workflow` - 커밋 전 품질 검사

## References

- [Check Items](references/check-items.md)
- [Output Format](references/output-format.md)
