# SEMO 보안 감사 보고서

> 생성일: 2025-12-11
> 감사 범위: SEMO 패키지 전체 (semo-core, semo-meta, sax-*)

---

## Executive Summary

### 발견된 보안 이슈

| 심각도 | 이슈 | 위치 | 상태 |
|--------|------|------|------|
| **HIGH** | Slack Bot Token 하드코딩 | `notify-slack/SKILL.md` | 🔴 수정 필요 |
| **MEDIUM** | 중앙 집중식 비밀 관리 부재 | 전체 | 🟡 Doppler 도입 권장 |
| **LOW** | .env 파일 사용 가이드 부재 | docs | 🟢 문서화 필요 |

### 권장 조치

1. **즉시**: Slack Bot Token 로테이션 + 환경 변수 전환
2. **단기**: Doppler MCP 통합
3. **중기**: 전체 비밀 관리 정책 수립

---

## 발견 사항

### 1. Slack Bot Token 하드코딩 (HIGH)

**위치**:
- `.claude/semo-core/skills/notify-slack/SKILL.md`
- `.claude/semo-core/_shared/slack-config.md`

**현재 상태**:
```markdown
SLACK_BOT_TOKEN=xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7
```

**위험**:
- Git 히스토리에 토큰 노출
- 공개 레포 전환 시 즉시 탈취 가능
- 토큰 로테이션 시 여러 파일 수정 필요

**권장 조치**:
1. 기존 토큰 즉시 로테이션 (Slack 앱 설정)
2. 환경 변수 또는 Doppler로 전환
3. Git 히스토리 정리 (선택적)

### 2. 중앙 집중식 비밀 관리 부재 (MEDIUM)

**현재 상태**:
- 비밀 정보가 여러 파일에 분산
- 환경별 비밀 관리 미정의
- 로테이션 절차 미수립

**권장 조치**:
- Doppler 도입으로 중앙화
- 환경별 구성 분리 (dev/staging/prod)
- 자동 로테이션 정책 수립

### 3. 민감 정보 검색 결과

**검색 수행**:
```bash
grep -rn "xoxb-\|xoxp-\|ghp_\|gho_\|github_pat_\|sk-\|AKIA" .
```

**발견된 패턴**:

| 패턴 | 파일 | 유형 |
|------|------|------|
| `xoxb-*` | notify-slack/SKILL.md | Slack Bot Token |
| `xoxb-*` | _shared/slack-config.md | Slack Bot Token |

> GitHub Token, OpenAI API Key 등은 발견되지 않음

---

## Doppler 통합 계획

### MCP 설정 추가

`~/.claude.json`에 추가:

```json
{
  "mcpServers": {
    "doppler": {
      "command": "npx",
      "args": ["-y", "@doppler/mcp-server"],
      "env": {
        "DOPPLER_TOKEN": "${DOPPLER_TOKEN}"
      }
    }
  }
}
```

### Doppler 프로젝트 구조 (권장)

```
semicolon/
├── sax/                  # Doppler Project
│   ├── dev/              # Development Config
│   │   ├── SLACK_BOT_TOKEN
│   │   └── GITHUB_TOKEN
│   ├── staging/          # Staging Config
│   └── prod/             # Production Config
```

### 마이그레이션 단계

1. **Doppler 프로젝트 생성**
   ```bash
   doppler projects create sax
   doppler configs create sax dev
   ```

2. **비밀 등록**
   ```bash
   doppler secrets set SLACK_BOT_TOKEN="xoxb-new-rotated-token"
   doppler secrets set SLACK_CHANNEL_COLLAB="C09KNL91QBZ"
   ```

3. **Skill 코드 수정**
   ```bash
   # 환경 변수에서 읽기
   SLACK_TOKEN=$(doppler secrets get SLACK_BOT_TOKEN --plain)
   ```

---

## 비밀 관리 정책 (권장)

### 비밀 유형별 관리

| 유형 | 저장소 | 접근 방식 |
|------|--------|----------|
| API Token | Doppler | MCP 또는 CLI |
| 개인 토큰 | 환경 변수 | 로컬 설정 |
| 공유 비밀 | Doppler | 팀 공유 |

### 로테이션 정책

| 비밀 유형 | 주기 | 담당 |
|----------|------|------|
| Slack Bot Token | 분기별 | DevOps |
| GitHub Token | 월별 | 개인 |
| API Keys | 연별 | DevOps |

### 감사 로그

- Doppler 접근 로그 활성화
- 비정상 접근 알림 설정

---

## 즉시 조치 항목

### 1. Slack Token 로테이션

```bash
# 1. Slack 앱 설정에서 토큰 재생성
# 2. 새 토큰을 환경 변수로 설정
export SLACK_BOT_TOKEN="xoxb-new-token"

# 3. 테스트
curl -s -X POST 'https://slack.com/api/auth.test' \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"
```

### 2. notify-slack Skill 수정

**Before**:
```bash
curl ... -H 'Authorization: Bearer xoxb-hardcoded-token'
```

**After**:
```bash
curl ... -H "Authorization: Bearer $SLACK_BOT_TOKEN"
```

### 3. 문서 업데이트

- `notify-slack/SKILL.md`에서 하드코딩된 토큰 제거
- 환경 변수 사용 가이드 추가

---

## Checklist

### Phase 1.5 완료 기준

- [ ] Slack Token 로테이션 완료
- [ ] notify-slack 환경 변수 전환
- [ ] Doppler MCP 설정 가이드 추가
- [ ] 보안 감사 문서 생성 ✅
- [ ] feedback Skill GitHub Token 검토

---

## References

- [Doppler Documentation](https://docs.doppler.com/)
- [Slack Token Rotation](https://api.slack.com/authentication/rotation)
- [MCP 설정 가이드](../_shared/mcp-config.md)
