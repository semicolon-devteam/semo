---
name: generate-mockup
description: Generate UI mockups using Magic MCP (21st.dev). Use when (1) creating new UI components, (2) prototyping interfaces, (3) building design system components, (4) rapid UI iteration needed. Leverages modern component patterns.
tools: [mcp_magic, Write]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: generate-mockup 호출 - UI 목업 생성` 시스템 메시지를 첫 줄에 출력하세요.

# generate-mockup Skill

> Magic MCP (21st.dev)를 활용한 UI 목업 생성

## 역할

디자이너의 요구사항을 분석하여 현대적인 UI 컴포넌트 목업을 생성합니다.

## 트리거

- `/SEMO:mockup` 명령어
- "목업", "mockup", "UI 만들어" 키워드
- design-master Agent에서 호출

---

## Quick Start

```markdown
사용자: "로그인 폼 목업 만들어줘"

[SEMO] Skill: generate-mockup 호출 - UI 목업 생성

## 요구사항 분석
- 컴포넌트: 로그인 폼
- 필요 요소: 이메일 입력, 비밀번호 입력, 제출 버튼

[SEMO] MCP: magic (21st.dev) 사용

## 생성된 목업
[Magic MCP 결과 - 컴포넌트 코드]
```

---

## 프로세스

### Step 1: 요구사항 분석

```markdown
## 요구사항 분석

**컴포넌트 유형**: {component_type}
**필요 요소**:
- {element_1}
- {element_2}
- ...

**스타일 요구사항**:
- 테마: {light/dark/custom}
- 크기: {sm/md/lg}
- 변형: {variant}
```

### Step 2: Magic MCP 호출

```typescript
// 21st_magic_component_builder 호출
{
  message: "{사용자 요청}",
  searchQuery: "{검색 쿼리 2-4 단어}",
  absolutePathToCurrentFile: "{현재 파일 경로}",
  absolutePathToProjectDirectory: "{프로젝트 루트}",
  standaloneRequestQuery: "{컴포넌트 생성 요청 상세}"
}
```

### Step 3: 결과 제공

```markdown
## 생성된 목업

### 컴포넌트 구조
{컴포넌트 구조 설명}

### 코드
\`\`\`tsx
{생성된 컴포넌트 코드}
\`\`\`

### 사용 방법
\`\`\`tsx
import { ComponentName } from './components/ComponentName'

<ComponentName prop={value} />
\`\`\`
```

---

## 컴포넌트 유형별 가이드

### Form 컴포넌트

```markdown
**검색 쿼리 예시**:
- "login form" - 로그인 폼
- "signup form" - 회원가입 폼
- "contact form" - 문의 폼
- "search input" - 검색 입력

**필수 요소**:
- 입력 필드 (Input)
- 레이블 (Label)
- 검증 메시지 (Error message)
- 제출 버튼 (Button)
```

### Navigation 컴포넌트

```markdown
**검색 쿼리 예시**:
- "navbar" - 네비게이션 바
- "sidebar" - 사이드바
- "breadcrumb" - 브레드크럼
- "tabs" - 탭 네비게이션

**필수 요소**:
- 메뉴 아이템
- 활성 상태 표시
- 반응형 처리
```

### Data Display 컴포넌트

```markdown
**검색 쿼리 예시**:
- "data table" - 데이터 테이블
- "card" - 카드
- "list" - 리스트
- "stats" - 통계 카드

**필수 요소**:
- 데이터 구조
- 정렬/필터 (테이블)
- 페이지네이션 (테이블)
```

### Feedback 컴포넌트

```markdown
**검색 쿼리 예시**:
- "modal dialog" - 모달/다이얼로그
- "toast notification" - 토스트 알림
- "alert" - 경고 메시지
- "progress" - 진행 상태

**필수 요소**:
- 열기/닫기 상태
- 애니메이션
- 접근성 (focus trap, ARIA)
```

---

## Magic MCP 함수

### 21st_magic_component_builder

**용도**: 새로운 UI 컴포넌트 생성

```typescript
{
  message: string,           // 전체 사용자 메시지
  searchQuery: string,       // 2-4 단어 검색어
  absolutePathToCurrentFile: string,
  absolutePathToProjectDirectory: string,
  standaloneRequestQuery: string  // 상세 생성 요청
}
```

### 21st_magic_component_inspiration

**용도**: 컴포넌트 영감/참고 검색

```typescript
{
  message: string,           // 전체 사용자 메시지
  searchQuery: string        // 검색어
}
```

### 21st_magic_component_refiner

**용도**: 기존 컴포넌트 개선

```typescript
{
  userMessage: string,
  absolutePathToRefiningFile: string,
  context: string            // 개선할 부분 설명
}
```

---

## 출력 형식

### 성공 시

```markdown
[SEMO] Skill: generate-mockup 호출 - UI 목업 생성

## 목업: {컴포넌트명}

### 요구사항
- {요구사항 1}
- {요구사항 2}

### 컴포넌트 구조
\`\`\`
{컴포넌트 구조 다이어그램}
\`\`\`

### 생성된 코드
\`\`\`tsx
{컴포넌트 코드}
\`\`\`

### 스타일링
- 테마: {theme}
- 색상: {colors}
- 타이포그래피: {typography}

### 다음 단계
- `/SEMO:handoff`로 핸드오프 문서 생성
- 또는 컴포넌트 수정 요청
```

### Magic MCP 미설정 시

```markdown
[SEMO] Skill: generate-mockup - MCP 서버 미설정

magic (21st.dev) MCP 서버가 설정되지 않았습니다.

**설정 방법**:
\`\`\`bash
# ~/.claude.json에 추가
jq '.mcpServers += {
  "magic": {
    "command": "npx",
    "args": ["@anthropic/claude-mcp-magic"]
  }
}' ~/.claude.json > tmp && mv tmp ~/.claude.json
\`\`\`

**대안**:
- Antigravity에서 `/mockup` 워크플로우 사용
- 수동으로 컴포넌트 구조 정의
```

---

## 디자인 원칙

### 1. 반응형 우선

모든 목업은 반응형을 기본으로 합니다:

```markdown
**Breakpoints**:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px
```

### 2. 접근성 준수

WCAG 2.1 AA 기준 준수:

```markdown
**필수 항목**:
- 키보드 탐색 가능
- ARIA 레이블 포함
- 색상 대비 4.5:1 이상
- 포커스 표시 명확
```

### 3. 디자인 토큰 사용

일관된 디자인 시스템:

```markdown
**색상**: CSS 변수 또는 Tailwind 클래스
**스페이싱**: 4px 단위 시스템
**타이포그래피**: 프로젝트 폰트 스택
```

---

## SEMO Message

```markdown
[SEMO] Skill: generate-mockup 사용

[SEMO] MCP: magic (21st.dev) - {component_type} 생성

[SEMO] Reference: 21st.dev 컴포넌트 패턴 적용
```

---

## References

- [design-master Agent](../../agents/design-master/design-master.md)
- [design-handoff Skill](../design-handoff/SKILL.md)
- [21st.dev Documentation](https://21st.dev/docs)
- [Magic MCP](https://github.com/anthropics/claude-mcp-magic)
