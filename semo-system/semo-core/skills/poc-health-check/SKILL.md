---
name: health-check
description: MVP 개발 환경 및 MCP 서버 검증
tools: [Bash, Read, Glob]
---

> **시스템 메시지**: `[SEMO] Skill: health-check 호출 - 환경 검증`

# Health Check Skill

## Purpose

MVP 개발을 위한 환경과 MCP 서버 연동 상태를 검증합니다.

## Quick Start

```bash
/SEMO:health
```

또는 "환경 검증", "health check", "MCP 확인" 키워드로 트리거

## 검증 항목

### 1. 공통 도구

| 도구 | 최소 버전 | 필수 |
|------|----------|------|
| Node.js | v18+ | ✅ |
| pnpm | v8+ | ✅ |
| Git | - | ✅ |
| GitHub CLI | - | ✅ |
| Supabase CLI | - | ✅ |

### 2. MCP 서버

| Server | 용도 | 필수 |
|--------|------|------|
| Context7 | 문서 검색 | ✅ |
| Sequential-thinking | 구조화된 추론 | ✅ |
| TestSprite | 테스트 자동화 | ✅ |
| Supabase | 프로젝트 연동 | ✅ |
| GitHub | Org/Repo 연동 | ✅ |

## Output Format

```markdown
# 🏥 SEMO-MVP Health Check 결과

## 📦 도구 버전

| 도구 | 필수 버전 | 현재 버전 | 상태 |
|------|----------|----------|------|
| Node.js | v18+ | {version} | {status} |
...

## 🔌 MCP 서버

| Server | 용도 | 상태 |
|--------|------|------|
| Context7 | 문서 검색 | {status} |
...

## 요약
- 필수 항목: {passed}/{total} 통과
- 권장 액션: {recommendations}
```

## References

- [MCP Verification](references/mcp-verification.md) - MCP 서버 검증 방법
- [Troubleshooting](references/troubleshooting.md) - 문제 해결 가이드
