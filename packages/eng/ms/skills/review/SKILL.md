---
name: review
description: |
  마이크로서비스 프로젝트 리뷰. 서비스 독립성, 비동기 패턴, Prisma 스키마를 검증하고
  PR에 리뷰 코멘트를 자동 등록합니다.
  Use when (1) "/SEMO:review", (2) "리뷰해줘", "PR 리뷰", (3) "코드 리뷰".
tools: [Bash, Read, Grep, Glob]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: review (ms)` 시스템 메시지를 첫 줄에 출력하세요.

# Microservice 리뷰 Skill

> 마이크로서비스 아키텍처 검증 + PR 리뷰 등록

## Trigger Keywords

- `/SEMO:review`
- `리뷰해줘`, `PR 리뷰`, `코드 리뷰`

## 워크플로우

### Phase 1: 서비스 구조 검증

```bash
# 서비스 디렉토리 구조 확인
ls -la services/

# 독립 실행 가능 확인
ls services/*/package.json
ls services/*/Dockerfile
```

**검증 항목**:
- [ ] 독립 실행 가능 (package.json, Dockerfile 존재)
- [ ] core-db work queue 사용
- [ ] 환경변수 설정 (.env.example 존재)
- [ ] ms-logger 로깅 사용

### Phase 2: 코드 품질

```bash
# ESLint 검사
npm run lint

# TypeScript 타입 체크
npx tsc --noEmit

# 테스트 실행
npm test
```

**검증 항목**:
- [ ] ESLint/Prettier 통과
- [ ] TypeScript 타입 안전성
- [ ] 테스트 통과

### Phase 3: Prisma 스키마 검증

```bash
# Prisma 스키마 유효성
npx prisma validate

# 스키마 일관성
npx prisma format --check
```

**검증 항목**:
- [ ] Prisma 스키마 유효
- [ ] 스키마 포맷 일관성
- [ ] 마이그레이션 파일 존재

### Phase 4: 비동기 패턴 검증

**검증 항목**:
- [ ] 이벤트 스키마 정의
- [ ] 에러 핸들링 (try-catch, 재시도 로직)
- [ ] Dead letter queue 처리

### Phase 5: PR 리뷰 등록

```bash
# PR 번호 조회
PR_NUMBER=$(gh pr list --head $(git branch --show-current) --json number -q '.[0].number')

# 리뷰 등록
gh pr review $PR_NUMBER --{approve|comment|request-changes} --body "리뷰 코멘트..."
```

## 출력 포맷

### 리뷰 진행 중

```markdown
[SEMO] Skill: review (ms)

📋 서비스: {service_name}
🔍 PR: #{pr_number}

=== Phase 1: 서비스 구조 ===
- 독립 실행: ✅ Dockerfile 존재
- Work Queue: ✅ core-db 사용
- 환경변수: ✅ .env.example 존재

=== Phase 2: 코드 품질 ===
- ESLint: ✅ 통과
- TypeScript: ✅ 에러 없음
- 테스트: ✅ 12/12 통과

=== Phase 3: Prisma 스키마 ===
- 유효성: ✅
- 포맷: ✅

=== Phase 4: 비동기 패턴 ===
- 이벤트 스키마: ✅
- 에러 핸들링: ✅
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

- 서비스 독립성 위반
- Prisma 스키마 오류
- TypeScript/ESLint 에러
- 테스트 실패

### Warning (수정 권장)

- 환경변수 문서화 누락
- 에러 핸들링 미흡
- 로깅 누락

### Suggestion (선택적 개선)

- 성능 최적화
- 코드 리팩토링

## References

- [onboarding-ms Skill](../onboarding-ms/SKILL.md) - MS 온보딩 가이드
- [scaffold-service Skill](../scaffold-service/SKILL.md) - 서비스 스캐폴딩
