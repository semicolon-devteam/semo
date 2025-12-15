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

---

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

### 3. Antigravity 설정 (선택)

- `.agent/rules/` 폴더 존재
- `.agent/workflows/` 폴더 존재

---

## 검증 스크립트

```bash
#!/bin/bash
echo "=== SEMO-MVP Health Check ==="

echo ""
echo "📦 도구 버전 확인"
echo "─────────────────"
echo "Node.js: $(node --version 2>/dev/null || echo '❌ 미설치')"
echo "pnpm: $(pnpm --version 2>/dev/null || echo '❌ 미설치')"
echo "Git: $(git --version 2>/dev/null | cut -d' ' -f3 || echo '❌ 미설치')"
echo "GitHub CLI: $(gh --version 2>/dev/null | head -1 | cut -d' ' -f3 || echo '❌ 미설치')"
echo "Supabase CLI: $(supabase --version 2>/dev/null | cut -d' ' -f2 || echo '❌ 미설치')"

echo ""
echo "🔌 MCP 서버 상태"
echo "─────────────────"
echo "Context7: 수동 확인 필요"
echo "Sequential-thinking: 수동 확인 필요"
echo "TestSprite: 수동 확인 필요"
echo "Supabase: 수동 확인 필요"
echo "GitHub: $(gh auth status 2>&1 | grep -q 'Logged in' && echo '✅ 연결됨' || echo '❌ 미연결')"

echo ""
echo "📁 Antigravity 설정"
echo "─────────────────"
[ -d ".agent/rules" ] && echo ".agent/rules/: ✅" || echo ".agent/rules/: ❌"
[ -d ".agent/workflows" ] && echo ".agent/workflows/: ✅" || echo ".agent/workflows/: ❌"
```

---

## 출력 형식

```markdown
# 🏥 SEMO-MVP Health Check 결과

## 📦 도구 버전

| 도구 | 필수 버전 | 현재 버전 | 상태 |
|------|----------|----------|------|
| Node.js | v18+ | {version} | {status} |
| pnpm | v8+ | {version} | {status} |
| Git | - | {version} | {status} |
| GitHub CLI | - | {version} | {status} |
| Supabase CLI | - | {version} | {status} |

## 🔌 MCP 서버

| Server | 용도 | 상태 |
|--------|------|------|
| Context7 | 문서 검색 | {status} |
| Sequential-thinking | 구조화된 추론 | {status} |
| TestSprite | 테스트 자동화 | {status} |
| Supabase | 프로젝트 연동 | {status} |
| GitHub | Org/Repo 연동 | {status} |

## 📁 Antigravity (선택)

| 항목 | 상태 |
|------|------|
| .agent/rules/ | {status} |
| .agent/workflows/ | {status} |

---

## 요약
- 필수 항목: {passed}/{total} 통과
- 권장 액션: {recommendations}
```

---

## MCP 서버 검증 방법

> **자동 검증**: 아래 MCP 도구 호출을 통해 연결 상태를 자동으로 확인합니다.

### Context7

```typescript
// MCP 호출 테스트
mcp_context7_resolve_library_id({ libraryName: "react" })

// 예상 응답: { libraryId: "..." }
// 성공 시 ✅, 오류 발생 시 ❌
```

**검증 명령**:
```
Claude에게 요청: "Context7로 react 라이브러리 ID 조회해줘"
```

### Sequential-thinking

```typescript
// MCP 호출 테스트
mcp_sequential_thinking_sequentialthinking({
  thought: "테스트 추론입니다",
  nextThoughtNeeded: false
})

// 예상 응답: { thought: "...", nextThoughtNeeded: false }
// 성공 시 ✅, 오류 발생 시 ❌
```

**검증 명령**:
```
Claude에게 요청: "Sequential-thinking으로 간단한 추론 테스트해줘"
```

### TestSprite

```typescript
// MCP 호출 테스트
mcp_testsprite_analyze_test_file({ filePath: "src/example.ts" })

// 예상 응답: 테스트 분석 결과
// 성공 시 ✅, 오류 발생 시 ❌
```

**검증 명령**:
```
Claude에게 요청: "TestSprite로 테스트 분석 가능한지 확인해줘"
```

### Supabase

```typescript
// MCP 호출 테스트
mcp_supabase_list_projects()

// 예상 응답: [{ id: "...", name: "..." }, ...]
// 성공 시 ✅, 오류 발생 시 ❌
```

**검증 명령**:
```
Claude에게 요청: "Supabase MCP로 프로젝트 목록 조회해줘"
```

**추가 검증** (프로젝트 연동):
```typescript
// 특정 프로젝트 테이블 조회
mcp_supabase_list_tables({ projectId: "your-project-id" })
```

### GitHub

```typescript
// MCP 호출 테스트 (gh CLI 기반)
// Organization 접근 확인
gh api orgs/semicolon-devteam

// 리포지토리 목록 조회
gh api orgs/semicolon-devteam/repos --jq '.[].name'
```

**검증 명령**:
```bash
# CLI로 직접 확인
gh auth status
gh api orgs/semicolon-devteam --jq '.login'
```

---

## 자동화된 MCP 검증 스크립트

```bash
#!/bin/bash
# check-mcp-status.sh
# MCP 서버 연결 상태 자동 검증

echo "=== MCP 서버 검증 ==="
echo ""

# GitHub (CLI로 확인 가능)
echo "🔌 GitHub MCP"
if gh auth status &>/dev/null; then
    ORG_ACCESS=$(gh api orgs/semicolon-devteam --jq '.login' 2>/dev/null)
    if [ "$ORG_ACCESS" = "semicolon-devteam" ]; then
        echo "  ✅ 연결됨 (semicolon-devteam 접근 가능)"
    else
        echo "  ⚠️ 인증됨, Organization 접근 확인 필요"
    fi
else
    echo "  ❌ 미연결 (gh auth login 필요)"
fi

echo ""
echo "📋 Claude에서 확인 필요한 MCP:"
echo "  - Context7: \"Context7로 react 조회해줘\""
echo "  - Sequential-thinking: \"추론 테스트해줘\""
echo "  - TestSprite: \"테스트 분석 가능한지 확인해줘\""
echo "  - Supabase: \"프로젝트 목록 조회해줘\""
echo ""
echo "💡 Claude Code/Desktop에서 위 명령을 실행하여 MCP 연결 상태를 확인하세요."
```

---

## MCP 설정 가이드 (연결 실패 시)

### Claude Desktop 설정 파일 위치

| OS | 경로 |
|----|------|
| macOS | `~/.config/claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### 설정 예시

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@anthropics/context7-mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropics/sequential-thinking-mcp"]
    },
    "testsprite": {
      "command": "npx",
      "args": ["-y", "@anthropics/testsprite-mcp"]
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your-access-token"
      }
    }
  }
}
```

> **참조**: [MCP 설정 가이드](../../semo-core/_shared/mcp-config.md)

---

## 문제 해결 가이드

### 도구 미설치

```bash
# Node.js
brew install node

# pnpm
npm install -g pnpm

# GitHub CLI
brew install gh
gh auth login

# Supabase CLI
brew install supabase/tap/supabase
supabase login
```

### MCP 서버 미연결

1. Claude Desktop 설정 파일 확인:
   - macOS: `~/.config/claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. MCP 서버 설정 추가 후 Claude 재시작

참조: [MCP 설정 가이드](../../semo-core/_shared/mcp-config.md)

---

## References

- [Antigravity Setup](references/antigravity-setup.md)
- [Supabase Setup](references/supabase-setup.md)
