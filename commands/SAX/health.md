---
name: health
description: MVP 개발 환경 및 MCP 서버 검증
---

# /SAX:health

MVP 개발 환경과 MCP 서버 연동 상태를 검증합니다.

## 실행

`skill:health-check`를 호출합니다.

## 검증 항목

### 필수 도구
- Node.js (v18+)
- pnpm (v8+)
- Git
- GitHub CLI
- Supabase CLI

### MCP 서버
- Context7 (문서 검색)
- Sequential-thinking (구조화된 추론)
- TestSprite (테스트 자동화)
- Supabase (프로젝트 연동)
- GitHub (Organization 연동)

### Antigravity (선택)
- `.agent/rules/` 폴더
- `.agent/workflows/` 폴더

## 프롬프트

```
[SAX] Skill: health-check 호출 - 환경 검증

MVP 개발 환경을 검증합니다.
```
