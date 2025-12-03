---
name: mockup
description: UI 목업 생성
---

# /SAX:mockup Command

Magic MCP (21st.dev)를 활용하여 UI 목업을 생성합니다.

## Trigger

- `/SAX:mockup {설명}` 명령어
- "목업 만들어", "mockup", "UI 만들어" 키워드

## Action

`design-master` Agent → `generate-mockup` Skill을 호출하여 목업을 생성합니다.

## Usage

```bash
# 기본 사용
/SAX:mockup 로그인 폼

# 상세 설명
/SAX:mockup 이메일과 비밀번호 입력이 있는 로그인 폼, 소셜 로그인 버튼 포함

# 특정 스타일
/SAX:mockup 다크 테마 대시보드 사이드바
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 목업 생성

[SAX] Agent: design-master 호출 (트리거: /SAX:mockup)

[SAX] Skill: generate-mockup 호출

## 목업: 로그인 폼

### 요구사항
- 이메일 입력 필드
- 비밀번호 입력 필드
- 제출 버튼
- 소셜 로그인 (선택)

### 컴포넌트 구조
```
Form
├── EmailInput
├── PasswordInput
├── SubmitButton
└── SocialLoginSection (optional)
```

### 생성된 코드
```tsx
// Magic MCP 결과
export function LoginForm() {
  return (
    <form className="...">
      ...
    </form>
  )
}
```

### 다음 단계
- `/SAX:handoff`로 핸드오프 문서 생성
- 또는 수정 요청
```

## Options

| 옵션 | 설명 | 예시 |
|------|------|------|
| 컴포넌트 설명 | 생성할 UI 설명 | "로그인 폼" |
| 스타일 | 테마/스타일 지정 | "다크 테마" |
| 요소 | 포함할 요소 | "소셜 로그인 포함" |

## Related

- [generate-mockup Skill](../../skills/generate-mockup/SKILL.md)
- [design-master Agent](../../agents/design-master/design-master.md)
- [design-handoff Skill](../../skills/design-handoff/SKILL.md)
