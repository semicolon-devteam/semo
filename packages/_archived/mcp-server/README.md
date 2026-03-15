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
npx @team-semicolon/semo-mcp
```

## Claude Code 설정

`.claude/settings.json`:

```json
{
  "mcpServers": {
    "semo-integrations": {
      "command": "npx",
      "args": ["-y", "@team-semicolon/semo-mcp"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_KEY": "${SUPABASE_KEY}"
      }
    }
  }
}
```

> **Note**: Slack Bot Token은 패키지에 암호화되어 포함되어 있어 별도 설정이 필요 없습니다.
> GitHub 연동은 `gh` CLI가 인증되어 있으면 자동으로 동작합니다.

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
| `SUPABASE_URL` | Supabase 프로젝트 URL | Supabase 사용 시 |
| `SUPABASE_KEY` | Supabase 서비스 키 | Supabase 사용 시 |

### 기본 제공 토큰 (설정 불필요)

| 기능 | 토큰 | 상태 |
|------|------|------|
| Slack 알림 | Semicolon Notifier Bot | 암호화 배포 |
| GitHub 연동 | gh CLI 인증 사용 | 자동 |
| SEMO Memory | Core DB 접속 정보 | 암호화 배포 |

> 환경변수를 설정하면 기본 제공 토큰보다 우선 적용됩니다.

## 트러블슈팅

### Windows 환경에서 MCP 도구를 찾을 수 없음 (`No such tool available` 에러)

**증상**:

```text
Error: No such tool available: mcp__semo-integrations__semo_get_slack_token
```

**원인**:

- Windows에서 npx 경로 문제
- VSCode Extension에서 MCP 서버 자동 시작 실패
- settings.json 설정 문제

**해결 방법**:

1. **VSCode/Claude Code 완전 재시작**
   - VSCode 완전 종료 후 재시작
   - 또는 `Developer: Reload Window` 실행

2. **MCP 서버 수동 확인**

   ```bash
   # 터미널에서 MCP 서버 테스트
   npx -y @team-semicolon/semo-mcp

   # 정상이면 다음 출력:
   # [SEMO MCP] Server v3.0.1 started
   ```

3. **settings.json 확인** (`.claude/settings.json`)

   ```json
   {
     "mcpServers": {
       "semo-integrations": {
         "command": "npx",
         "args": ["-y", "@team-semicolon/semo-mcp"]
       }
     }
   }
   ```

4. **Windows 전용: npx 경로 명시**

   ```json
   {
     "mcpServers": {
       "semo-integrations": {
         "command": "npx.cmd",
         "args": ["-y", "@team-semicolon/semo-mcp"]
       }
     }
   }
   ```

5. **npm 캐시 정리**

   ```bash
   npm cache clean --force
   npx -y @team-semicolon/semo-mcp
   ```

### MCP 연결 끊김 (`Not connected` 에러)

장시간 세션 사용 시 MCP 서버 연결이 끊어질 수 있습니다.

**증상**:
- `<error>Not connected</error>` 에러 반환
- Slack, GitHub 등 MCP 도구 사용 불가

**원인**:
- MCP 서버 프로세스가 백그라운드에서 종료됨
- Claude Code 내부 타임아웃 발생

**해결 방법**:
1. **VSCode/Claude Code 재시작** (가장 확실)
2. 명령 팔레트에서 "Developer: Reload Window" 실행
3. MCP 서버 상태 확인: `/mcp` 명령어로 연결 상태 체크

**예방**:
- 장시간 세션 시 주기적으로 MCP 도구 사용하여 연결 유지
- 중요 작업 전 간단한 MCP 호출로 연결 상태 확인

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
