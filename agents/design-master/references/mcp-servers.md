# MCP 서버 활용 가이드

> design-master Agent가 사용하는 MCP 서버 상세 가이드

## Magic (21st.dev)

**용도**: UI 컴포넌트 생성

### 주요 함수

| 함수 | 설명 |
|------|------|
| `21st_magic_component_builder` | 컴포넌트 빌더 |
| `21st_magic_component_inspiration` | 영감/참고 검색 |
| `21st_magic_component_refiner` | 컴포넌트 개선 |
| `logo_search` | 로고 검색 |

### 사용 예시

```markdown
[SAX] MCP: magic 사용

21st_magic_component_builder({
  "type": "button",
  "variant": "primary",
  "framework": "react"
})
```

---

## Framelink (Figma)

**용도**: Figma 데이터 조회

### 주요 함수

| 함수 | 설명 |
|------|------|
| `get_figma_data` | 파일/노드 데이터 조회 |
| `download_figma_images` | 이미지 다운로드 |

### 사용 예시

```markdown
[SAX] MCP: Framelink 사용

get_figma_data({
  "fileKey": "abc123def456",
  "nodeId": "1:234"
})
```

### Figma URL 파싱

Figma URL 형식:
```
https://www.figma.com/file/{fileKey}/{fileName}?node-id={nodeId}
```

추출 예시:
- fileKey: `abc123def456`
- nodeId: `1-234` (URL에서는 `1:234`로 표시)

---

## Playwright

**용도**: 브라우저 자동화 및 테스트

### 주요 함수

| 함수 | 설명 |
|------|------|
| `browser_navigate` | 페이지 이동 |
| `browser_snapshot` | 접근성 스냅샷 |
| `browser_take_screenshot` | 스크린샷 |
| `browser_click` | 클릭 인터랙션 |
| `browser_type` | 텍스트 입력 |

### 사용 예시

```markdown
[SAX] MCP: playwright 사용

# 페이지 이동
browser_navigate("https://example.com")

# 스크린샷 캡처
browser_take_screenshot("login-form.png")

# 접근성 스냅샷
browser_snapshot()
```

---

## MCP 서버 설정

### Magic MCP 설정

```json
{
  "mcpServers": {
    "magic": {
      "command": "npx",
      "args": ["@anthropic/claude-mcp-magic"]
    }
  }
}
```

### Framelink MCP 설정

```json
{
  "mcpServers": {
    "framelink": {
      "command": "npx",
      "args": ["@anthropic/claude-mcp-framelink"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your-figma-token"
      }
    }
  }
}
```

### Playwright MCP 설정

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic/claude-mcp-playwright"]
    }
  }
}
```

---

## References

- [Magic MCP Documentation](https://21st.dev/docs)
- [Framelink MCP Documentation](https://github.com/anthropics/claude-mcp-framelink)
- [Playwright MCP Documentation](https://github.com/anthropics/claude-mcp-playwright)
