# @semicolon/semo-mcp

> SEMO MCP Server - Claude Code에서 AI Agent 오케스트레이션

## 설치

```bash
npx @semicolon/semo-mcp
```

## Claude Code 설정

`.claude/mcp.json` 파일 생성:

```json
{
  "mcpServers": {
    "semo": {
      "command": "npx",
      "args": ["-y", "@semicolon/semo-mcp"]
    }
  }
}
```

## 사용 가능한 도구

### semo_route

요청을 분석하여 적절한 Agent/Skill로 라우팅합니다.

```
사용 예: "[next] API 버그 수정해줘"
```

### semo_slack

Slack 채널에 메시지를 전송합니다.

```
채널: #_협업
메시지: 배포 완료
```

### semo_feedback

SEMO에 대한 피드백을 제출합니다.

```
유형: bug | feature | improvement
제목: 피드백 제목
설명: 상세 설명
```

## 리소스

| URI | 설명 |
|-----|------|
| `semo://agents` | 사용 가능한 Agent 목록 |
| `semo://skills` | 사용 가능한 Skill 목록 |
| `semo://commands` | 사용 가능한 커맨드 목록 |

## 환경변수

| 변수 | 설명 |
|------|------|
| `SLACK_WEBHOOK_URL` | Slack 웹훅 URL (semo_slack용) |
| `GITHUB_TOKEN` | GitHub 토큰 (semo_feedback용) |

## 개발

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 빌드
npm run build
```

## 라이선스

MIT
