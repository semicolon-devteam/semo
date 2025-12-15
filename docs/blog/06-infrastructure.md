# 6편: 인프라 혁신 - 팀 공용 토큰과 원클릭 설치

> 시리즈: AI와 함께 일하는 법을 만들다 (6/7)

---

## 프롤로그: "Slack 토큰 어떻게 설정해요?"

2024년 12월, 새로운 팀원 온보딩.

"SEMO 설치했는데, Slack 알림이 안 돼요."
"SLACK_BOT_TOKEN 환경변수를 설정하셔야 해요."
"토큰은 어디서 받나요?"
"Slack 앱 설정에서... (10분간의 설명)"

매번 반복되는 이 과정. 한 명 온보딩에 30분씩 걸렸다.

> **"설치만 하면 바로 쓸 수 있게 못 하나?"**

---

## 문제: 토큰 설정의 마찰

### 온보딩 흐름 (Before)

```
1. SEMO 설치 (5분)
   npx @team-semicolon/semo-cli init

2. Slack 앱 생성 (10분)
   - Slack API 사이트 접속
   - 앱 생성
   - Bot Token 발급
   - 채널 권한 설정

3. 환경변수 설정 (5분)
   export SEMO_SLACK_BOT_TOKEN=xoxb-xxx

4. 테스트 (5분)
   /SEMO:slack 테스트 메시지

총 25분 (+ 문제 발생 시 디버깅)
```

### 마찰 포인트

1. **토큰 발급 복잡성**: Slack 앱 생성, 권한 설정...
2. **환경변수 관리**: 각 개발자가 각자 설정
3. **보안 우려**: 토큰이 .env 파일에 노출
4. **일관성 부재**: 누구는 되고, 누구는 안 되고

---

## 해결책: 팀 공용 토큰 자동 주입

### 핵심 아이디어

> **팀에서 한 번 설정하면, 모든 팀원이 자동으로 사용.**

```
팀 관리자: Slack 앱 생성, 토큰 발급 (1회)
    ↓
CI/CD: 토큰 암호화 → npm 패키지에 내장
    ↓
팀원: SEMO 설치만 하면 끝!
```

### 기술적 구현

**Step 1: CI/CD에서 토큰 암호화**

```javascript
// scripts/generate-tokens.js
const crypto = require('crypto');
const TEAM_TOKEN_KEY = "semo-team-token-key-2024-secure";

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(TEAM_TOKEN_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

// GitHub Secrets에서 토큰 읽어서 암호화
const slackToken = process.env.SEMO_SLACK_BOT_TOKEN;
const encryptedToken = encrypt(slackToken);

// tokens.generated.ts 파일 생성
fs.writeFileSync('src/tokens.generated.ts', `
export const ENCRYPTED_TOKENS = {
  SLACK_BOT_TOKEN: "${encryptedToken}",
};
`);
```

**Step 2: 패키지에 암호화된 토큰 내장**

```typescript
// src/tokens.generated.ts (빌드 시 생성)
export const ENCRYPTED_TOKENS = {
  SLACK_BOT_TOKEN: "abc123...:def456...",  // 암호화됨
};
```

**Step 3: 런타임에 복호화**

```typescript
// src/crypto.ts
const TEAM_TOKEN_KEY = "semo-team-token-key-2024-secure";

export function decrypt(encryptedText: string): string {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(TEAM_TOKEN_KEY.padEnd(32, '0').slice(0, 32));
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 보안 수준: 난독화

> **중요**: 이건 "완벽한 암호화"가 아니라 "난독화"다.

```
보안 레벨:
├── 평문 저장 (위험)
├── Base64 인코딩 (매우 약함)
├── 고정 키 암호화 (난독화) ← 우리의 선택
├── 환경변수 키 암호화 (강함)
└── HSM/KMS (매우 강함)
```

**왜 난독화를 선택했나?**

1. **목적**: 팀 내부 사용, 외부 노출 방지
2. **위협 모델**: 의도치 않은 노출 방지 (Git에 커밋 등)
3. **사용 편의성**: 환경변수 설정 불필요

악의적 공격자가 패키지를 분석하면 키를 알아낼 수 있다. 하지만:
- 팀 내부 Slack 채널 접근이 목적
- 개인 정보가 아닌 알림 기능
- 토큰 로테이션으로 위험 완화

---

## MCP (Model Context Protocol) 통합

토큰만 해결되면 끝? 아니다. Claude Code와의 통합도 필요했다.

### MCP Server란?

Claude Code는 **MCP (Model Context Protocol)**를 통해 외부 도구와 통합된다.

```
Claude Code ←→ MCP Server ←→ 외부 서비스
                            (Slack, GitHub, DB...)
```

### semo-mcp 패키지

```typescript
// packages/mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({
  name: 'semo-mcp',
  version: '2.1.0',
});

// Slack 도구 등록
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'semo_slack_notify') {
    const token = decrypt(ENCRYPTED_TOKENS.SLACK_BOT_TOKEN);
    return await sendSlackMessage(token, request.params.arguments);
  }
});
```

### Black Box 설계

```
.claude/
├── CLAUDE.md          (White Box - 사용자가 수정 가능)
├── memory/            (White Box)
└── settings.json      (Black Box - MCP 서버 설정)

