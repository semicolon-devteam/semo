---
name: mockup
description: Antigravity로 UI 목업 생성 위임
---

# /SAX:mockup

UI 목업 생성을 Antigravity로 위임합니다.

## 실행

Antigravity IDE로 전환하여 `/mockup` 워크플로우를 실행하도록 안내합니다.

## 안내 메시지

```markdown
[SAX] Antigravity 위임: UI 목업 생성

이 작업은 Antigravity에서 더 효과적으로 수행할 수 있습니다.

## 실행 방법

1. Antigravity IDE에서 프로젝트 열기
2. `/mockup {description}` 실행

## 예시

\`\`\`
/mockup 로그인 폼, 이메일과 비밀번호 입력, 소셜 로그인 버튼 포함
/mockup 대시보드 레이아웃, 사이드바와 상단 네비게이션
/mockup 오피스 예약 캘린더, 주간 뷰
\`\`\`

## 산출물

- 목업 이미지: `assets/mockups/`
- 목업 기반 구현은 Claude Code에서 진행
```

## 프롬프트

```
[SAX] Antigravity 위임: 시각적 작업 감지

UI 목업 생성은 Antigravity에서 진행해주세요.
```
