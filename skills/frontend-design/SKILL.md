# frontend-design Skill

> 차별화된 프로덕션 수준의 프론트엔드 UI를 설계하고 구현

## Metadata

```yaml
name: frontend-design
version: 1.0.0
package: sax-next
triggers:
  - UI 디자인
  - 프론트엔드 디자인
  - 컴포넌트 디자인
  - 화면 설계
  - frontend-design
  - UI 구현
  - 화면 구현
```

## Purpose

**일반적인 AI 미학을 피하고**, 의도적이고 차별화된 프론트엔드 인터페이스를 설계 및 구현합니다.

### 핵심 철학

> "Bold maximalism and refined minimalism both work - the key is intentionality, not intensity."

| 추구 | 회피 |
|------|------|
| 의도적인 디자인 결정 | 디폴트 설정 그대로 사용 |
| 기억에 남는 차별점 | 쿠키커터 템플릿 |
| 프로덕션 수준 품질 | 프로토타입 수준 |
| 팀 디자인 시스템 준수 | 임의의 스타일 |

## Workflow

### Phase 1: Design Thinking (코딩 전 필수)

코드 작성 전 **반드시** 다음을 정의합니다:

```
[SAX] Skill: frontend-design 실행 - Design Thinking

📋 디자인 사고 단계

1️⃣ **목적 (Purpose)**
   - 이 인터페이스가 해결할 문제는?
   - 타겟 사용자는 누구인가?
   - 사용자의 핵심 여정(journey)은?

2️⃣ **톤 (Aesthetic Direction)**
   - [ ] Minimal & Clean - 여백 중심, 필수 요소만
   - [ ] Bold & Vibrant - 강렬한 색상, 대담한 타이포
   - [ ] Professional & Trust - 안정감, 신뢰성 강조
   - [ ] Playful & Friendly - 친근함, 재미 요소
   - [ ] Premium & Luxury - 고급스러움, 정제된 디테일
   - [ ] 기타: ___

3️⃣ **차별점 (Memorable Element)**
   - "What's the one thing someone will remember?"
   - 경쟁 서비스와 구분되는 시각적 특징은?

4️⃣ **제약사항 (Constraints)**
   - 기술 스택: Next.js + Tailwind + shadcn/ui
   - 반응형 요구사항: 모바일/데스크톱
   - 접근성 요구사항: WCAG 수준
   - 브랜드 가이드라인 유무
```

### Phase 2: Production Code (구현)

Design Thinking 완료 후 구현 단계:

```
[SAX] frontend-design: Production Code 시작

🔨 구현 영역

**타이포그래피**:
- 폰트 선택: {선택된 폰트} (일반 폰트 회피)
- 타입 스케일: {정의된 스케일}

**색상 시스템**:
- Primary: {색상}
- Secondary: {색상}
- CSS 변수로 관리

**모션 & 인터랙션**:
- 호버/포커스 효과
- 페이지 전환 애니메이션
- 스크롤 트리거 효과

**공간 & 레이아웃**:
- 그리드 시스템
- 여백 패턴
- 비대칭/특이 요소
```

### Phase 3: Quality Check

```
[SAX] frontend-design: Quality Check

✅ 디자인 품질 체크리스트

- [ ] 제네릭 폰트 사용 안함 (Inter, Roboto, Arial 회피)
- [ ] 진부한 색상 조합 회피 (보라색 그래디언트 등)
- [ ] 차별화 요소 존재
- [ ] 반응형 테스트 완료
- [ ] 접근성 검증 (색상 대비, 키보드 네비게이션)
- [ ] 팀 디자인 시스템 준수
```

## Anti-Patterns (피해야 할 것들)

### 제네릭 폰트 금지

```typescript
// ❌ BAD - 일반적인 시스템 폰트
font-family: 'Inter', 'Roboto', 'Arial', system-ui, sans-serif;

// ✅ GOOD - 의도적인 폰트 선택
font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
font-family: 'Playfair Display', serif; // 헤드라인용
```

### 진부한 색상 회피

```typescript
// ❌ BAD - AI 생성물 느낌의 전형적 색상
const colors = {
  primary: '#8B5CF6',     // 보라색 그래디언트
  secondary: '#EC4899',   // 핑크색
  gradient: 'from-purple-500 to-pink-500'
};

// ✅ GOOD - 의도적인 팔레트
const colors = {
  primary: '#1A1A2E',     // 깊은 네이비
  accent: '#E94560',      // 포인트 레드
  surface: '#F8F9FA'      // 부드러운 그레이
};
```

### 예측 가능한 레이아웃 회피

```typescript
// ❌ BAD - 모든 곳에 동일한 카드 그리드
<div className="grid grid-cols-3 gap-4">
  <Card /><Card /><Card />
</div>

// ✅ GOOD - 시각적 계층과 변화
<div className="space-y-8">
  <FeaturedCard className="col-span-2" />
  <div className="grid grid-cols-2 gap-4">
    <CompactCard />
    <CompactCard />
  </div>
</div>
```

