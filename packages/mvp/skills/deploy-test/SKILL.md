---
name: deploy-test
description: Vercel 배포 테스트 및 실패 시 자동 수정. Use when (1) 배포 테스트 요청, (2) Vercel 빌드 확인, (3) 배포 전 검증
tools: [Bash, Read, Edit]
triggers:
  - 배포 테스트해줘
  - vercel 빌드해봐
  - 배포 가능한지 확인해줘
---

> **시스템 메시지**: `[SEMO] Skill: deploy-test 호출 - 배포 테스트`

# Deploy Test Skill

## Purpose

Vercel 배포 전 빌드 테스트를 실행하고, 실패 시 자동으로 에러를 분석하여 수정합니다.

## Quick Start

```bash
# 키워드로 호출
"배포 테스트해줘"
"vercel 빌드 확인해줘"
"배포 가능한지 검증해줘"
```

---

## 실행 흐름

```
1. 로컬 빌드 테스트 (npm run build)
   ├── 성공 → 2단계로 진행
   └── 실패 → 에러 분석 및 자동 수정 → 재시도

2. Vercel 빌드 테스트 (vercel build --prod)
   ├── 성공 → 완료 보고
   └── 실패 → 에러 분석 및 자동 수정 → 재시도

3. Circuit Breaker: 최대 3회 재시도 후 중단
```

---

## 검증 순서

### Phase 1: 로컬 빌드

```bash
# 1. ESLint 검사
npm run lint

# 2. TypeScript 타입 체크
npx tsc --noEmit

# 3. 로컬 빌드
npm run build
```

### Phase 2: Vercel 빌드

```bash
# Vercel CLI 설치 확인
vercel --version || npm install -g vercel

# Vercel 프로덕션 빌드 테스트
vercel build --prod
```

---

## 자동 수정 로직

### 에러 패턴 감지 및 수정

| 에러 패턴 | 자동 수정 |
|----------|----------|
| `Module not found` | 누락된 import 추가 |
| `Type error` | 타입 정의 수정 |
| `'X' is not defined` | 변수/함수 선언 추가 |
| `Unexpected token` | 문법 오류 수정 |
| `Build optimization failed` | Next.js 설정 확인 |

### 수정 시도 흐름

```markdown
[SEMO] Skill: deploy-test - 에러 감지

## 에러 분석

**파일**: {file_path}:{line_number}
**에러**: {error_message}
**유형**: {error_type}

## 자동 수정 시도

{fix_description}

## 수정 적용

✅ 수정 완료 → 재빌드 진행...
```

---

## Circuit Breaker

> **최대 3회 재시도** 후 자동 중단

```markdown
[SEMO] Skill: deploy-test - ⛔ Circuit Breaker 작동

🚫 **빌드 실패**: 3회 재시도 후에도 해결되지 않았습니다.

## 시도 이력
1. {attempt_1_error} → {fix_1} → ❌
2. {attempt_2_error} → {fix_2} → ❌
3. {attempt_3_error} → {fix_3} → ❌

## 수동 확인 필요
- 에러 로그: `.vercel/output/build-error.log`
- 권장 조치: {recommendations}

개발자의 수동 개입이 필요합니다.
```

---

## 출력 형식

### 성공 시

```markdown
[SEMO] Skill: deploy-test - ✅ 배포 준비 완료

## 빌드 결과

| 단계 | 상태 | 소요 시간 |
|------|------|----------|
| ESLint | ✅ Pass | {time}s |
| TypeScript | ✅ Pass | {time}s |
| 로컬 빌드 | ✅ Pass | {time}s |
| Vercel 빌드 | ✅ Pass | {time}s |

## 다음 단계
- `git push` 후 Vercel 자동 배포 시작
- 또는 `vercel --prod` 로 수동 배포

📋 **배포 대시보드**: [Vercel Dashboard](https://vercel.com/dashboard)
```

### 자동 수정 후 성공 시

```markdown
[SEMO] Skill: deploy-test - ✅ 배포 준비 완료 (자동 수정 적용)

## 자동 수정 이력

| 시도 | 에러 | 수정 내용 |
|------|------|----------|
| 1 | {error_1} | {fix_1} |

## 빌드 결과

| 단계 | 상태 |
|------|------|
| ESLint | ✅ Pass |
| TypeScript | ✅ Pass |
| 로컬 빌드 | ✅ Pass |
| Vercel 빌드 | ✅ Pass |

⚠️ **변경사항 확인**: 자동 수정된 파일을 검토해주세요.
```

---

## 환경 요구사항

- Vercel CLI 설치: `npm install -g vercel`
- Vercel 로그인: `vercel login`
- 프로젝트 연결: `vercel link` (최초 1회)

---

## Related Skills

- `health-check` - 환경 검증 (Vercel CLI 포함)
- `verify-integration` - 통합 검증

## References

- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