설정 분리:
- White Box: 규칙, 컨텍스트 (사용자 제어)
- Black Box: 토큰, 시크릿 (시스템 제어)
```

---

## CI/CD 파이프라인

### GitHub Actions 워크플로우

```yaml
# .github/workflows/publish-mcp.yml
name: Publish semo-mcp

on:
  push:
    tags:
      - 'mcp-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Generate encrypted tokens
        env:
          SEMO_SLACK_BOT_TOKEN: ${{ secrets.SEMO_SLACK_BOT_TOKEN }}
        run: node scripts/generate-tokens.js

      - name: Build
        run: npm run build

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
```

```mermaid
flowchart TB
    subgraph GitHub["GitHub"]
        TAG[Tag Push<br/>mcp-v2.x.x]
        SECRETS[Secrets<br/>SEMO_SLACK_BOT_TOKEN<br/>NPM_TOKEN]
    end

    subgraph Actions["GitHub Actions"]
        TRIGGER[워크플로우 트리거]
        ENCRYPT[토큰 암호화<br/>generate-tokens.js]
        BUILD[빌드<br/>tsc]
        PUBLISH[npm publish]
        RELEASE[Release 생성]
    end

    subgraph NPM["npm Registry"]
        PACKAGE[@team-semicolon/semo-mcp<br/>암호화된 토큰 내장]
    end

    subgraph User["사용자 환경"]
        INSTALL[npx semo-mcp]
        DECRYPT[자동 복호화]
        USE[Slack 알림 사용<br/>환경변수 설정 불필요!]
    end

    TAG --> TRIGGER
    SECRETS --> ENCRYPT
    TRIGGER --> ENCRYPT
    ENCRYPT --> BUILD
    BUILD --> PUBLISH
    PUBLISH --> RELEASE
    PUBLISH --> PACKAGE
    PACKAGE --> INSTALL
    INSTALL --> DECRYPT
    DECRYPT --> USE
```

### 배포 프로세스

```bash
# 1. 버전 업데이트
cd packages/mcp-server
npm version patch  # 2.1.0 → 2.1.1

# 2. 태그 생성 및 푸시
git tag mcp-v2.1.1
git push origin mcp-v2.1.1

# 3. GitHub Actions 자동 실행
# - 토큰 암호화
# - 빌드
# - npm 배포
# - GitHub Release 생성

# 4. 사용자는 자동 업데이트
# (settings.json에 @latest 지정)
```

---

## 30초 설치 체험

### 설치

```bash
# SEMO CLI로 초기화
npx @team-semicolon/semo-cli init

# 생성되는 파일
.claude/
├── CLAUDE.md
├── settings.json      # MCP 서버 자동 설정
└── memory/
    ├── context.md
    └── decisions.md
```

### settings.json 내용

```json
{
  "mcpServers": {
    "semo-mcp": {
      "command": "npx",
      "args": ["@team-semicolon/semo-mcp@latest"]
    }
  }
}
```

### 바로 사용

```markdown
# Claude Code 재시작 후
사용자: /SEMO:slack 배포 완료 알림을 보내줘

[SEMO] Integration: slack/notify
       채널: #dev-notifications
       메시지: "배포 완료"

✅ 메시지 전송 성공

# 환경변수 설정? 필요 없음!
```

---

## Try it yourself: 팀 공용 Slack 알림 사용하기

```bash
# 1. SEMO 설치 (아직 안 했다면)
npx @team-semicolon/semo-cli init

# 2. Claude Code 재시작

# 3. Slack 알림 테스트
/SEMO:slack 테스트 메시지입니다

# 결과:
[SEMO] Integration: slack/notify 완료
✅ 메시지 전송 성공
```

환경변수 설정 없이 바로 동작한다!

### 커스텀 채널 지정

```markdown
사용자: /SEMO:slack #project-a 에 배포 완료 알림 보내줘

[SEMO] Integration: slack/notify
       채널: #project-a
       메시지: "배포 완료"

✅ 메시지 전송 성공
```

---

## 의사결정 포인트

### Why: 온보딩 마찰 최소화

- 새 팀원이 합류할 때마다 30분 소요
- 토큰 관리가 분산되어 있어 혼란
- "설치만 하면 바로 사용" 경험 필요

### Decision: 팀 토큰은 패키지에 내장, 개인 토큰만 설정

- 팀 공용 서비스 (Slack, 공용 GitHub): 패키지 내장
- 개인 서비스 (개인 API 키): 환경변수 설정

### Trade-off: 완벽한 보안 vs 사용 편의성

**얻은 것**
- 30초 온보딩 (30분 → 30초)
- 일관된 사용 경험
- 중앙 집중 토큰 관리

**잃은 것**
- 난독화 수준의 보안 (완벽하지 않음)
- 패키지에 민감 정보 포함
- 토큰 로테이션 시 재배포 필요

**완화책**
- 팀 내부 사용 한정
- 정기적 토큰 로테이션
- 개인 정보 미포함 (알림 기능만)

---

## 다음 편 예고

인프라는 완성됐다. 하지만 더 야심찬 목표가 있다.

세션이 끝나도 AI가 이전 대화를 기억하면? 프로젝트 컨텍스트를 유지하면? 팀의 의사결정 기록을 학습하면?

**7편: AI 에이전트가 기억하는 세상**에서 계속됩니다.

---

*이전 편: [역할 기반에서 기능 기반으로](./05-architecture-shift.md)*
*다음 편: [AI 에이전트가 기억하는 세상](./07-future-memory.md)*
