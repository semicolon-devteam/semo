# @semicolon/semo-mcp

> SEMO MCP Server v2.0 - Gemini 하이브리드 전략 기반 Integrations

## 개요

Gemini의 하이브리드 전략에 따라 **Black Box 영역**(외부 연동)을 MCP로 제공합니다.

| Layer | 영역 | 방식 |
|-------|------|------|
| Layer 0-1 | semo-core, semo-skills | White Box (Filesystem) |
| **Layer 2** | **semo-integrations** | **Black Box (MCP)** |

## 설치

```bash
npx @semicolon/semo-mcp
```

## Claude Code 설정

`.claude/settings.json`:

```json
{
  "mcpServers": {
    "semo-integrations": {
      "command": "npx",
      "args": ["-y", "@semicolon/semo-mcp"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_KEY": "${SUPABASE_KEY}"
      }
    }
  }
}
```

## 사용 가능한 도구

### Slack Integration

| 도구 | 설명 |
|------|------|
| `slack_send_message` | Slack 채널에 메시지 전송 |
| `slack_lookup_user` | 사용자 ID 조회 (멘션용) |

### GitHub Integration

| 도구 | 설명 |
|------|------|
| `github_create_issue` | GitHub 이슈 생성 |
| `github_create_pr` | GitHub PR 생성 |

### Supabase Integration

| 도구 | 설명 |
|------|------|
| `supabase_query` | Supabase 테이블 조회 |

### SEMO Orchestration

| 도구 | 설명 |
|------|------|
| `semo_route` | 요청을 적절한 Skill로 라우팅 |

## 리소스

| URI | 설명 |
|-----|------|
| `semo://integrations` | 외부 연동 목록 (Black Box) |
| `semo://skills` | Skill 목록 (White Box) |
| `semo://commands` | 커맨드 목록 |

## 환경변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `SLACK_BOT_TOKEN` | Slack Bot Token | Slack 사용 시 |
| `GITHUB_TOKEN` | GitHub Personal Access Token | GitHub 사용 시 |
| `SUPABASE_URL` | Supabase 프로젝트 URL | Supabase 사용 시 |
| `SUPABASE_KEY` | Supabase 서비스 키 | Supabase 사용 시 |

## 개발

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 빌드
npm run build
```

## 참조

- [SEMO 레포지토리](https://github.com/semicolon-devteam/semo)
- [Gemini 하이브리드 전략](../../docs/SEMO_ARCHITECTURE_REVIEW.md)

## 라이선스

MIT
