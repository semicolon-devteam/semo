---
name: review
description: |
  마이크로서비스 프로젝트 리뷰. 서비스 독립성, 비동기 패턴, 스키마를 검증하고
  PR에 리뷰 코멘트를 자동 등록합니다. Next.js, Node.js, Go 기술 스택 지원.
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

## 지원 기술 스택

| 스택 | 서비스 예시 | 감지 방법 |
|------|------------|----------|
| **Next.js** | ms-notifier, ms-scheduler, ms-ledger, ms-allocator | `next.config.js` 또는 `next.config.mjs` 존재 |
| **Node.js** | ms-media-processor, ms-crawler, ms-collector | `package.json` 존재, Next.js 아님 |
| **Go** | ms-gamer | `go.mod` 존재 |

## 워크플로우

### Phase 0: 기술 스택 감지 (NON-NEGOTIABLE)

> **모든 리뷰는 기술 스택 감지로 시작합니다.**

```bash
# 기술 스택 자동 감지
if [ -f "go.mod" ]; then
  STACK="go"
elif [ -f "next.config.js" ] || [ -f "next.config.mjs" ]; then
  STACK="nextjs"
elif [ -f "package.json" ]; then
  STACK="nodejs"
else
  STACK="unknown"
fi
echo "감지된 스택: $STACK"
```

---

### Phase 1: 서비스 구조 검증

```bash
# 공통: 독립 실행 가능 확인
ls Dockerfile .env.example

# Node.js/Next.js
ls package.json

# Go
ls go.mod Makefile
```

**검증 항목**:
- [ ] 독립 실행 가능 (Dockerfile 존재)
- [ ] 환경변수 설정 (.env.example 존재)
- [ ] 헬스체크 엔드포인트 존재

---

### Phase 2: 코드 품질 (기술 스택별)

#### Next.js / Node.js

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

#### Go

```bash
# 코드 포맷 검사
gofmt -l .

# 정적 분석
go vet ./...

# 린트 검사 (golangci-lint 설치 필요)
golangci-lint run 2>/dev/null || echo "golangci-lint 미설치"

# 테스트 실행
go test ./...
```

**검증 항목**:
- [ ] gofmt 통과
- [ ] go vet 통과
- [ ] golangci-lint 통과 (선택)
- [ ] 테스트 통과

---

### Phase 3: 스키마 검증 (기술 스택별)

#### Next.js / Node.js (Prisma)

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

#### Go (SQL/sqlc)

```bash
# sqlc 검증 (사용 시)
sqlc compile 2>/dev/null || echo "sqlc 미사용"

# 마이그레이션 파일 확인
ls db/migrations/*.sql 2>/dev/null || ls migrations/*.sql 2>/dev/null
```

**검증 항목**:
- [ ] SQL 마이그레이션 파일 존재
- [ ] sqlc 스키마 유효 (사용 시)

---

### Phase 4: 비동기 패턴 검증

**검증 항목**:
- [ ] 이벤트 스키마 정의
- [ ] 에러 핸들링 (try-catch/recover, 재시도 로직)
- [ ] Dead letter queue 처리 (해당 시)

---

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
🔧 기술 스택: {nextjs|nodejs|go}
🔍 PR: #{pr_number}

=== Phase 1: 서비스 구조 ===
- Dockerfile: ✅ 존재
- 환경변수: ✅ .env.example 존재
- 헬스체크: ✅ /api/health

=== Phase 2: 코드 품질 ({stack}) ===
{nextjs/nodejs}
- ESLint: ✅ 통과
- TypeScript: ✅ 에러 없음
- 테스트: ✅ 12/12 통과

{go}
- gofmt: ✅ 통과
- go vet: ✅ 통과
- 테스트: ✅ 45/45 통과

=== Phase 3: 스키마 검증 ===
{nextjs/nodejs}
- Prisma 유효성: ✅
- 스키마 포맷: ✅

{go}
- SQL 마이그레이션: ✅ 존재
- sqlc: ⚠️ 미사용

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

**공통**:
- 서비스 독립성 위반
- 테스트 실패
- Dockerfile 누락

**Next.js/Node.js**:
- Prisma 스키마 오류
- TypeScript/ESLint 에러

**Go**:
- go vet 에러
- gofmt 미적용

### Warning (수정 권장)

- 환경변수 문서화 누락
- 에러 핸들링 미흡
- 로깅 누락
- 테스트 커버리지 부족

### Suggestion (선택적 개선)

- 성능 최적화
- 코드 리팩토링
- golangci-lint 권장 사항

## References

- [onboarding-ms Skill](../onboarding-ms/SKILL.md) - MS 온보딩 가이드
- [scaffold-service Skill](../scaffold-service/SKILL.md) - 서비스 스캐폴딩
- [Microservices Context](/.claude/memory/microservices.md) - 서비스 목록 및 컨텍스트
