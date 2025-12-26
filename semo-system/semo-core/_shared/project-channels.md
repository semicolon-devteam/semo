# 프로젝트별 Slack 채널 매핑

> 프로젝트/레포지토리별 Slack 알림 채널 설정

## 채널 매핑 테이블

| 프로젝트 | 레포지토리 | Slack 채널 | 채널 ID | 비고 |
|---------|-----------|-----------|---------|------|
| MVP Link Collect | mvp-link-collect | #mvp-link-collect | - | 현재 프로젝트 |
| CM Land | cm-land | #cm-land | - | 커뮤니티 랜드 |
| CM Office | cm-office | #cm-office | - | 커뮤니티 오피스 |
| Core Backend | core-backend | #_협업 | C09KNL91QBZ | 기본 채널 사용 |
| SEMO | semo | #_협업 | C09KNL91QBZ | 기본 채널 사용 |

> **채널 ID 미설정 시**: 채널명으로 전송 시도 후, 실패 시 `#_협업`으로 Fallback

## 기본 채널

```yaml
default_channel: "#_협업"
default_channel_id: "C09KNL91QBZ"
```

## 사용 방법

### 1. 레포지토리에서 프로젝트 채널 조회

```javascript
// 레포지토리 → 프로젝트 채널 매핑
const PROJECT_CHANNELS = {
  "mvp-link-collect": "#mvp-link-collect",
  "cm-land": "#cm-land",
  "cm-office": "#cm-office",
  "core-backend": "#_협업",
  "semo": "#_협업"
};

function getProjectChannel(repo) {
  return PROJECT_CHANNELS[repo] || "#_협업";
}
```

### 2. 테스트 요청 시 채널 결정

```text
1. Issue/PR의 레포지토리 확인
2. 매핑 테이블에서 채널 조회
3. 채널 전송 시도
4. 실패 시 #_협업으로 Fallback
```

## 채널 Fallback 규칙

```text
프로젝트 채널 전송 시도
    │
    ├─ 성공 → 완료
    │
    └─ 실패 (channel_not_found)
        │
        ├─ 채널명 정규화 시도 (#_xxx → #xxx)
        │   └─ 성공 → 완료
        │
        └─ 기본 채널 (#_협업)으로 전송
            └─ 메시지에 원래 채널명 표시
```

## 새 프로젝트 추가 시

1. 이 파일의 매핑 테이블에 추가
2. Slack 앱을 해당 채널에 초대
3. (선택) 채널 ID 조회 후 추가

```bash
# 채널 ID 조회
curl -X GET "https://slack.com/api/conversations.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | \
  jq '.channels[] | select(.name == "mvp-link-collect") | .id'
```

## Related

- [Slack 설정](slack-config.md) - Bot Token, 권한
- [팀원 매핑](team-members.md) - GitHub ↔ Slack 사용자 매핑
- [notify-slack Skill](../../semo-skills/notify-slack/SKILL.md)
