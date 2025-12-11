# Antigravity Setup Guide

> Google Antigravity 설정 가이드 for SAX-Design

## 개요

Antigravity는 Google의 Agent-First IDE로, Gemini 3 모델과 Nano Banana Pro (이미지 생성)를 활용합니다.
SAX-Design과 함께 사용하면 텍스트 기반 Claude Code와 시각적 Antigravity의 장점을 모두 활용할 수 있습니다.

---

## 설치 확인

### 1. Antigravity IDE 설치

Antigravity는 Project IDX 또는 Firebase Studio를 통해 접근합니다.

```
https://idx.dev/
https://firebase.studio/
```

### 2. .agent 폴더 구조 확인

프로젝트 루트에 다음 구조가 필요합니다:

```
프로젝트/
└── .agent/
    ├── rules/           # 항상 활성화되는 규칙
    │   └── sax-context.md
    └── workflows/       # /command로 호출되는 워크플로우
        └── mockup.md
```

---

## Rules 설정

### sax-context.md

`.agent/rules/sax-context.md` 파일로 SAX 컨텍스트를 주입합니다:

```markdown
# SAX Design Context

## SAX 메시지 규칙
- 모든 응답 시작: `[SAX] {Type}: {name} - {action}`
- Type: Agent, Skill, Reference

## 디자인 원칙
- 반응형 우선 (Mobile-first)
- 접근성 준수 (WCAG 2.1 AA)
- 디자인 토큰 사용

## 핸드오프 문서 생성 시
design-handoff 형식을 따라 문서를 생성합니다.
```

---

## Workflows 설정

### mockup.md

`.agent/workflows/mockup.md` 파일로 `/mockup` 명령어를 정의합니다:

```markdown
# UI Mockup Generation Workflow

## 트리거
- `/mockup {description}`

## 프로세스
1. 요구사항 분석
2. Nano Banana Pro로 목업 이미지 생성
3. 반응형 변형 생성 (Desktop, Tablet, Mobile)
4. 결과 아티팩트로 제공

## 출력
- 고해상도 UI 목업 이미지
- 컬러/타이포그래피 스펙
- 컴포넌트 구조 설명
```

---

## MCP 서버 연동

Antigravity에서 MCP 서버를 사용하려면 별도 설정이 필요합니다.
현재 Claude Code의 MCP 서버와 직접 연동은 지원되지 않으므로,
Claude Code에서 생성한 핸드오프 문서를 통해 정보를 전달합니다.

---

## 권장 워크플로우

```text
[Claude Code]
1. 요구사항 분석 및 디자인 스펙 정의
2. design-handoff Skill로 핸드오프 문서 생성
   ↓
[Antigravity]
3. /mockup 워크플로우로 UI 목업 생성
4. 브라우저 서브에이전트로 테스트
5. 목업 이미지 저장
   ↓
[Claude Code]
6. 목업 기반 컴포넌트 코드 작성
7. playwright MCP로 E2E 테스트
```

---

## 문제 해결

### .agent 폴더가 인식되지 않음

1. Antigravity IDE에서 프로젝트를 다시 열기
2. `.agent/` 폴더가 프로젝트 루트에 있는지 확인
3. 파일 확장자가 `.md`인지 확인

### Rules가 적용되지 않음

1. `rules/` 폴더 내 파일명 확인
2. 마크다운 문법 오류 확인
3. Antigravity 재시작

### Workflows 명령어가 작동하지 않음

1. `workflows/` 폴더 경로 확인
2. 파일명과 명령어 일치 확인 (예: `mockup.md` → `/mockup`)
3. 워크플로우 마크다운 구조 확인
