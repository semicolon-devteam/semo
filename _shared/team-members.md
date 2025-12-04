# Semicolon 팀원 정보

> SAX 패키지에서 공통으로 참조하는 팀원 정보 (GitHub ↔ Slack 매핑)

## 팀원 매핑 테이블

| 이름 | GitHub ID | Slack Display Name | Slack ID | 역할 |
|------|-----------|-------------------|----------|------|
| 전준영 | reus-jeon | Reus | URSQYUNQJ | PO/개발 |
| 서정원 | Garden0312 | Garden | URU4UBX9R | 개발 |
| 강용준 | kokkh | kyago | U02G8542V9U | QA |
| 노영록 | swon3210 | Roki | U08P11ZQY04 | 개발 |
| 장현봉 | bon-jang | bon | U02V56WM3KD | 개발 |
| 강동현 | DwightKSchrute | dwight.k | U06Q5KECB5J | 개발 |
| 염현준 | yeomso | Yeomso | U080YLC0MFZ | 개발 |

## 사용 방법

### GitHub ID → Slack 멘션

```bash
# 1. GitHub ID로 Slack Display Name 조회 (이 문서 참조)
GITHUB_ID="reus-jeon"
# → Slack Display Name: "Reus"

# 2. Slack API로 사용자 ID 조회
SLACK_NAME="Reus"
SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7" \
  | jq -r --arg name "$SLACK_NAME" '
    .members[]
    | select(.deleted == false and .is_bot == false)
    | select(
        (.profile.display_name | ascii_downcase) == ($name | ascii_downcase) or
        (.name | ascii_downcase) == ($name | ascii_downcase)
      )
    | .id
  ' | head -1)

# 3. 멘션 형식으로 변환
MENTION="<@$SLACK_ID>"
```

### 빠른 조회 (Bash)

```bash
# GitHub ID로 Slack Display Name 조회
get_slack_name() {
  local github_id="$1"
  case "$github_id" in
    "reus-jeon") echo "Reus" ;;
    "Garden0312") echo "Garden" ;;
    "kokkh") echo "kyago" ;;
    "swon3210") echo "Roki" ;;
    "bon-jang") echo "bon" ;;
    "DwightKSchrute") echo "dwight.k" ;;
    "yeomso") echo "Yeomso" ;;
    *) echo "$github_id" ;;  # 매핑 없으면 GitHub ID 그대로 반환
  esac
}

# 사용 예시
SLACK_NAME=$(get_slack_name "reus-jeon")  # "Reus"
```

## 역할별 담당자

| 역할 | 담당자 | 알림 대상 |
|------|--------|----------|
| QA | kyago (강용준) | 테스트 요청, 버그 리포트 |
| PO | Reus (전준영) | Epic 생성, 요구사항 확인 |

## 팀원 추가/변경 시

1. 이 파일의 매핑 테이블 업데이트
2. `skills/notify-slack/references/slack-id-mapping.md` 참조 테이블도 동기화
3. sax-core 버저닝 (PATCH)

## Related

- [notify-slack Skill](../skills/notify-slack/SKILL.md)
- [Slack ID 동적 조회](../skills/notify-slack/references/slack-id-mapping.md)
