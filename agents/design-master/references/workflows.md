# Design Master Workflows

> design-master Agent의 상세 워크플로우 가이드

## Workflow 1: 목업 생성

### 프로세스

1. **요구사항 분석**: 사용자 입력에서 디자인 요구사항 추출
2. **컴포넌트 구조 설계**: 필요한 UI 요소 식별
3. **Magic MCP 호출**: 21st.dev 패턴으로 컴포넌트 생성
4. **결과 제공**: 컴포넌트 코드 및 구조 설명

### 예시

```markdown
사용자: "로그인 폼 목업 만들어줘"

[SAX] Agent: design-master 호출 - 목업 생성
[SAX] Skill 호출: generate-mockup

## 로그인 폼 목업

### 컴포넌트 구조
- Form container
- Email input field
- Password input field
- Submit button
- Social login buttons (optional)

### 생성된 코드
[Magic MCP 결과]
```

---

## Workflow 2: 핸드오프 문서 생성

### 프로세스

1. **디자인 요소 분석**: 대상 컴포넌트/화면 식별
2. **스펙 추출**: 색상, 타이포그래피, 스페이싱 정리
3. **인터랙션 정의**: 상태별 동작 명세
4. **접근성 체크**: WCAG 준수 항목 확인
5. **문서 생성**: design-handoff.md 파일 생성

### 출력 형식

```markdown
# Design Handoff: {컴포넌트명}

## 1. 개요
## 2. 시각 스펙
## 3. 인터랙션
## 4. 반응형
## 5. 접근성
## 6. 에셋
```

---

## Workflow 3: Figma 연동

### 가능한 작업

| 작업 | Framelink 함수 |
|------|---------------|
| 파일 데이터 조회 | `get_figma_data` |
| 이미지 다운로드 | `download_figma_images` |

### 프로세스

1. **Figma URL 파싱**: fileKey, nodeId 추출
2. **데이터 조회**: Framelink MCP로 디자인 데이터 가져오기
3. **스펙 추출**: 색상, 폰트, 레이아웃 정보 정리
4. **결과 제공**: 디자인 스펙 또는 핸드오프 문서로 변환

### 예시

```markdown
사용자: "이 Figma 디자인 가져와: https://www.figma.com/file/abc123/..."

[SAX] Agent: design-master 호출 - Figma 연동
[SAX] MCP: Framelink 사용

## Figma 디자인 데이터

**파일**: abc123
**노드**: Login Screen

### 추출된 스펙
- 배경색: #FFFFFF
- Primary 버튼: #3B82F6
- 폰트: Inter, 16px
```

---

## Workflow 4: 컴포넌트 생성

### 프로세스

1. **요구사항 분석**: 컴포넌트 유형 및 속성 식별
2. **패턴 검색**: 21st.dev에서 유사 컴포넌트 검색
3. **코드 생성**: Magic MCP로 컴포넌트 코드 생성
4. **커스터마이징**: 프로젝트 스타일에 맞게 조정

---

## Workflow 5: 브라우저 테스트

### 가능한 테스트

- 반응형 레이아웃 검증
- 인터랙션 동작 확인
- 접근성 (ARIA, 키보드) 테스트
- 스크린샷 캡처

### Playwright MCP 주요 함수

- `browser_navigate`: 페이지 이동
- `browser_snapshot`: 접근성 스냅샷
- `browser_take_screenshot`: 스크린샷
- `browser_click`, `browser_type`: 인터랙션

---

## 예외 처리

### MCP 서버 미설정 시

```markdown
[SAX] Agent: design-master - MCP 서버 미설정

{mcp_name} MCP 서버가 설정되지 않았습니다.

**설정 방법**:
\`\`\`bash
# ~/.claude.json에 추가
jq '.mcpServers += {"magic": {"command": "npx", "args": ["@anthropic/claude-mcp-magic"]}}' ~/.claude.json > tmp && mv tmp ~/.claude.json
\`\`\`

또는 `/SAX:health-check`로 전체 환경을 점검하세요.
```

### Figma 권한 없음 시

```markdown
[SAX] Agent: design-master - Figma 접근 실패

Figma 파일에 접근할 수 없습니다.

**확인 사항**:
1. Figma 로그인 상태
2. 파일 접근 권한
3. Framelink MCP 설정
```
