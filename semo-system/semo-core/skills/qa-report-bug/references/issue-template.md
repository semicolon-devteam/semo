# QA Bug Report Issue Template

> QA 테스트용 버그 리포트 이슈 템플릿 상세 가이드

## 전체 템플릿

```markdown
## 🐛 QA 버그 리포트

### 관련 테스트 케이스
- TC-{번호}: {테스트 케이스명}
- 테스트 유형: {수동/자동}
- 테스트 결과: ❌ FAIL

### 요약
{버그에 대한 간단한 설명 - 1~2문장}

### 재현 단계
1. {환경/페이지로 이동}
2. {특정 동작 수행}
3. {추가 동작}
4. {버그 발생 확인}

### 기대 동작
{테스트 케이스의 Expected Result}

### 실제 동작
{테스트 케이스의 Actual Result}

### 심각도
- [ ] Critical - 서비스 불가
- [ ] High - 주요 기능 장애
- [ ] Medium - 기능 일부 문제
- [ ] Low - 사소한 이슈

### 환경
- 테스트 환경: STG / DEV
- 발생 위치: {페이지 URL 또는 API 경로}
- 관련 기능: {기능명}
- 브라우저/디바이스: {해당 시}
- 테스트 일자: {YYYY-MM-DD}

### 증거
- 스크린샷: {첨부}
- 에러 로그: {첨부}
- 콘솔 로그: {첨부}
- 네트워크 로그: {첨부}

### 추가 정보
{재현율, 특이사항 등}

## 🌿 Branch

`fix/{issue-number}-{slug}`

---
🤖 SEMO report-bug Skill로 자동 생성됨 (QA)
```

## QA 특화 필드

### 테스트 케이스 연동

```markdown
### 관련 테스트 케이스
- TC-042: 로그인 - 정상 케이스
- TC-043: 로그인 - 잘못된 비밀번호
- 테스트 유형: 수동 테스트
- 테스트 결과: ❌ FAIL
```

### 테스트 환경 정보

| 환경 | 설명 |
|------|------|
| STG | 스테이징 서버 (qa.example.com) |
| DEV | 개발 서버 (dev.example.com) |
| LOCAL | 로컬 개발 환경 |

### 증거 수집 가이드

| 증거 유형 | 수집 방법 | 중요도 |
|----------|----------|--------|
| 스크린샷 | 버그 발생 화면 캡처 | 높음 |
| 에러 로그 | 서버 에러 로그 | 높음 |
| 콘솔 로그 | 브라우저 DevTools Console | 중간 |
| 네트워크 로그 | DevTools Network 탭 | 중간 |
| HAR 파일 | 전체 네트워크 기록 | 낮음 |

## 브랜치 네이밍 규칙

```
fix/{issue-number}-{slug}
```

**예시**:
- `fix/42-login-validation-error`
- `fix/108-payment-timeout`
- `fix/215-image-upload-fail`

## 라벨 규칙

QA에서 발견된 버그는 자동으로 `qa-found` 라벨이 추가됩니다:

```bash
--label "bug,qa-found"

# 심각도별 추가 라벨
--label "bug,qa-found,critical"
--label "bug,qa-found,high"
```
