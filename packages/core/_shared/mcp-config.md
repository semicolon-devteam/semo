# MCP 서버 설정 가이드

> Claude Code에서 사용하는 MCP(Model Context Protocol) 서버 설정

## 설정 파일 위치

```text
~/.claude.json
```

## 권장 MCP 서버

### 1. Memory MCP (필수 권장)

세션 간 컨텍스트 영속화를 위한 메모리 서버입니다.

#### 옵션 A: mcp-memory-keeper (권장)

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@mkreyman/mcp-memory-keeper"]
    }
  }
}
```

**특징**:
- 파일 기반 영속화
- 간단한 key-value 저장
- 세션 간 데이터 유지

#### 옵션 B: mcp-memory (고급)

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-memory"],
      "env": {
        "MEMORY_FILE": "~/.claude/memory.json"
      }
    }
  }
}
```

### 2. Sequential Thinking MCP (권장)

복잡한 추론 작업 시 단계별 사고를 지원합니다. Claude의 "생각의 흐름"을 구조화하여 더 정확한 결과를 도출합니다.

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

**핵심 기능**:
- 복잡한 문제를 단계별로 분해
- 각 단계의 사고 과정을 명시적으로 기록
- 이전 단계 결과를 다음 단계에 반영
- 사고 과정 수정 및 분기 지원

**SEMO에서 활용 시나리오**:

| 시나리오 | 설명 | 트리거 |
|----------|------|--------|
| 아키텍처 설계 | Epic 기반 시스템 설계 | "아키텍처 설계해줘" |
| 버그 분석 | 근본 원인 추적 | "버그 원인 분석해줘" |
| 리팩토링 계획 | 다단계 코드 개선 | "리팩토링 계획 세워줘" |
| 복잡한 기능 구현 | 단계별 구현 전략 | 복잡한 요구사항 |

**동작 원리**:

```text
사용자: "인증 시스템 아키텍처 설계해줘"
    ↓
[Sequential Thinking 활성화]
    ↓
Step 1: 요구사항 분석
  - 인증 방식 (JWT, Session, OAuth)
  - 보안 요구사항
  - 확장성 고려
    ↓
Step 2: 컴포넌트 설계
  - Auth Service
  - Token Manager
  - User Repository
    ↓
Step 3: 흐름 설계
  - 로그인 플로우
  - 토큰 갱신 플로우
  - 로그아웃 플로우
    ↓
Step 4: 구현 계획
  - 파일 구조
  - API 엔드포인트
  - 테스트 전략
    ↓
[최종 결과 출력]
```

**자동 활성화 조건**:

SEMO는 다음 조건에서 Sequential Thinking을 자동으로 활용합니다:
- 요청이 3단계 이상의 분석 필요 시
- "설계", "분석", "계획" 키워드 포함 시
- 복잡한 아키텍처 관련 요청 시

### 3. Doppler MCP (보안 권장)

비밀 관리를 위한 Doppler MCP 서버입니다. API 토큰, 비밀 키 등을 중앙에서 관리합니다.

```json
{
  "mcpServers": {
    "doppler": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-doppler"],
      "env": {
        "DOPPLER_TOKEN": "${DOPPLER_TOKEN}"
      }
    }
  }
}
```

**특징**:
- 중앙 집중식 비밀 관리
- 환경별 구성 분리 (dev/staging/prod)
- 접근 로그 및 감사
- 자동 로테이션 지원

**SEMO 비밀 관리**:

| 비밀 | 용도 | Doppler 경로 |
|------|------|--------------|
| `SLACK_BOT_TOKEN` | Slack 알림 | `sax/dev/SLACK_BOT_TOKEN` |
| `GITHUB_TOKEN` | GitHub API | `sax/dev/GITHUB_TOKEN` |
| `ANTHROPIC_API_KEY` | Promptfoo 평가 | `sax/dev/ANTHROPIC_API_KEY` |

**사용 방법**:

```bash
# Doppler CLI로 비밀 조회
doppler secrets get SLACK_BOT_TOKEN --plain

# Skill에서 환경 변수로 사용
SLACK_TOKEN=$SLACK_BOT_TOKEN curl -s -X POST ...
```

> 📖 상세: [security/SECURITY_AUDIT.md](../security/SECURITY_AUDIT.md)

### 4. Filesystem MCP (선택)

파일 시스템 접근을 위한 MCP 서버입니다.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/Users/username/projects"
      }
    }
  }
}
```

## 전체 설정 예시 (SEMO 권장)

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@mkreyman/mcp-memory-keeper"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "doppler": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-doppler"],
      "env": {
        "DOPPLER_TOKEN": "${DOPPLER_TOKEN}"
      }
    }
  }
}
```

> **💡 권장**: Memory + Sequential Thinking + Doppler 조합으로 SEMO의 핵심 기능을 최대한 활용할 수 있습니다.

## SEMO Memory Skill 연동

Memory MCP가 설치되면 `skill:memory`가 자동으로 MCP를 우선 사용합니다:

```text
skill:memory save decision "api-pattern" "JSON Envelope"
    ↓
1. MCP 서버 확인
2. MCP 있으면 → MCP에 저장
3. MCP 없으면 → .claude/memory/ 파일에 저장
```

### 우선순위

| 순위 | 저장소 | 조건 |
|------|--------|------|
| 1 | Memory MCP | MCP 서버 활성화 시 |
| 2 | .claude/memory/ | MCP 없을 때 (폴백) |

## 설치 확인

```bash
# MCP 서버 설정 확인
cat ~/.claude.json | jq '.mcpServers'

# Memory MCP 테스트
npx -y @mkreyman/mcp-memory-keeper --version

# Sequential Thinking MCP 테스트
npx -y @modelcontextprotocol/server-sequential-thinking --version
```

## 문제 해결

### MCP 서버가 시작되지 않는 경우

```bash
# Node.js 버전 확인 (18+ 필요)
node --version

# npx 캐시 정리
npx clear-npx-cache

# 수동 설치 테스트
npx -y @mkreyman/mcp-memory-keeper
```

### 메모리가 저장되지 않는 경우

1. `~/.claude.json` 파일 권한 확인
2. MCP 서버 로그 확인
3. `skill:memory` 폴백(파일 기반) 동작 확인

## References

- [MCP 공식 문서](https://modelcontextprotocol.io/)
- [skill:memory SKILL.md](../skills/memory/SKILL.md)
