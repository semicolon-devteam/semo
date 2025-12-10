---
name: onboarding-backend
description: |
  백엔드 개발자 온보딩 실습 (SAX-Backend 패키지 전용). Use when (1) sax-core/skill:onboarding에서 호출,
  (2) 백엔드 개발자 온보딩 실습 필요 시. API 설계 및 백엔드 워크플로우 체험.
tools: [Read, Bash, Glob, Grep]
model: inherit
---

> **시스템 메시지**: `[SAX] Skill: onboarding-backend 호출`

# onboarding-backend Skill

> 백엔드 개발자를 위한 온보딩 실습 (SAX-Backend 패키지 전용)

## Purpose

SAX Core의 `skill:onboarding` Phase 3에서 호출됩니다.
백엔드 개발자를 위한 실습 과정을 제공합니다.

## Prerequisites

- Phase 0-2 완료 (환경 진단, 조직 참여, SAX 개념 학습)
- sax-core/skill:onboarding에서 호출됨

## Workflow

### Step 1: 백엔드 워크플로우 안내

```text
백엔드 워크플로우:

1. API 설계
   → Epic/Spec 기반 API 명세 작성
   → OpenAPI/Swagger 문서 생성

2. 데이터베이스 설계
   → ERD 작성
   → Supabase 스키마 정의

3. API 구현
   → Route handlers 작성
   → 비즈니스 로직 구현

4. 테스트
   → API 단위 테스트
   → 통합 테스트

5. 배포
   → CI/CD 파이프라인
   → 모니터링 설정
```

### Step 2: API 설계 실습

```markdown
## API 설계 실습

간단한 API를 설계해보세요:

> "사용자 CRUD API 설계해줘"

**확인 사항**:
- [SAX] Orchestrator 메시지 확인
- API 명세 (endpoint, method, request/response)
- 에러 처리 방안
```

### Step 3: Supabase 연동 안내

```bash
# Supabase CLI 설치 확인
supabase --version

# 프로젝트 초기화
supabase init

# 로컬 개발 서버 시작
supabase start
```

## Expected Output

```markdown
[SAX] Skill: onboarding-backend 호출

=== 백엔드 개발자 온보딩 실습 ===

## 1. 백엔드 워크플로우

```text
1. API 설계 → OpenAPI/Swagger
2. 데이터베이스 설계 → ERD, Supabase
3. API 구현 → Route handlers
4. 테스트 → 단위/통합 테스트
5. 배포 → CI/CD
```

## 2. API 설계 실습

다음 요청으로 API를 설계해보세요:

> "사용자 CRUD API 설계해줘"

## 3. Supabase 연동

```bash
supabase init
supabase start
```

✅ 실습 완료

[SAX] Skill: onboarding-backend 완료
```

## SAX Message Format

```markdown
[SAX] Skill: onboarding-backend 호출

[SAX] Skill: onboarding-backend 완료
```
