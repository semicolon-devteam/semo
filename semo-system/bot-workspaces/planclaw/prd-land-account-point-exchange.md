# PRD: 랜드 계정 연동 & 포인트 교환소 UI

**작성자**: PlanClaw  
**작성일**: 2026-03-04  
**대상 프로젝트**: proj-game-land, proj-play-land, proj-office-land  
**관련 이슈**: 
- proj-play-land #145
- proj-office-land #300
- proj-game-land #777

---

## 📋 개요

게임랜드/플레이랜드/오피스랜드 3개 서비스 간 계정 연동 및 포인트 교환 기능을 제공하는 UI 구현.

**목표**:
- 사용자가 랜드 플랫폼 간 계정을 안전하게 연동
- 서비스 간 포인트 교환 (충전/이동)
- 교환 내역 투명하게 조회

**승인된 디자인**: https://reus-jeon.github.io/land-design-preview/

---

## 🎯 기능 요구사항

### 1. 계정 연동

#### 1.1 토큰 발급
- **기능**: 현재 서비스(게임랜드/플레이랜드/오피스랜드)에서 연동용 토큰 발급
- **UI 요소**:
  - "토큰 발급" 버튼
  - 발급된 토큰 표시 (읽기 전용 input + 복사 버튼)
  - 토큰 유효기간 표시 (예: 10분)
- **동작**:
  1. 사용자가 "토큰 발급" 클릭
  2. API 호출 → 서버에서 임시 토큰 생성
  3. 토큰 화면에 표시 + 클립보드 복사 옵션
  4. 유효기간 카운트다운 시작

#### 1.2 토큰 입력 (타 서비스 연동)
- **기능**: 다른 서비스에서 발급받은 토큰을 입력해 계정 연동
- **UI 요소**:
  - 서비스 선택 드롭다운 (게임랜드/플레이랜드/오피스랜드)
  - 토큰 입력 필드
  - "연동하기" 버튼
- **동작**:
  1. 사용자가 서비스 선택 + 토큰 입력
  2. "연동하기" 클릭
  3. API 호출 → 토큰 검증 + 계정 연동
  4. 성공 시: 연동 상태 업데이트 + 성공 토스트
  5. 실패 시: 에러 메시지 표시

#### 1.3 연동 상태 검증 UI
- **기능**: 현재 연동된 서비스 목록 표시
- **UI 요소**:
  - 연동된 서비스 카드 리스트
  - 각 카드: 서비스명, 연동 일시, "연동 해제" 버튼
- **동작**:
  - 페이지 로드 시 연동 상태 API 호출
  - 연동 해제 시: 확인 모달 → API 호출 → 상태 갱신

---

### 2. 포인트 교환소

#### 2.1 서비스 선택
- **기능**: 포인트를 보낼 대상 서비스 선택
- **UI 요소**:
  - 라디오 버튼 or 카드 선택 UI (게임랜드/플레이랜드/오피스랜드)
  - 각 서비스별 현재 보유 포인트 표시
- **제약**:
  - 본인이 연동한 서비스만 선택 가능
  - 미연동 서비스는 비활성화 + "연동 필요" 표시

#### 2.2 금액 입력
- **UI 요소**:
  - 금액 입력 필드 (숫자만 입력)
  - 빠른 금액 선택 버튼 (1,000 / 5,000 / 10,000 / 50,000)
  - 현재 보유 포인트 표시
  - 교환 후 잔액 미리보기
- **유효성 검증**:
  - 최소 금액: 1,000원
  - 최대 금액: 현재 보유 포인트
  - 100원 단위로만 입력 가능
  - 잔액 부족 시 에러 메시지

#### 2.3 교환 확인 모달
- **기능**: 교환 전 최종 확인
- **UI 요소**:
  - 출발 서비스명 + 보유 포인트
  - 도착 서비스명
  - 교환 금액
  - 교환 후 잔액 (출발/도착 서비스 각각)
  - "취소" / "교환하기" 버튼
- **동작**:
  1. "교환하기" 클릭
  2. API 호출 (포인트 이동 트랜잭션)
  3. 성공 시: 성공 토스트 + 포인트 잔액 갱신 + 교환 내역 갱신
  4. 실패 시: 에러 모달 (사유 표시)

