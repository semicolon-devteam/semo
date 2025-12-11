# Semicolon 팀원 정보

> SAX 패키지에서 공통으로 참조하는 팀원 정보 (GitHub ↔ Slack 매핑)

## 팀원 매핑 테이블

> 🔴 **Slack ID는 참조용입니다.** 실제 멘션 시에는 반드시 Slack API를 통해 동적으로 조회하세요.
>
> 마지막 동기화: 2025-12-09

| 이름 | GitHub ID | Slack Display Name | Slack ID | 역할 |
|------|-----------|-------------------|----------|------|
| 전준영 | reus-jeon | Reus | URSQYUNQJ | 프론트/리더 |
| 서정원 | garden92 | Garden | URU4UBX9R | 인프라/리더 |
| 고권희 | kokkh | Goni | U09NRR79YCW | QA |
| 강용준 | kyago | kyago | U02G8542V9U | 백엔드/리더 |
| 노영록 | Roki-Noh | Roki | U08P11ZQY04 | PO/리더 |
| 장현봉 | Brightbong92 | bon | U09LF7ZS5GR | 프론트 |
| 강동현 | gtod8010 | dwight.k | U01KNHM6PK3 | 프론트 |
| 염현준 | Yeomsoyam | Yeomso | U01KH8V6ZHP | 디자인/리더 |

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
# 🔴 이 매핑은 GitHub ID → Slack Display Name 변환용입니다.
# 🔴 실제 Slack ID는 반드시 API를 통해 동적으로 조회하세요.
get_slack_name() {
  local github_id="$1"
  case "$github_id" in
    "reus-jeon") echo "Reus" ;;
    "garden92") echo "Garden" ;;
    "kokkh") echo "Goni" ;;
    "kyago") echo "kyago" ;;
    "Roki-Noh") echo "Roki" ;;
    "Brightbong92") echo "bon" ;;
    "gtod8010") echo "dwight.k" ;;
    "Yeomsoyam") echo "Yeomso" ;;
    *) echo "$github_id" ;;  # 매핑 없으면 GitHub ID 그대로 반환
  esac
}

# 사용 예시
SLACK_NAME=$(get_slack_name "reus-jeon")  # "Reus"
```

> **🔴 중요**: Slack ID는 하드코딩하지 마세요! 반드시 Slack API를 통해 동적으로 조회해야 합니다.
> 하드코딩된 Slack ID는 사용자 탈퇴/재가입, 워크스페이스 변경 등으로 무효화될 수 있습니다.

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
