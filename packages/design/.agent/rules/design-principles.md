# Design Principles

> Antigravity에서 디자인 작업 시 준수할 원칙

## 시각 디자인

### 색상 시스템

```
Primary: 브랜드 메인 색상
Secondary: 보조 색상
Neutral: 그레이스케일
Success: 성공 상태 (#10B981)
Warning: 경고 상태 (#F59E0B)
Error: 오류 상태 (#EF4444)
```

### 타이포그래피

```
Font Family: Inter (기본), System UI (폴백)
Heading: 600-700 weight
Body: 400 weight
Caption: 12-14px

Line Height:
- Heading: 1.2-1.3
- Body: 1.5-1.6
```

### 스페이싱

```
Base unit: 4px
Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96

Component padding: 12-24px
Section spacing: 32-64px
```

### 테두리/그림자

```
Border radius:
- Small: 4px
- Medium: 8px
- Large: 12px
- Full: 9999px

Shadow:
- sm: 0 1px 2px rgba(0,0,0,0.05)
- md: 0 4px 6px rgba(0,0,0,0.1)
- lg: 0 10px 15px rgba(0,0,0,0.1)
```

---

## 인터랙션 디자인

### 상태

모든 인터랙티브 요소는 다음 상태를 가집니다:
- Default
- Hover
- Focus
- Active
- Disabled
- Loading (해당 시)
- Error (해당 시)

### 애니메이션

```
Duration:
- Fast: 150ms (hover, color)
- Normal: 200ms (transform)
- Slow: 300ms (layout)

Easing:
- ease: 일반
- ease-out: 진입
- ease-in-out: 양방향
```

### 피드백

사용자 액션에 즉각적인 피드백:
- 시각적 변화 (색상, 크기)
- 로딩 인디케이터
- 성공/실패 메시지

---

## 반응형 디자인

### Breakpoints

```
xs: 0 (모바일)
sm: 640px (태블릿 세로)
md: 768px (태블릿 가로)
lg: 1024px (데스크톱)
xl: 1280px (와이드)
```

### Mobile-first 접근

1. 모바일 레이아웃 먼저 설계
2. 점진적으로 확장
3. 터치 타겟 최소 44px

### 레이아웃 변경

- Stack → Grid 전환
- 네비게이션: 햄버거 → 풀 메뉴
- 사이드바: 오버레이 → 고정

---

## 접근성

### WCAG 2.1 AA 준수

#### 인지 가능
- 대체 텍스트 (이미지)
- 자막 (비디오)
- 색상 외 구분 수단

#### 조작 가능
- 키보드 접근성
- 충분한 시간
- 발작 방지

#### 이해 가능
- 읽기 쉬움
- 예측 가능
- 입력 지원

#### 견고함
- 호환성
- ARIA 사용

### 색상 대비

```
일반 텍스트: 4.5:1
큰 텍스트 (18px+): 3:1
UI 컴포넌트: 3:1
```

### 키보드 탐색

```
Tab: 순차 이동
Shift+Tab: 역순 이동
Enter/Space: 활성화
Escape: 닫기/취소
Arrow: 옵션 탐색
```

---

## Anti-Patterns

### 피해야 할 것

❌ 시스템 기본 폰트만 사용
❌ 기본 파란색 링크
❌ 일관성 없는 스페이싱
❌ 작은 터치 타겟 (<44px)
❌ 색상만으로 정보 전달
❌ 포커스 표시 제거
❌ 자동 재생 미디어
❌ 깜빡이는 콘텐츠

### 권장 사항

✅ 디자인 토큰 사용
✅ 일관된 컴포넌트 스타일
✅ 명확한 시각적 계층
✅ 충분한 여백
✅ 접근성 테스트
✅ 반응형 검증
