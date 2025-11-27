# Browser Testing

> implementation-master Agent의 MCP 브라우저 테스트 워크플로우

## Phase v0.4.x+: BROWSER TESTING (Optional but Recommended)

**Purpose**: UI/UX 검증을 위한 실제 브라우저 테스트

## User Prompt

```markdown
🖥️ **브라우저 테스트**

구현이 완료되었습니다! PR 전에 브라우저에서 테스트를 진행할까요?

1. **직접 테스트**: 개발 서버(`npm run dev`)를 실행하고 직접 확인
2. **AI 브라우저 테스트**: AI가 MCP(chrome-devtools/playwright)로 자동 테스트 실행

선택해주세요 (1/2) 또는 "skip"으로 건너뛰기
```

## AI Browser Testing (Option 2)

```markdown
🤖 **AI 브라우저 테스트 실행**

**테스트 시나리오**:
1. 개발 서버 시작 확인 (`localhost:3000`)
2. 해당 도메인 페이지 접근
3. UI 요소 렌더링 확인
4. 주요 인터랙션 테스트
5. 콘솔 에러 확인
6. 스크린샷 캡처 (선택적)

**MCP 선택**:
- `chrome-devtools`: 기존 Chrome 브라우저 활용 (DevTools 연동)
- `playwright`: 헤드리스 브라우저 자동화 (빠른 실행)

실행 중...
```

## Browser Test Workflow

```bash
# Step 1: 개발 서버 실행 확인
# (이미 실행 중이거나 npm run dev 실행)

# Step 2: MCP를 통한 브라우저 테스트
# Option A: chrome-devtools MCP
mcp__chrome-devtools__navigate_page(url: "http://localhost:3000/{domain}")
mcp__chrome-devtools__take_snapshot()
mcp__chrome-devtools__list_console_messages(types: ["error"])

# Option B: playwright MCP
mcp__playwright__browser_navigate(url: "http://localhost:3000/{domain}")
mcp__playwright__browser_snapshot()
mcp__playwright__browser_console_messages(onlyErrors: true)
```

## Test Scenarios by Domain

```typescript
// 예시: posts 도메인
const testScenarios = [
  { action: "navigate", target: "/posts", expected: "PostsList 렌더링" },
  { action: "check", target: "empty-state", expected: "빈 상태 UI 표시 (데이터 없을 시)" },
  { action: "check", target: "loading-state", expected: "로딩 인디케이터 표시" },
  { action: "click", target: "filter-button", expected: "필터 드롭다운 열림" },
  { action: "console", target: "errors", expected: "에러 없음" },
];
```

## Browser Test Report

```markdown
## 🖥️ Browser Test Results

**Test Environment**:
- URL: http://localhost:3000/{domain}
- MCP: chrome-devtools | playwright
- Browser: Chrome | Chromium

**Test Cases**:
| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 1 | 페이지 로드 | ✅ | 2.1s |
| 2 | UI 렌더링 | ✅ | 모든 컴포넌트 표시 |
| 3 | 인터랙션 | ✅ | 필터, 버튼 동작 정상 |
| 4 | 콘솔 에러 | ✅ | 에러 없음 |
| 5 | 반응형 | ✅ | 모바일/데스크톱 확인 |

**Screenshots**: [첨부 또는 경로]

**Issues Found**: 없음 | [이슈 목록]

**Status**: ✅ BROWSER TEST PASSED
```

## If Browser Test Fails

```markdown
❌ **Browser Test Failed**

**발견된 이슈**:
1. [이슈 설명]
   - 위치: [컴포넌트/페이지]
   - 콘솔 에러: [에러 메시지]
   - 스크린샷: [경로]

**권장 조치**:
1. [수정 방법]
2. [재테스트 필요 여부]

수정 후 다시 브라우저 테스트를 실행하시겠습니까? (yes/no)
```

## MCP Tool Reference

### chrome-devtools

| Tool | Purpose |
|------|---------|
| `navigate_page` | 페이지 이동 |
| `take_snapshot` | A11y 스냅샷 |
| `take_screenshot` | 스크린샷 캡처 |
| `list_console_messages` | 콘솔 로그 확인 |
| `click` | 요소 클릭 |
| `fill` | 입력 필드 채우기 |

### playwright

| Tool | Purpose |
|------|---------|
| `browser_navigate` | 페이지 이동 |
| `browser_snapshot` | A11y 스냅샷 |
| `browser_take_screenshot` | 스크린샷 캡처 |
| `browser_console_messages` | 콘솔 로그 확인 |
| `browser_click` | 요소 클릭 |
| `browser_type` | 텍스트 입력 |

## Complete Flow

```
v0.4.x CODE Complete
        ↓
Browser Test Prompt
        ↓
    ┌───┴───┐
    │       │
 Option 1  Option 2
 (Manual)  (AI Test)
    │       │
    └───┬───┘
        ↓
   Test Report
        ↓
    ┌───┴───┐
    │       │
   Pass    Fail
    │       │
    ↓       ↓
 /verify   Fix & Retry
```
