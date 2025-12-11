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
/mockup 로그인 폼, 이메일과 비밀번호 입력, 소셜 로그인 버튼 포함
```

### 출력
```
[SEMO] Skill: mockup - UI 목업 생성

## 로그인 폼 목업

### 구조
- Form Container (max-width: 400px, centered)
  - Logo
  - Title: "로그인"
  - Email Input
  - Password Input
  - Remember Me Checkbox
  - Submit Button
  - Divider: "또는"
  - Social Login Buttons (Google, Kakao)
  - Sign Up Link

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

### Form
- 입력 필드, 레이블, 버튼
- 유효성 검사 메시지
- 로딩 상태

### Card
- 이미지, 제목, 설명
- 액션 버튼
- 메타 정보

### Navigation
- 로고, 메뉴 아이템
- 검색, 알림, 프로필
- 모바일 햄버거 메뉴

### Modal/Dialog
- 헤더, 콘텐츠, 푸터
- 닫기 버튼
- 오버레이

### Table
- 헤더, 행, 셀
- 정렬, 필터
- 페이지네이션

---

## 디자인 가이드라인

### 반드시 포함
- 반응형 고려
- 접근성 요소
- 상태 변형

### 피해야 할 것
- 일반적인 파란색 (#0000FF)
- 시스템 기본 폰트만
- 너무 작은 터치 타겟

---

## Claude Code 연동

생성된 목업을 Claude Code에서 활용하려면:

1. 목업 이미지를 `assets/mockups/` 폴더에 저장
2. Claude Code에서 `/SEMO:handoff` 명령어 실행
3. 핸드오프 문서에 목업 참조 추가