---

### 3. 교환 내역

#### 3.1 이력 리스트
- **UI 요소**:
  - 테이블 or 카드 리스트
  - 각 항목: 날짜/시간, 출발 서비스, 도착 서비스, 금액, 상태 (성공/실패/처리중)
- **필터**:
  - 기간 선택 (오늘/이번 주/이번 달/전체)
  - 서비스 필터 (전체/게임랜드/플레이랜드/오피스랜드)
- **정렬**: 최신순 (기본)

#### 3.2 페이지네이션
- **UI 요소**:
  - 페이지 번호 버튼
  - "이전" / "다음" 버튼
  - 현재 페이지 / 전체 페이지 표시
- **설정**:
  - 페이지당 20개 항목
  - 무한 스크롤 대신 페이지네이션 사용 (데이터 양 많을 경우 고려)

---

## 🔌 API 연동 스펙

### 3.1 계정 연동

#### `POST /api/accounts/token/issue`
토큰 발급

**Request**:
```json
{}
```

**Response** (200):
```json
{
  "token": "ABC123XYZ789",
  "expiresAt": "2026-03-04T11:02:00Z"
}
```

**Error** (400):
```json
{
  "error": "ALREADY_HAS_ACTIVE_TOKEN",
  "message": "이미 발급된 토큰이 있습니다."
}
```

---

#### `POST /api/accounts/link`
계정 연동

**Request**:
```json
{
  "serviceType": "game-land",  // "game-land" | "play-land" | "office-land"
  "token": "ABC123XYZ789"
}
```

**Response** (200):
```json
{
  "linked": true,
  "linkedAt": "2026-03-04T10:52:00Z"
}
```

**Error** (400):
```json
{
  "error": "INVALID_TOKEN",
  "message": "유효하지 않은 토큰입니다."
}
```

**Error** (409):
```json
{
  "error": "ALREADY_LINKED",
  "message": "이미 연동된 계정입니다."
}
```

---

#### `GET /api/accounts/linked`
연동 상태 조회

**Response** (200):
```json
{
  "links": [
    {
      "serviceType": "game-land",
      "linkedAt": "2026-03-04T10:52:00Z"
    },
    {
      "serviceType": "play-land",
      "linkedAt": "2026-03-03T09:30:00Z"
    }
  ]
}
```

---

#### `DELETE /api/accounts/link/{serviceType}`
계정 연동 해제

**Response** (200):
```json
{
  "unlinked": true
}
```

**Error** (404):
```json
{
  "error": "LINK_NOT_FOUND",
  "message": "연동된 계정을 찾을 수 없습니다."
}
```

---

### 3.2 포인트 교환

#### `GET /api/points/balance`
포인트 잔액 조회

**Response** (200):
```json
{
  "balances": {
    "game-land": 50000,
    "play-land": 30000,
    "office-land": 0
  }
}
```

---

#### `POST /api/points/exchange`
포인트 교환

**Request**:
```json
{
  "fromService": "game-land",
  "toService": "play-land",
  "amount": 10000
}
```

**Response** (200):
```json
{
  "transactionId": "tx_20260304_001",
  "fromBalance": 40000,
  "toBalance": 40000,
  "exchangedAt": "2026-03-04T10:55:00Z"
}
```

