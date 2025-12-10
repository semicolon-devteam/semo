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

### 2. Sequential Thinking MCP (선택)

복잡한 추론 작업 시 단계별 사고를 지원합니다.

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-sequential-thinking"]
    }
  }
}
```

**사용 시나리오**:
- 복잡한 아키텍처 설계
- 다단계 리팩토링
- 버그 근본 원인 분석

### 3. Filesystem MCP (선택)

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

## 전체 설정 예시

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@mkreyman/mcp-memory-keeper"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-sequential-thinking"]
    }
  }
}
```

## SAX Memory Skill 연동

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
