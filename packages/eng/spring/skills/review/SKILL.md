---
name: review
description: |
  Spring Boot 프로젝트 리뷰. verify-implementation 기반으로 코드 품질, 아키텍처,
  Reactive 패턴을 검증하고 PR에 리뷰 코멘트를 자동 등록합니다.
  Use when (1) "/SEMO:review", (2) "리뷰해줘", "PR 리뷰", (3) "코드 리뷰".
tools: [Bash, Read, Grep, Glob]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: review (spring)` 시스템 메시지를 첫 줄에 출력하세요.

# Spring Boot 리뷰 Skill

> verify-implementation 확장 + PR 리뷰 등록

## Trigger Keywords

- `/SEMO:review`
- `리뷰해줘`, `PR 리뷰`, `코드 리뷰`

## 워크플로우

### Phase 1: 메타데이터 검증

```bash
# 브랜치명 규칙 확인
BRANCH=$(git branch --show-current)

# 이슈 연결 확인
gh issue view {issue} --json title,labels
```

**검증 항목**:
- [ ] 브랜치명 규칙 준수 (`{issue}-{feature-name}`)
- [ ] 이슈 연결됨
- [ ] PR 생성됨

### Phase 2: 코드 품질

```bash
# Kotlin lint 검사
./gradlew ktlintCheck

# 테스트 실행
./gradlew test

# 테스트 커버리지
./gradlew jacocoTestReport
```

**검증 항목**:
- [ ] ktlint/Checkstyle 통과
- [ ] 테스트 통과
- [ ] 테스트 커버리지 ≥80%
- [ ] Reactive 패턴 준수 (`.block()` 없음)

#### Reactive 패턴 검증

```bash
# .block() 사용 검색 (금지)
grep -r "\.block()" src/main/kotlin/

# blockOptional() 사용 검색 (금지)
grep -r "\.blockOptional()" src/main/kotlin/
```

### Phase 3: 아키텍처 검증

**Layer 구조 확인**:

```
src/main/kotlin/com/semicolon/{service}/
├── controller/     # REST Controller
├── service/        # Business Logic
├── repository/     # Data Access
├── domain/         # Entity/DTO
└── config/         # Configuration
```

**검증 항목**:
- [ ] Layer 구조 준수 (Controller → Service → Repository)
- [ ] DTO/Entity 분리
- [ ] Exception Handling (@RestControllerAdvice)
- [ ] Transaction 적절성 (@Transactional)

#### Layer 의존성 검증

```bash
# Controller에서 Repository 직접 호출 금지
grep -r "@Repository" src/main/kotlin/**/controller/
```

### Phase 4: PR 리뷰 등록

#### 4.1 리뷰 결과 종합

| Severity | 조건 | 판정 |
|----------|------|------|
| ✅ APPROVE | Critical 0건 | 승인 |
| 🟡 COMMENT | Critical 0건, Warning 1건+ | 코멘트 |
| 🔴 REQUEST_CHANGES | Critical 1건+ | 변경 요청 |

#### 4.2 PR 리뷰 코멘트 등록

```bash
# PR 번호 조회
PR_NUMBER=$(gh pr list --head $(git branch --show-current) --json number -q '.[0].number')

# 리뷰 등록
gh pr review $PR_NUMBER --{approve|comment|request-changes} --body "리뷰 코멘트..."
```

## 출력 포맷

### 리뷰 진행 중

```markdown
[SEMO] Skill: review (spring)

📋 이슈: #{issue_number} "{title}"
🔍 PR: #{pr_number}

=== Phase 1: 메타데이터 검증 ===
- 브랜치명: ✅ 규칙 준수
- 이슈 연결: ✅ #{issue_number}

=== Phase 2: 코드 품질 ===
- ktlint: ✅ 통과
- 테스트: ✅ 45/45 통과
- 커버리지: ✅ 85%
- Reactive: ✅ .block() 없음

=== Phase 3: 아키텍처 검증 ===
- Layer 구조: ✅ 준수
- DTO/Entity: ✅ 분리됨
- Exception: ✅ @RestControllerAdvice 사용
```

### 리뷰 완료

```markdown
## 최종 결과: ✅ APPROVE

모든 검증 항목을 통과했습니다.

PR #{pr_number}에 리뷰 코멘트를 등록합니다...
✅ 리뷰 등록 완료
```

## Severity 분류

### Critical (PR 차단)

- `.block()` 사용
- 테스트 실패
- ktlint 에러
- Layer 의존성 위반

### Warning (수정 권장)

- 테스트 커버리지 < 80%
- 누락된 @Transactional
- 하드코딩된 값

### Suggestion (선택적 개선)

- 코드 리팩토링 제안
- 성능 최적화

## References

- [verify-implementation Skill](../verify-implementation/SKILL.md) - 구현 검증 상세 로직
- [Team Codex - Spring](references/team-codex-spring.md) - Spring 개발 표준
