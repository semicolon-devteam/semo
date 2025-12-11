# Browser Testing Verification

> quality-master Agent의 브라우저 테스트 검증 (Optional)

## Purpose

실제 브라우저에서 UI/UX 검증

## User Prompt

```markdown
🖥️ **브라우저 테스트 옵션**

단위 테스트가 통과했습니다. 브라우저에서 추가 검증을 진행하시겠습니까?

1. **직접 테스트**: 개발자가 직접 브라우저에서 확인
2. **AI 브라우저 테스트**: AI가 MCP(chrome-devtools/playwright)로 자동 테스트
3. **건너뛰기**: 브라우저 테스트 생략

선택해주세요 (1/2/3)
```

## MCP Tool Selection

- **chrome-devtools**: 기존 Chrome 브라우저 연동 (DevTools 필요)
- **playwright**: 헤드리스 브라우저 자동화 (빠르고 안정적)

## Browser Test Execution

```bash
# Step 1: 개발 서버 확인
# (npm run dev가 실행 중인지 확인)

# Step 2: MCP를 통한 테스트 실행
# Option A: chrome-devtools
mcp__chrome-devtools__navigate_page(url: "http://localhost:3000/{path}")
mcp__chrome-devtools__take_snapshot()
mcp__chrome-devtools__list_console_messages(types: ["error", "warn"])

# Option B: playwright
mcp__playwright__browser_navigate(url: "http://localhost:3000/{path}")
mcp__playwright__browser_snapshot()
mcp__playwright__browser_console_messages(onlyErrors: true)
```

## Test Checklist

```markdown
## 🖥️ Browser Test Checklist

**Page Load**:

- [ ] 페이지 정상 로드
- [ ] 초기 렌더링 완료
- [ ] 로딩 상태 표시 (해당 시)

**UI Elements**:

- [ ] 헤더/네비게이션 렌더링
- [ ] 주요 컴포넌트 표시
- [ ] 스타일링 정상 적용

**Interactions**:

- [ ] 버튼 클릭 동작
- [ ] 폼 입력 동작
- [ ] 네비게이션 동작

**Console**:

- [ ] JavaScript 에러 없음
- [ ] 네트워크 에러 없음
- [ ] 경고 메시지 확인

**Responsive**:

- [ ] 데스크톱 뷰 확인
- [ ] 모바일 뷰 확인 (선택적)
```

## Browser Test Report

```markdown
## 🖥️ Browser Test Results

**Environment**:

- URL: http://localhost:3000/{path}
- MCP: chrome-devtools | playwright
- Viewport: 1920x1080 | 390x844

**Results**:
| Category | Status | Details |
|----------|--------|---------|
| Page Load | ✅/❌ | [로드 시간] |
| UI Rendering | ✅/❌ | [컴포넌트 상태] |
| Interactions | ✅/❌ | [테스트 항목] |
| Console Errors | ✅/❌ | [에러 수] |
| Responsive | ✅/❌ | [뷰포트 테스트] |

**Issues Found**:
[이슈 목록 또는 "없음"]

**Screenshots**:
[경로 또는 "N/A"]

**Status**: ✅ BROWSER TEST PASSED | ❌ BROWSER TEST FAILED
```

## Severity Classification

- 🔴 **Critical**: 페이지 로드 실패, JavaScript 크래시, 핵심 기능 불가
- 🟡 **Warning**: 콘솔 경고, 스타일 깨짐, 비핵심 기능 이슈
- 🟢 **Info**: 성능 개선 가능, UI 개선 제안
