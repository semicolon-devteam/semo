# Token Management

> SEMO 토큰 계층화 및 자동 주입 시스템

## Overview

SEMO는 **팀 공용 토큰**과 **개인 토큰**을 분리하여 관리합니다.

```
┌─────────────────────────────────────────────────────────────┐
│  Token Hierarchy                                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Team Shared (팀 공용) - 자동 주입                 │
│  ├── SEMO_SLACK_BOT_TOKEN (Semicolon Notifier)              │
│  └── SEMO_GITHUB_APP_TOKEN (Team Bot)                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Personal (개인) - Onboarding 시 설정              │
│  ├── GITHUB_PERSONAL_ACCESS_TOKEN                           │
│  └── 기타 개인 서비스 토큰                                   │
└─────────────────────────────────────────────────────────────┘
```

## Token Types

### 1. Team Shared Tokens (자동 주입)

팀 공용 토큰은 **SEMO CLI 설치 시 자동으로 주입**됩니다.

| 환경변수 | 용도 | 소스 |
|----------|------|------|
| `SEMO_SLACK_BOT_TOKEN` | Semicolon Notifier 봇 | semo-mcp 패키지 내장 |
| `SEMO_GITHUB_APP_TOKEN` | 팀 GitHub 작업 | semo-mcp 패키지 내장 |

**특징**:
- 사용자가 직접 설정할 필요 없음
- `semo-mcp` 패키지에 암호화되어 내장
- 런타임에 복호화하여 사용

### 2. Personal Tokens (Onboarding 설정)

개인 토큰은 **Onboarding Phase 1.5**에서 설정합니다.

| 환경변수 | 용도 | 필수 |
|----------|------|------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | 개인 GitHub 작업 | ✅ |
| `SLACK_USER_TOKEN` | 개인 Slack 작업 | ❌ |

## Implementation

### settings.json 구조

```json
{
  "mcpServers": {
    "semo-integrations": {
      "command": "npx",
      "args": ["-y", "@team-semicolon/semo-mcp"],
      "env": {
        "// Team Shared (auto-injected by semo-mcp)": "",
        "SEMO_SLACK_BOT_TOKEN": "auto",
        "SEMO_GITHUB_APP_TOKEN": "auto",

        "// Personal (set by user)": "",
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

### semo-mcp 내부 동작

```typescript
// semo-mcp 패키지 내부 (pseudo-code)
const TEAM_TOKENS = {
  SEMO_SLACK_BOT_TOKEN: decrypt(ENCRYPTED_SLACK_TOKEN),
  SEMO_GITHUB_APP_TOKEN: decrypt(ENCRYPTED_GITHUB_TOKEN),
};

// MCP 서버 시작 시 자동 주입
function getToken(name: string): string {
  // 1. 팀 공용 토큰 확인
  if (TEAM_TOKENS[name]) {
    return TEAM_TOKENS[name];
  }

  // 2. 환경변수에서 개인 토큰 확인
  return process.env[name] || '';
}
```

## Onboarding Integration

### Phase 1.5: 토큰 설정 (신규)

```markdown
[SEMO] Onboarding: Phase 1.5 - 토큰 설정

## 토큰 설정 안내

### 자동 설정 완료 (팀 공용)
| 토큰 | 상태 |
|------|------|
| Semicolon Notifier | ✅ 자동 설정됨 |
| Team GitHub Bot | ✅ 자동 설정됨 |

### 개인 토큰 설정 필요
| 토큰 | 용도 | 필수 |
|------|------|------|
| GitHub PAT | 개인 저장소 접근 | ✅ |

**GitHub PAT 생성 방법**:
1. https://github.com/settings/tokens 접속
2. "Generate new token (classic)" 클릭
3. 권한 선택: `repo`, `read:org`
4. 토큰 생성 후 복사

**설정 방법**:
```bash
# 방법 1: 환경변수 (권장)
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_xxxx"

# 방법 2: .claude/settings.local.json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxx"
  }
}
```
```

## Security

### 팀 공용 토큰 보안

1. **암호화 저장**: semo-mcp 패키지에 AES-256 암호화
2. **런타임 복호화**: 메모리에서만 복호화, 파일 미저장
3. **권한 제한**: 최소 필요 권한만 부여
4. **정기 갱신**: 분기별 토큰 갱신

### 개인 토큰 보안

1. **환경변수 사용**: 파일에 직접 저장 금지
2. **.gitignore**: `settings.local.json` 커밋 제외
3. **권한 최소화**: 필요한 scope만 선택

## Fallback

토큰 미설정 시 동작:

| 기능 | 팀 토큰 | 개인 토큰 | 결과 |
|------|--------|----------|------|
| `/SEMO:slack` | ✅ | - | 정상 작동 |
| GitHub PR 생성 | - | ❌ | 에러 + 설정 안내 |
| 팀 저장소 읽기 | ✅ | - | 정상 작동 |
| 개인 저장소 쓰기 | - | ❌ | 에러 + 설정 안내 |

## Migration

기존 하드코딩된 토큰에서 마이그레이션:

```bash
# 1. 기존 slack-config.md에서 토큰 제거
# 2. semo-mcp 최신 버전 사용
npx @team-semicolon/semo-mcp@latest

# 3. 자동 주입 확인
# semo-mcp가 팀 토큰을 자동으로 제공
```

## Related

- [Onboarding Command](../commands/SEMO/onboarding.md)
- [Settings Structure](../templates/settings.md)
