# Browser Testing

**Purpose**: 실제 브라우저에서 UI/UX 검증 (Layer 5.5 - Optional)

## MCP Options

| MCP | Description | Use Case |
|-----|-------------|----------|
| `playwright` | 헤드리스 브라우저 자동화 | 빠르고 안정적 (권장) |
| `chrome-devtools` | 기존 Chrome 브라우저 연동 | DevTools 연결 필요 |

## User Prompt

단위 테스트 통과 후 표시:

```markdown
🖥️ **브라우저 테스트 옵션**

단위 테스트가 통과했습니다. 브라우저에서 추가 검증을 진행하시겠습니까?

1. **직접 테스트**: 개발자가 직접 브라우저에서 확인
2. **AI 브라우저 테스트**: AI가 MCP로 자동 테스트
3. **건너뛰기**: 브라우저 테스트 생략

선택해주세요 (1/2/3)
```

## Test Execution

### Playwright (권장)

```javascript
mcp__playwright__browser_navigate(url: "http://localhost:3000/{path}")
mcp__playwright__browser_snapshot()
mcp__playwright__browser_console_messages(onlyErrors: true)
```

### Chrome DevTools

```javascript
mcp__chrome-devtools__navigate_page(url: "http://localhost:3000/{path}")
mcp__chrome-devtools__take_snapshot()
mcp__chrome-devtools__list_console_messages(types: ["error"])
```

## Test Categories

| Category | Description |
|----------|-------------|
| Page Load | 페이지 정상 로드 및 렌더링 |
| UI Elements | 주요 컴포넌트 표시 |
| Interactions | 버튼, 폼, 네비게이션 동작 |
| Console Errors | JavaScript/네트워크 에러 없음 |
| Responsive | 데스크톱/모바일 뷰 확인 (선택적) |

## Report Format

```markdown
## 🖥️ Browser Test Results

**Environment**:
- URL: http://localhost:3000/{path}
- MCP: playwright | chrome-devtools
- Viewport: 1920x1080

**Results**:
| Category | Status | Details |
|----------|--------|---------|
| Page Load | ✅/❌ | [시간] |
| UI Rendering | ✅/❌ | [상태] |
| Interactions | ✅/❌ | [테스트 항목] |
| Console Errors | ✅/❌ | [에러 수] |

**Status**: ✅ PASSED | ❌ FAILED
```
