# Environment Setup

> onboarding-master Agent 환경 설정 가이드

## 글로벌 MCP 설정 확인

health-check에서 글로벌 MCP 설정이 누락된 경우, 다음 설정을 안내합니다:

```bash
# ~/.claude.json에 mcpServers 추가
jq '. + {
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}' ~/.claude.json > ~/.claude.json.tmp && mv ~/.claude.json.tmp ~/.claude.json
```

## 필수 MCP 서버

- `context7`: 라이브러리 문서 조회
- `sequential-thinking`: 구조적 사고 분석

## 환경 진단 (Phase 0)

health-check Skill이 다음 항목을 검증합니다:

### 필수 도구

| 도구 | 용도 | 확인 명령어 |
|------|------|-------------|
| Node.js | JavaScript 런타임 | `node -v` |
| npm | 패키지 매니저 | `npm -v` |
| Git | 버전 관리 | `git --version` |
| gh | GitHub CLI | `gh --version` |
| Claude Code | AI 개발 도구 | `claude --version` |

### 선택 도구

| 도구 | 용도 | 확인 명령어 |
|------|------|-------------|
| pnpm | 빠른 패키지 매니저 | `pnpm -v` |
| Docker | 컨테이너화 | `docker --version` |

## GitHub 인증 설정

```bash
# GitHub CLI 인증
gh auth login

# 인증 상태 확인
gh auth status

# Organization 접근 확인
gh api user/orgs --jq '.[].login' | grep semicolon-devteam
```

## 프로젝트 환경 설정

### 1. 레포지토리 클론

```bash
gh repo clone semicolon-devteam/{project-name}
cd {project-name}
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

```bash
# .env.local 생성
cp .env.example .env.local

# 필요한 환경 변수 설정
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 4. Claude 설정 확인

```bash
# .claude/ 디렉토리 확인
ls -la .claude/

# SEMO 패키지 확인
ls -la .claude/semo-core/
ls -la .claude/semo-next/
```

## 환경 문제 해결

### Node.js 버전 불일치

```bash
# nvm 사용 시
nvm install 18
nvm use 18

# 또는 asdf 사용 시
asdf install nodejs 18.17.0
asdf local nodejs 18.17.0
```

### GitHub 인증 실패

```bash
# 토큰 재생성
gh auth login --web

# 기존 인증 제거 후 재인증
gh auth logout
gh auth login
```

### MCP 서버 연결 실패

```bash
# MCP 서버 수동 테스트
npx -y @upstash/context7-mcp

# 캐시 정리 후 재시도
npm cache clean --force
```