**Error** (400):
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "포인트 잔액이 부족합니다."
}
```

**Error** (400):
```json
{
  "error": "INVALID_AMOUNT",
  "message": "교환 금액은 1,000원 이상, 100원 단위로 입력해주세요."
}
```

**Error** (403):
```json
{
  "error": "NOT_LINKED",
  "message": "연동되지 않은 서비스입니다."
}
```

---

### 3.3 교환 내역

#### `GET /api/points/history?page=1&limit=20&serviceType=all&period=all`
교환 내역 조회

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `serviceType` (string, optional): "all" | "game-land" | "play-land" | "office-land"
- `period` (string, optional): "today" | "week" | "month" | "all"

**Response** (200):
```json
{
  "items": [
    {
      "transactionId": "tx_20260304_001",
      "fromService": "game-land",
      "toService": "play-land",
      "amount": 10000,
      "status": "success",  // "success" | "failed" | "pending"
      "createdAt": "2026-03-04T10:55:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 87,
    "limit": 20
  }
}
```

---

## 🎨 상태 관리 설계

### Context / Zustand Store 구조

```typescript
interface AccountLinkStore {
  // 상태
  linkedServices: ServiceType[];
  isLoading: boolean;
  error: string | null;

  // 액션
  fetchLinkedServices: () => Promise<void>;
  linkService: (serviceType: ServiceType, token: string) => Promise<void>;
  unlinkService: (serviceType: ServiceType) => Promise<void>;
  issueToken: () => Promise<{ token: string; expiresAt: string }>;
}

interface PointExchangeStore {
  // 상태
  balances: Record<ServiceType, number>;
  exchangeHistory: ExchangeTransaction[];
  pagination: PaginationInfo;
  isLoading: boolean;
  error: string | null;

  // 액션
  fetchBalances: () => Promise<void>;
  exchangePoints: (from: ServiceType, to: ServiceType, amount: number) => Promise<void>;
  fetchHistory: (filters: HistoryFilters) => Promise<void>;
}
```

### 로컬 상태 (컴포넌트)
- Form 입력값 (금액, 서비스 선택)
- 모달 열림/닫힘 상태
- 토큰 발급 카운트다운 타이머

---

## ⚠️ 에러 핸들링

### 1. 네트워크 에러
- **시나리오**: API 호출 실패 (타임아웃, 500 에러 등)
- **처리**: 
  - 에러 토스트 표시: "네트워크 오류가 발생했습니다. 다시 시도해주세요."
  - 재시도 버튼 제공

### 2. 토큰 만료
- **시나리오**: 토큰 입력 시 이미 만료된 토큰
- **처리**: 
  - 에러 메시지: "토큰이 만료되었습니다. 새로운 토큰을 발급받아주세요."

### 3. 잔액 부족
- **시나리오**: 교환 금액 > 현재 포인트
- **처리**: 
  - 입력 필드 에러 표시 (빨간 테두리)
  - 에러 메시지: "포인트 잔액이 부족합니다."

### 4. 미연동 서비스 선택
- **시나리오**: 연동되지 않은 서비스로 포인트 교환 시도
- **처리**: 
  - 에러 모달: "해당 서비스는 연동되지 않았습니다. 먼저 계정을 연동해주세요."
  - "계정 연동 페이지로 이동" 버튼

### 5. 중복 연동 시도
- **시나리오**: 이미 연동된 서비스 재연동 시도
- **처리**: 
  - 에러 메시지: "이미 연동된 계정입니다."

---

## ✅ 유효성 검증 규칙

### 1. 토큰 입력
- **규칙**: 
  - 영숫자 12자 (예시 형식)
  - 빈 값 불가
- **에러 메시지**: "올바른 토큰 형식이 아닙니다."

### 2. 포인트 교환 금액
- **규칙**:
  - 최소: 1,000원
  - 최대: 현재 보유 포인트
  - 단위: 100원
  - 숫자만 입력 (문자 입력 시 자동 제거)
- **에러 메시지**:
  - "최소 1,000원부터 교환 가능합니다."
  - "포인트 잔액이 부족합니다."
  - "100원 단위로만 입력 가능합니다."

### 3. 서비스 선택
- **규칙**:
  - 출발 서비스 ≠ 도착 서비스 (같은 서비스로 교환 불가)
  - 도착 서비스는 연동된 서비스만 선택 가능
- **에러 메시지**: "같은 서비스로는 교환할 수 없습니다."

---

## 🔐 보안 고려사항

1. **토큰 보안**:
   - 토큰은 1회용 (사용 후 무효화)
   - 유효기간: 10분
   - 서버 측 재검증 필수

2. **포인트 교환 트랜잭션**:
   - DB 트랜잭션으로 원자성 보장
   - 중복 요청 방지 (idempotency key)
   - 잔액 차감/증가 로그 저장

3. **인증**:
   - 모든 API는 JWT/세션 인증 필요
   - 본인 계정에서만 포인트 이동 가능

---

## 📱 반응형 디자인

- **Desktop** (≥1024px): 2컬럼 레이아웃 (계정 연동 | 포인트 교환소)
- **Tablet** (768px ~ 1023px): 1컬럼, 섹션별 세로 배치
- **Mobile** (< 768px): 전체 1컬럼, 하단 고정 CTA 버튼

---

## 🧪 테스트 시나리오

### 계정 연동
1. ✅ 토큰 발급 성공
2. ✅ 토큰 복사 버튼 클릭 → 클립보드 복사 확인
3. ✅ 토큰 만료 시간 카운트다운 정상 동작
4. ✅ 타 서비스에서 발급한 토큰으로 연동 성공
5. ❌ 잘못된 토큰 입력 시 에러 메시지 표시
6. ❌ 만료된 토큰 입력 시 에러 메시지 표시
7. ✅ 연동된 서비스 목록 정상 표시
8. ✅ 연동 해제 → 확인 모달 → 연동 해제 성공

### 포인트 교환
1. ✅ 연동된 서비스만 선택 가능 (미연동 서비스 비활성화)
2. ✅ 금액 입력 → 교환 후 잔액 미리보기 정상 표시
3. ✅ 빠른 금액 선택 버튼 클릭 → 금액 입력 필드 자동 채움
4. ❌ 1,000원 미만 입력 시 에러 메시지
5. ❌ 보유 포인트 초과 입력 시 에러 메시지
6. ❌ 100원 단위가 아닌 금액 입력 시 에러 메시지
7. ✅ 교환 확인 모달 → 정보 확인 → 교환 성공
8. ✅ 교환 후 포인트 잔액 즉시 갱신
9. ✅ 교환 내역에 새 거래 추가

### 교환 내역
1. ✅ 최신순 정렬로 내역 표시
2. ✅ 기간 필터 변경 → 해당 기간 내역만 표시
3. ✅ 서비스 필터 변경 → 해당 서비스 내역만 표시
4. ✅ 페이지네이션 클릭 → 다음/이전 페이지 로드
5. ✅ 빈 내역일 경우 "내역이 없습니다" 표시

---

## 🚀 구현 우선순위

### Phase 1: 기본 기능 (필수)
1. 계정 연동 (토큰 발급/입력/검증)
2. 포인트 교환소 (서비스 선택, 금액 입력, 교환)
3. 교환 내역 (기본 리스트, 페이지네이션)

### Phase 2: 개선 (Nice-to-have)
1. 교환 내역 필터/정렬
2. 빠른 금액 선택 버튼
3. 토큰 만료 카운트다운
4. 연동 해제 기능

---

## 📌 프로젝트별 차이점

현재 3개 프로젝트(게임랜드/플레이랜드/오피스랜드) 모두 **동일한 UI/기능**을 구현합니다.

**공통 사항**:
- Next.js + TailwindCSS 기반
- 동일한 API 엔드포인트 사용 (백엔드 통합)
- 동일한 디자인 시스템 (land-design-preview)

**프로젝트별 커스터마이징 (필요 시)**:
- 테마 컬러 (게임랜드: 블루, 플레이랜드: 그린, 오피스랜드: 퍼플 등)
- 로고/브랜딩 요소

---

## ✅ 완료 조건 (Definition of Done)

1. ✅ 계정 연동 기능 정상 동작 (토큰 발급/입력/검증/해제)
2. ✅ 포인트 교환 정상 동작 (금액 입력/검증/교환)
3. ✅ 교환 내역 조회 정상 동작 (리스트/페이지네이션)
4. ✅ 모든 유효성 검증 규칙 적용
5. ✅ 에러 핸들링 구현 (네트워크 오류, 잔액 부족 등)
6. ✅ 반응형 디자인 적용 (Desktop/Tablet/Mobile)
7. ✅ 테스트 시나리오 통과 (수동 테스트 or E2E)
8. ✅ 디자인 프리뷰와 일치

---

## 📚 참고 자료

- **디자인 프리뷰**: https://reus-jeon.github.io/land-design-preview/
- **API 문서**: (백엔드 팀에서 제공 예정)
- **공통 컴포넌트 라이브러리**: (기존 랜드 프로젝트 참고)
