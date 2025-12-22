# 토큰 관리 가이드

> SEMO 패키지의 API 토큰 관리 방법

## 핵심 원칙

> **GitHub는 gh CLI 인증을 사용하고, 다른 서비스는 중앙 문서에서 관리합니다.**

## 토큰별 관리 방법

### 1. GitHub Token

> **🟢 gh CLI 인증 사용 (권장)**

MCP 서버의 환경변수 인식 문제로 인해 `gh` CLI를 기본으로 사용합니다.

```bash
# 한 번만 인증하면 됨
gh auth login

# 인증 상태 확인
gh auth status
```

**장점:**
- 별도 토큰 설정 불필요
- VS Code 재시작 후에도 유지
- 모든 gh 명령어에서 자동 사용

**MCP 설정 (선택사항):**
```json
"env": {
  "GITHUB_TOKEN": "${GITHUB_TOKEN}"
}
```
> ⚠️ 환경변수가 제대로 전달되지 않는 경우가 있어 gh CLI 권장

### 2. Slack Token

> **📄 중앙 문서에서 관리**

📖 **참조**: [slack-config.md](slack-config.md)

```text
SLACK_BOT_TOKEN=xoxb-xxx...
```

**토큰 갱신 절차:**
1. Slack App 설정에서 새 토큰 생성
2. `slack-config.md` 업데이트
3. semo-core 버저닝 (PATCH)

### 3. Supabase Token

> **📁 프로젝트별 설정**

각 프로젝트의 `.env` 또는 `settings.json`에서 관리:

```bash
# .env 파일
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
```

## 우선순위 정리

| 서비스 | 관리 방법 | 위치 |
|--------|----------|------|
| GitHub | gh CLI 인증 | 로컬 (`gh auth login`) |
| Slack | 중앙 문서 | `semo-core/_shared/slack-config.md` |
| Supabase | 프로젝트별 | 각 프로젝트 `.env` |

## MCP vs CLI 선택 가이드

| 작업 | 권장 방법 | 이유 |
|------|----------|------|
| GitHub 이슈/PR | `gh` CLI | 안정적인 인증, 환경변수 문제 없음 |
| Slack 알림 | `curl` + Bot Token | MCP 미지원, 직접 API 호출 |
| Supabase 조회 | MCP 또는 직접 API | 상황에 따라 선택 |

## 트러블슈팅

### "Bad credentials" 오류
```bash
# gh CLI 인증 상태 확인
gh auth status

# 재인증
gh auth login --web
```

### MCP 환경변수 미인식
```
# settings.json의 env 블록이 인식되지 않는 경우
→ gh CLI로 대체 사용 (권장)
→ 환경변수를 시스템 레벨에서 설정
```

## Related

- [gh CLI First Policy](../principles/PRINCIPLES.md#6-gh-cli-first-policy)
- [Slack 설정](slack-config.md)
- [팀원 정보](team-members.md)
