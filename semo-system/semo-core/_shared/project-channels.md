# 프로젝트별 Slack 채널 동적 조회

> 프로젝트/레포지토리별 Slack 알림 채널을 동적으로 조회합니다.

## 🔴 동적 채널 조회 (기본 방식)

> **하드코딩된 매핑 테이블 대신 Slack API를 통해 채널을 동적으로 조회합니다.**

### 채널 매칭 로직

```text
레포지토리명: {repo}
    ↓
1차 시도: #{repo} (레포명 그대로)
    예: cm-labor-union → #cm-labor-union
    ↓
2차 시도: #_{repo} (언더스코어 접두사)
    예: cm-labor-union → #_cm-labor-union
    ↓
Fallback: #_협업 (채널 없을 경우)
```

### MCP 도구를 사용한 채널 전송

```bash
# 방법 1: 레포명으로 직접 채널 전송 시도
mcp__semo-integrations__slack_send_message(
  channel: "#cm-labor-union",  # 레포명으로 채널 시도
  text: "메시지 내용"
)
# 성공 → 해당 채널 사용
# 실패 (channel_not_found) → Fallback 시도

# 방법 2: Fallback으로 기본 채널 전송
mcp__semo-integrations__slack_send_message(
  channel: "#_협업",
  text: "[Fallback: #cm-labor-union 채널 미발견]\n메시지 내용"
)
```

## 기본 채널

```yaml
default_channel: "#_협업"
default_channel_id: "C09KNL91QBZ"
```

## 채널 Fallback 규칙

```text
프로젝트 채널 전송 시도
    │
    ├─ #{repo} 시도
    │   ├─ 성공 → 완료
    │   └─ 실패 → 다음 시도
    │
    ├─ #_{repo} 시도
    │   ├─ 성공 → 완료
    │   └─ 실패 → Fallback
    │
    └─ 기본 채널 (#_협업)으로 전송
        └─ 메시지에 원래 채널명 표시
```

## 참고: 알려진 프로젝트 채널

> 아래는 참고용 목록입니다. 실제 전송 시에는 동적 조회를 사용합니다.

| 프로젝트 | 레포지토리 | 예상 채널 | 비고 |
|---------|-----------|----------|------|
| MVP Link Collect | mvp-link-collect | #mvp-link-collect | - |
| CM Land | cm-land | #cm-land | 커뮤니티 랜드 |
| CM Office | cm-office | #cm-office | 커뮤니티 오피스 |
| CM Labor Union | cm-labor-union | #cm-labor-union | 노조 프로젝트 |
| Core Backend | core-backend | #_협업 (Fallback) | 전용 채널 없음 |
| SEMO | semo | #_협업 (Fallback) | 전용 채널 없음 |

## 새 프로젝트 채널 생성 시

1. Slack에서 `#{repo}` 형식으로 채널 생성
2. Slack 앱(SEMO Bot)을 해당 채널에 초대
3. 자동으로 동적 조회됨 (별도 설정 불필요)

```bash
# 채널 ID 조회 (필요한 경우)
curl -X GET "https://slack.com/api/conversations.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | \
  jq '.channels[] | select(.name == "cm-labor-union") | .id'
```

## Related

- [Slack 설정](slack-config.md) - Bot Token, 권한
- [팀원 매핑](team-members.md) - GitHub ↔ Slack 사용자 매핑
- [notify-slack Skill](../../semo-skills/notify-slack/SKILL.md)
- [request-test Skill](../../skills/request-test/SKILL.md)