## MCP Integration

### 21st.dev Magic MCP 활용

UI 컴포넌트 생성 시 Magic MCP 활용:

```
[SAX] frontend-design: Magic MCP 활용

💡 21st.dev 컴포넌트 탐색

컴포넌트 유형: {button, card, form, modal 등}
디자인 방향: {Phase 1에서 정의한 톤}

→ mcp__magic__21st_magic_component_builder 호출
```

### Playwright MCP 활용

시각적 검증 시 Playwright 활용:

```
[SAX] frontend-design: 시각적 검증

📸 스크린샷 비교
- 데스크톱 뷰포트
- 모바일 뷰포트
- 다크모드 (해당시)

→ mcp__playwright__browser_take_screenshot 호출
```

## Semicolon Design System

### 기본 스택

| 도구 | 용도 |
|------|------|
| Tailwind CSS | 유틸리티 기반 스타일링 |
| shadcn/ui | 기본 컴포넌트 라이브러리 |
| Framer Motion | 애니메이션 (선택) |
| Lucide Icons | 아이콘 세트 |

### 폰트 권장

| 용도 | 권장 폰트 |
|------|-----------|
| 본문 (한글) | Pretendard, Noto Sans KR |
| 본문 (영문) | Plus Jakarta Sans, Manrope |
| 헤드라인 | Playfair Display, Clash Display |
| 코드 | JetBrains Mono, Fira Code |

### 색상 토큰 패턴

```css
:root {
  /* Semantic Colors */
  --color-surface: 0 0% 100%;
  --color-surface-elevated: 0 0% 98%;
  --color-text-primary: 0 0% 9%;
  --color-text-secondary: 0 0% 45%;

  /* Brand Colors */
  --color-brand-primary: 220 90% 56%;
  --color-brand-accent: 340 82% 52%;
}
```

## Integration with Other Skills

### spec → frontend-design → implement

```
spec (Phase 1-3)
    │
    ├─ UI/UX 요구사항 정의
    │
    ▼
frontend-design (Design Thinking + Production)
    │
    ├─ 디자인 결정 문서화
    ├─ 컴포넌트 구조 설계
    │
    ▼
implement (Phase 4)
    │
    ├─ DDD Presentation Layer 구현
    └─ frontend-design 결정사항 적용
```

### 호출 패턴

```javascript
// 새 화면 설계 시
skill: frontend-design();

// 기존 spec 기반으로 디자인 시
skill: frontend-design({ spec: "features/user-profile/spec.md" });

// 특정 컴포넌트만 디자인 시
skill: frontend-design({ component: "UserProfileCard" });
```

## Examples

### Example 1: 랜딩 페이지 디자인

```
User: "서비스 랜딩 페이지 디자인해줘"

[SAX] Skill: frontend-design 실행 - Design Thinking

📋 디자인 사고 단계

1️⃣ **목적**
   - 서비스 가치 전달 및 회원가입 유도
   - 첫 방문자 → 가입자 전환

2️⃣ **톤**
   - [x] Bold & Vibrant - 시선을 사로잡는 첫인상

3️⃣ **차별점**
   - 히어로 섹션의 3D 인터랙션 요소
   - 스크롤 기반 스토리텔링

4️⃣ **제약사항**
   - 로딩 3초 이내 (LCP 최적화)
   - 모바일 퍼스트

---

[SAX] frontend-design: Production Code 시작
...
```

### Example 2: 대시보드 컴포넌트

```
User: "관리자 대시보드 카드 컴포넌트 만들어줘"

[SAX] Skill: frontend-design 실행 - Design Thinking

📋 디자인 사고 단계

1️⃣ **목적**
   - 핵심 지표 한눈에 파악
   - 데이터 기반 의사결정 지원

2️⃣ **톤**
   - [x] Professional & Trust - 데이터 신뢰성 강조

3️⃣ **차별점**
   - 마이크로 인터랙션 (숫자 카운트업)
   - 컨텍스트 기반 색상 (증감 표시)

4️⃣ **제약사항**
   - 다크모드 필수 지원
   - 접근성 AA 준수
```

## Constraints

### 필수 조건

1. **Design Thinking 필수**: Phase 1 생략 불가
2. **Anti-Pattern 검증**: 제네릭 요소 사용 시 경고
3. **팀 시스템 준수**: shadcn/ui 베이스 유지

### 권장 사항

- 디자인 결정사항 문서화 (`design-decisions.md`)
- 컴포넌트 스토리북 작성
- 반응형 브레이크포인트 테스트

## References

- [Design Thinking Guide](references/design-thinking.md) - Phase 1 상세 가이드
- [Anti-Pattern Catalog](references/anti-patterns.md) - 피해야 할 패턴 목록
- [Component Patterns](references/component-patterns.md) - 재사용 가능한 패턴
- [Anthropic frontend-design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) - 원본 참고
