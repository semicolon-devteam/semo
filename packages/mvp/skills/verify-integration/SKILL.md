---
name: verify-integration
description: 커뮤니티 솔루션 통합 호환성 검증
tools: [Read, Glob, Grep, Bash]
---

> **시스템 메시지**: `[SAX] Skill: verify-integration 호출 - 통합 검증`

# Verify Integration Skill

## Purpose

MVP 코드가 세미콜론 커뮤니티 솔루션과 호환되는지 검증합니다.
통합 전 필수로 실행해야 합니다.

## Quick Start

```bash
/SAX:verify

# 트리거 키워드
"통합 검증", "verify", "호환성 확인"
```

---

## 검증 체크리스트

### 1. 스키마 호환성

| 항목 | 검증 내용 | 상태 |
|------|----------|------|
| Core 테이블 | 기존 스키마 미수정 확인 | |
| metadata 확장 | type 필드 기반 분리 확인 | |
| 신규 컬럼 | Flyway 마이그레이션 존재 확인 | |
| 신규 테이블 | Flyway 마이그레이션 존재 확인 | |

### 2. 인터페이스 호환성

| 항목 | 검증 내용 | 상태 |
|------|----------|------|
| core-interface 타입 | 최신 버전 동기화 확인 | |
| API 응답 형식 | ApiResponse<T> 준수 확인 | |
| DTO 네이밍 | 컨벤션 준수 확인 | |

### 3. 네이밍 컨벤션

| 항목 | 규칙 | 상태 |
|------|------|------|
| 테이블명 | snake_case, mvp_ 접두사 | |
| 컬럼명 | snake_case | |
| 타입명 | PascalCase | |
| 파일명 | kebab-case 또는 PascalCase | |

---

## 검증 스크립트

### 스키마 변경 감지

```bash
#!/bin/bash
# Flyway 마이그레이션 파일 확인

echo "=== 스키마 변경 검증 ==="

# 신규 마이그레이션 파일 확인
MIGRATIONS=$(find . -name "V*.sql" -newer .last_verify 2>/dev/null)

if [ -n "$MIGRATIONS" ]; then
  echo "📝 새 마이그레이션 파일 발견:"
  echo "$MIGRATIONS"
else
  echo "✅ 신규 마이그레이션 없음"
fi

# ALTER TABLE 문 확인 (기존 테이블 수정)
echo ""
echo "=== ALTER TABLE 검사 ==="
grep -r "ALTER TABLE" --include="*.sql" . 2>/dev/null | grep -v "mvp_" || echo "✅ 기존 테이블 수정 없음"
```

### metadata 패턴 검증

```bash
#!/bin/bash
echo "=== metadata 패턴 검증 ==="

# metadata type 필드 사용 확인
grep -r "metadata->>'type'" --include="*.ts" . 2>/dev/null

# metadata 직접 수정 확인 (위험)
grep -r "metadata =" --include="*.ts" . 2>/dev/null | grep -v "||" | grep -v "merge"
```

### 타입 호환성 검증

```bash
#!/bin/bash
echo "=== 타입 호환성 검증 ==="

# core-interface 타입 import 확인
grep -r "from '@/types/core-interface'" --include="*.ts" . 2>/dev/null

# ApiResponse 사용 확인
grep -r "ApiResponse<" --include="*.ts" . 2>/dev/null
```

---

## 출력 형식

```markdown
# 🔍 MVP 통합 검증 결과

## 요약
- 검증 일시: {timestamp}
- 도메인: {domain}
- 결과: {PASS | FAIL | WARNING}

---

## 1. 스키마 호환성

### Core 테이블 수정 여부
- 상태: {✅ | ❌}
- 상세: {details}

### metadata 확장 패턴
- 상태: {✅ | ❌}
- type 필드: {type_value}
- 확장 필드: {fields}

### Flyway 마이그레이션
- 신규 마이그레이션: {count}개
- 파일 목록:
  - {migration_files}

---

## 2. 인터페이스 호환성

### core-interface 버전
- 로컬: {local_version}
- 최신: {remote_version}
- 상태: {✅ 동기화됨 | ⚠️ 업데이트 필요}

### API 응답 형식
- ApiResponse<T> 사용: {✅ | ❌}
- 예외 케이스: {exceptions}

---

## 3. 네이밍 컨벤션

### 테이블/컬럼
- 컨벤션 준수: {✅ | ❌}
- 위반 항목: {violations}

### 타입/파일
- 컨벤션 준수: {✅ | ❌}
- 위반 항목: {violations}

---

## 권장 액션

{recommendations}

---

## 다음 단계

검증 통과 시:
1. PR 생성
2. 코드 리뷰 요청
3. 커뮤니티 솔루션 머지

검증 실패 시:
1. 위반 항목 수정
2. `/SAX:verify` 재실행
```

---

## 검증 규칙 상세

### 🔴 FAIL 조건

1. **Core 테이블 직접 수정**
   - `ALTER TABLE posts`, `ALTER TABLE users` 등
   - 해결: metadata 확장 또는 신규 테이블 사용

2. **core-interface 타입 미사용**
   - 커스텀 타입만 정의
   - 해결: `skill:sync-interface` 실행 후 확장

3. **Flyway 마이그레이션 누락**
   - 신규 컬럼/테이블 추가했으나 마이그레이션 없음
   - 해결: `V{version}__{description}.sql` 작성

### ⚠️ WARNING 조건

1. **core-interface 버전 불일치**
   - 해결: `skill:sync-interface` 실행

2. **비표준 네이밍**
   - 해결: 컨벤션에 맞게 수정

3. **미사용 metadata 필드**
   - 해결: 타입 정의 정리

### ✅ PASS 조건

- 모든 FAIL 조건 없음
- WARNING은 허용 (권장 수정)

---

## CI/CD 통합

```yaml
# .github/workflows/verify.yml
name: Verify Integration

on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Schema Verification
        run: |
          # Core 테이블 수정 확인
          if grep -r "ALTER TABLE" --include="*.sql" . | grep -v "mvp_"; then
            echo "❌ Core 테이블 수정 감지"
            exit 1
          fi

      - name: Type Verification
        run: |
          pnpm tsc --noEmit

      - name: Lint
        run: |
          pnpm lint
```

---

## References

- [Schema Compliance](references/schema-compliance.md)
- [Interface Compliance](references/interface-compliance.md)
