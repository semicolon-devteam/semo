# 기업회원 결제 - 플랜 선택 화면

## 📄 문서 정보
- **화면 ID:** `PAY-001`
- **화면명:** 플랜 선택 및 결제
- **경로:** `/enterprise/payment`
- **작성일:** 2026-03-03
- **작성자:** PlanClaw

---

## 🎨 UI 미리보기

![플랜 선택 화면](../../../media/inbound/62ee3df7-ee1a-4931-a4eb-51fabe36c62c.png)

---

## 📋 UI 요소 명세

### [1] 페이지 헤더
- **타입:** Header Container
- **설명:** 화면 상단 영역
- **구성요소:**
  - 뒤로가기 버튼 (좌측)
  - 페이지 타이틀: "기업회원 결제" (중앙)

### [A] 플랜 카드 - Standard
- **타입:** Selectable Card Component
- **위치:** 상단 첫 번째 카드
- **구성:**
  - 플랜명: "Standard"
  - 가격: "₩29,000/월"
  - 혜택 리스트:
    - 멤버 5명까지
    - 기본 커뮤니티 기능
    - 월간 리포트
- **상태:**
  - Default: 회색 테두리
  - Selected: 파란색 테두리 + 체크 아이콘
- **동작:** 
  - `onClick` → 플랜 선택 상태 토글
  - 단일 선택 (라디오 버튼 방식)

### [B] 플랜 카드 - Pro ⭐ (추천)
- **타입:** Selectable Card Component
- **위치:** 중간 카드
- **구성:**
  - 배지: "가장 인기있는" (상단)
  - 플랜명: "Pro"
  - 가격: "₩79,000/월"
  - 혜택 리스트:
    - 멤버 20명까지
    - 프리미엄 커뮤니티 기능
    - 주간 리포트
    - 우선 지원
- **상태:**
  - Default: 파란색 강조 테두리 (추천 플랜)
  - Selected: 진한 파란색 배경 + 체크 아이콘
- **동작:** [A]와 동일

### [C] 플랜 카드 - Enterprise
- **타입:** Selectable Card Component
- **위치:** 하단 카드
- **구성:**
  - 플랜명: "Enterprise"
  - 가격: "문의하기"
  - 혜택 리스트:
    - 무제한 멤버
    - 커스텀 기능 지원
    - 전담 매니저
    - 24/7 지원
- **상태:** [A]와 동일
- **동작:** 
  - `onClick` → 플랜 선택 상태 토글
  - "문의하기" 플랜이므로 선택 시 별도 처리 필요

### [D] 결제하기 버튼
- **타입:** Primary Button (Fixed Bottom)
- **위치:** 화면 하단 고정
- **텍스트:** "선택한 플랜 결제하기"
- **상태:**
  - Disabled: 플랜 미선택 시 (회색)
  - Enabled: 플랜 선택 시 (파란색)
- **동작:**
  - `onClick` → 선택된 플랜 검증
  - Enterprise 플랜 선택 시 → 문의하기 모달 오픈
  - 일반 플랜 선택 시 → 결제 정보 입력 화면으로 이동 (`/enterprise/payment/checkout`)

---

## 🔄 사용자 플로우

```
1. 사용자 진입 (/enterprise/payment)
   ↓
2. 3가지 플랜 확인
   ↓
3. 플랜 카드 클릭 → 선택 상태 변경
   ↓
4. [결제하기] 버튼 활성화
   ↓
5. 버튼 클릭
   ↓
6-A. Standard/Pro 선택 → Checkout 화면 이동
6-B. Enterprise 선택 → 문의하기 모달 오픈
```

---

## 📡 API 연동

### 플랜 정보 조회
- **Endpoint:** `GET /api/enterprise/plans`
- **Response:**
```json
{
  "plans": [
    {
      "id": "standard",
      "name": "Standard",
      "price": 29000,
      "currency": "KRW",
      "period": "month",
      "features": [
        "멤버 5명까지",
        "기본 커뮤니티 기능",
        "월간 리포트"
      ]
    },
    // ...
  ]
}
```

### 플랜 선택 전송
- **Endpoint:** `POST /api/enterprise/payment/select`
- **Request:**
```json
{
  "planId": "pro",
  "userId": "user-uuid"
}
```
- **Response:**
```json
{
  "success": true,
  "checkoutUrl": "/enterprise/payment/checkout?plan=pro&session=xxx"
}
```

---

## ⚠️ 예외 처리

| 상황 | 동작 |
|------|------|
| 플랜 정보 로딩 실패 | 에러 토스트 + 재시도 버튼 표시 |
| 플랜 미선택 후 결제 버튼 클릭 | 버튼 disabled 상태 유지 (클릭 불가) |
| Enterprise 플랜 선택 시 | "문의하기 모달" 오픈, 폼 입력 유도 |
| 이미 구독 중인 사용자 접근 | 경고 모달 + 구독 관리 화면으로 리다이렉트 |

---

## 📱 반응형 고려사항

- **Mobile:** 카드를 세로 스택으로 배치, 하단 버튼은 고정
- **Tablet:** 카드 2열 배치 가능 (Standard+Pro / Enterprise 별도 행)
- **Desktop:** 3열 가로 배치 (현재 UI 기준)

---

## 🎯 접근성 (A11y)

- [ ] 각 플랜 카드에 `role="radio"` 속성
- [ ] 키보드 네비게이션 지원 (Tab, Enter, Space)
- [ ] 선택된 플랜 `aria-checked="true"` 상태 전달
- [ ] 스크린 리더용 대체 텍스트 제공
- [ ] 색상 외 시각적 표시 (체크 아이콘)

---

## 📝 메모

- Pro 플랜을 "추천" 배지로 강조 → 전환율 향상 목적
- Enterprise 플랜은 가격 협의 방식 → 문의 폼 필요
- 플랜 변경 시 기존 구독 처리 로직 필요 (별도 Epic)
