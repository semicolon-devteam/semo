---
name: verify
description: 커뮤니티 솔루션 통합 호환성 검증
---

# /SAX:verify

MVP 코드가 세미콜론 커뮤니티 솔루션과 호환되는지 검증합니다.

## 실행

`skill:verify-integration`을 호출합니다.

## 검증 항목

### 1. 스키마 호환성
- Core 테이블 미수정 확인
- metadata 확장 패턴 확인
- Flyway 마이그레이션 확인

### 2. 인터페이스 호환성
- core-interface 타입 동기화 확인
- API 응답 형식 (ApiResponse<T>) 확인

### 3. 네이밍 컨벤션
- 테이블/컬럼: snake_case
- 타입: PascalCase
- MVP 접두사 사용

## 결과

- ✅ PASS: 통합 준비 완료
- ⚠️ WARNING: 권장 수정 사항 있음
- ❌ FAIL: 필수 수정 필요

## 프롬프트

```
[SAX] Skill: verify-integration 호출 - 통합 검증

MVP 코드의 커뮤니티 솔루션 호환성을 검증합니다.
```
