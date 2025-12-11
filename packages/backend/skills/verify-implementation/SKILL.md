---
name: verify-implementation
description: |
  구현 품질 종합 검증. Use when:
  (1) 구현 완료 후 최종 검증, (2) PR 전 품질 체크,
  (3) 팀 코덱스 + Reactive + 테스트 통합 검증.
tools: [Bash, Grep, Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: verify-implementation 호출 - {검증 대상}` 시스템 메시지를 첫 줄에 출력하세요.

# Verify Implementation Skill

@./../_shared/quality-gates.md

> 구현 완료 후 종합 품질 검증

## When to Use

- 구현 완료 후 최종 검증
- PR 생성 전 품질 체크
- 모든 검증 스킬 통합 실행

## Verification Pipeline

```text
verify-implementation
    ├── 1. skill:check-team-codex (품질 게이트)
    ├── 2. skill:verify-reactive (Reactive 검증)
    ├── 3. Test Execution (테스트 실행)
    └── 4. Coverage Check (커버리지)
```

## Execution Steps

### Step 1: Team Codex 검증

```javascript
skill: check-team-codex();
```

검사 항목:
- ktlintCheck
- compileKotlin
- 기본 코드 품질

### Step 2: Reactive 검증

```javascript
skill: verify-reactive();
```

검사 항목:
- `.block()` 호출 없음
- suspend fun 패턴
- Flow 패턴

### Step 3: 테스트 실행

```bash
./gradlew test
```

검사 항목:
- 모든 테스트 통과
- 테스트 커버리지

### Step 4: 통합 검증

```bash
./gradlew check
```

## Output Format

### 검증 통과

```markdown
[SEMO] Skill: verify-implementation 완료

## 종합 검증 결과: ✅ PASS

| 검증 항목 | 결과 | 상세 |
|----------|------|------|
| Team Codex | ✅ | ktlint, compile 통과 |
| Reactive | ✅ | .block() 0건 |
| Tests | ✅ | 45/45 통과 |
| Coverage | ✅ | 85% (목표: 80%) |

## PR 준비 완료

다음 단계:
1. `git add .`
2. `git commit -m "✨ #{issue} Implement {feature}"`
3. PR 생성: "PR 만들어줘"
```

### 검증 실패

```markdown
[SEMO] Skill: verify-implementation 완료

## 종합 검증 결과: ❌ FAIL

| 검증 항목 | 결과 | 상세 |
|----------|------|------|
| Team Codex | ✅ | 통과 |
| Reactive | ❌ | .block() 2건 |
| Tests | ❌ | 43/45 통과 |
| Coverage | ⚠️ | 75% (목표: 80%) |

## 실패 상세

### Reactive 위반
- PostService.kt:45 - `.block()` 호출
- UserService.kt:23 - `.block()` 호출

### 테스트 실패
- PostRepositoryTest.`should save post` - FAILED
- PostServiceTest.`should create post` - FAILED

## 수정 필요 사항

1. Reactive 위반 수정 (`skill:verify-reactive` 참조)
2. 실패 테스트 수정
3. 커버리지 향상 (5% 추가 필요)

수정 후 재검증: `skill:verify-implementation`
```

## Quality Gates

| Gate | 기준 | 필수 |
|------|------|------|
| ktlintCheck | 에러 0건 | ✅ |
| compileKotlin | 성공 | ✅ |
| .block() | 0건 (main) | ✅ |
| Tests | 100% 통과 | ✅ |
| Coverage | ≥80% | ⚠️ 권장 |

## Critical Rules

1. **All Gates Must Pass**: 하나라도 실패 시 PR 금지
2. **No Skip**: 검증 스킵 절대 금지
3. **Fix Before Commit**: 문제 수정 후 커밋

## Dependencies

- `check-team-codex` - 품질 게이트
- `verify-reactive` - Reactive 검증

## References

- [Quality Gates](references/quality-gates.md)
- [Coverage Guide](references/coverage-guide.md)
