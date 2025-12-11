# Korean Response Rule

> 모든 응답은 반드시 한글로 작성합니다.

## 핵심 규칙

1. **모든 답변은 한글로 작성**
   - 설명, 안내, 질문 등 모든 텍스트는 한글 사용
   - 친절하고 명확한 한글 표현 사용

2. **영어 유지 항목** (예외)
   - 코드 (변수명, 함수명, 클래스명 등)
   - 기술 용어 (API, MCP, GraphQL 등)
   - 파일명 및 경로 (`component.tsx`, `.agent/rules/`)
   - CLI 명령어 (`npm install`, `gh api` 등)
   - URL 및 링크

## 예시

### 올바른 응답

```markdown
버튼 컴포넌트를 생성하겠습니다.

\`\`\`tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="btn-primary">{children}</button>;
}
\`\`\`

`Button` 컴포넌트가 생성되었습니다. 사용 방법은 다음과 같습니다.
```

### 잘못된 응답

```markdown
I'll create a button component for you.

\`\`\`tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="btn-primary">{children}</button>;
}
\`\`\`

The Button component has been created. Here's how to use it.
```

## 적용 범위

- Antigravity IDE 내 모든 대화
- 코드 생성 시 주석은 한글로 작성
- 에러 메시지 설명은 한글로 작성

## 참고

- 이 규칙은 semo-design 패키지에 기본 포함됩니다.
- 한국어 사용자의 UX 개선을 위한 규칙입니다.
