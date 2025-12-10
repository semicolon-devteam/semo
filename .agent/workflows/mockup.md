# UI Mockup Generation Workflow

> `/mockup` 명령어로 호출되는 워크플로우

## 트리거

```
/mockup {description}
```

## 프로세스

### 1. 요구사항 분석

사용자 입력에서 다음을 추출합니다:
- 컴포넌트 유형 (폼, 카드, 네비게이션 등)
- 필요한 요소 (버튼, 입력, 이미지 등)
- 스타일 요구사항 (테마, 색상 등)
- MVP 특화 요소 (metadata 기반 데이터 표시 등)

### 2. 구조 설계

컴포넌트 계층 구조를 설계합니다:
```
Container
├── Header
│   └── Title
├── Content
│   ├── Element1
│   └── Element2
└── Footer
    └── Actions
```

### 3. 목업 생성

Nano Banana Pro를 활용하여 UI 목업 이미지를 생성합니다:
- 고해상도 이미지
- 반응형 변형 (Desktop, Tablet, Mobile)
- 상태별 변형 (Default, Hover, Active)

### 4. 결과 제공

생성된 목업을 아티팩트로 제공합니다:
- 목업 이미지
- 컬러/타이포그래피 스펙
- 컴포넌트 구조 설명

---

## 예시

### 입력
```
/mockup 오피스 예약 폼, 날짜 선택과 시간대 선택, 예약 버튼 포함
```

### 출력
```
[SAX] Skill: mockup - UI 목업 생성

## 오피스 예약 폼 목업

### 구조
- Form Container (max-width: 480px, centered)
  - Header: "오피스 예약"
  - Office Selector (dropdown)
  - Date Picker (calendar)
  - Time Slot Grid (09:00-18:00)
  - Duration Selector
  - Notes Textarea (optional)
  - Submit Button: "예약하기"
  - Cancel Link

### 스펙
- 배경: #FFFFFF
- Primary: #3B82F6
- 텍스트: #1F2937
- Border: #D1D5DB
- Radius: 8px

[목업 이미지 생성]
```

---

## 컴포넌트 타입별 템플릿

### Form (MVP 특화)
- 입력 필드, 레이블, 버튼
- 유효성 검사 메시지
- 로딩 상태
- metadata 기반 옵션 표시

### Card (MVP 특화)
- 이미지, 제목, 설명
- metadata 뱃지 (type 표시)
- 액션 버튼
- 메타 정보

### List (MVP 특화)
- 필터링 (metadata type 기반)
- 정렬 옵션
- 페이지네이션
- 빈 상태

### Dashboard
- 통계 카드
- 차트/그래프
- 최근 활동 목록
- 빠른 액션

---

## 디자인 가이드라인

### 반드시 포함
- 반응형 고려 (Mobile-first)
- 접근성 요소
- 상태 변형
- 로딩/에러 상태

### 피해야 할 것
- 일반적인 파란색 (#0000FF)
- 시스템 기본 폰트만
- 너무 작은 터치 타겟 (< 44px)

---

## Claude Code 연동

생성된 목업을 Claude Code에서 활용하려면:

1. 목업 이미지를 `assets/mockups/` 폴더에 저장
2. Claude Code에서 목업 참조하여 컴포넌트 구현
3. DDD 4-layer 구조에 맞게 코드 생성
