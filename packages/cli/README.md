# @team-semicolon/semo-cli

> SEMO CLI - AI Agent Orchestration Framework Installer

## 개요

Gemini의 하이브리드 전략에 따라 SEMO를 자동 설치하는 CLI 도구입니다.

```bash
npx @team-semicolon/semo-cli init
```

## 동작 방식

`semo init` 명령어는 다음을 자동으로 수행합니다:

### 1. White Box 설정 (Git Subtree)

에이전트가 **읽고 학습**해야 하는 지식 베이스:

```
semo-system/
├── semo-core/         # Layer 0: 원칙, 오케스트레이션
└── semo-skills/       # Layer 1: coder, tester, planner
```

### 2. Black Box 설정 (MCP Server)

토큰이 격리된 **외부 연동 도구**:

```json
// .claude/settings.json
{
  "mcpServers": {
    "semo-integrations": {
      "command": "npx",
      "args": ["-y", "@team-semicolon/semo-mcp"]
    }
  }
}
```

### 3. Context Mesh 초기화

세션 간 **컨텍스트 영속화**:

```
.claude/memory/
├── context.md         # 프로젝트 상태
├── decisions.md       # 아키텍처 결정
└── rules/             # 프로젝트별 규칙
```

## 명령어

### init

현재 프로젝트에 SEMO를 설치합니다.

```bash
semo init              # 기본 설치
semo init --force      # 기존 설정 덮어쓰기
semo init --skip-mcp   # MCP 설정 생략
semo init --skip-subtree  # Git Subtree 생략
```

### status

SEMO 설치 상태를 확인합니다.

```bash
semo status
```

### update

SEMO를 최신 버전으로 업데이트합니다.

```bash
semo update
```

## 설치 후 구조

```
your-project/
├── .claude/
│   ├── CLAUDE.md          # 프로젝트 설정
│   ├── settings.json      # MCP 서버 설정
│   ├── memory/            # Context Mesh
│   ├── agents → semo-system/semo-core/agents
│   └── skills → semo-system/semo-skills
│
└── semo-system/           # White Box (읽기 전용)
    ├── semo-core/
    └── semo-skills/
```

## 환경변수

MCP 연동을 위해 다음 환경변수를 설정하세요:

| 변수 | 설명 |
|------|------|
| `GITHUB_TOKEN` | GitHub API 토큰 |
| `SLACK_BOT_TOKEN` | Slack Bot 토큰 |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_KEY` | Supabase 서비스 키 |

## 참조

- [SEMO 레포지토리](https://github.com/semicolon-devteam/semo)
- [SEMO MCP Server](../mcp-server/README.md)
- [Gemini 하이브리드 전략](../../docs/SEMO_ARCHITECTURE_REVIEW.md)

## 라이선스

MIT
