---
name: notify-slack
description: |
  Slack 채널에 메시지 전송 (공통 Skill). Use when (1) 이슈/태스크 알림,
  (2) 릴리스 알림, (3) /SEMO:slack 커맨드, (4) 팀원 멘션 요청.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: notify-slack 호출 - {알림 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# notify-slack Skill

> Slack 채널에 다양한 유형의 메시지 전송 (SEMO 공통 Skill)

## Purpose

모든 SEMO 패키지에서 공통으로 사용하는 Slack 알림 Skill입니다.

### 지원 메시지 유형

| 유형 | 설명 | 트리거 |
|------|------|--------|
| **이슈 알림** | Issue/Task 생성 완료 알림 | Agent 완료 후 호출 |
| **릴리스 알림** | SEMO 패키지 버전 업데이트 | version-manager 완료 후 |
| **커스텀 메시지** | 자유 형식 메시지 전송 | /SEMO:slack 커맨드 |
| **PR 리뷰 요청** | PR 링크 + 리뷰어 멘션 | PR 번호 포함 요청 |

## Configuration

### Slack Bot Token

> 📖 **중앙 설정**: [semo-core/_shared/slack-config.md](../../_shared/slack-config.md) 참조
>
> 🔴 토큰 갱신 시 `slack-config.md` 파일만 수정하세요.

**Semicolon Notifier** 앱 사용:

```
SLACK_BOT_TOKEN=xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7
```

### 기본 채널

| 채널 | 용도 |
|------|------|
| `#_협업` | 기본 알림 채널 |

## Quick Start

> **⚠️ 중요**: 쉘 이스케이프 문제를 방지하기 위해 **heredoc 방식**을 사용하세요.

```bash
# ✅ 권장: heredoc 방식 (쉘 이스케이프 문제 방지)
curl -s -X POST 'https://slack.com/api/chat.postMessage' \
  -H 'Authorization: Bearer xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7' \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d @- << 'EOF'
{
  "channel": "C09KNL91QBZ",
  "text": "메시지 내용",
  "blocks": [...]
}
EOF
```

> **🔴 주의**: `-d '{...}'` 형식은 한글, 특수문자, 줄바꿈 등에서 쉘 이스케이프 오류가 발생할 수 있습니다.

## Workflow

### 공통 단계

1. **정보 수집**: 호출자로부터 알림 데이터 수신
2. **사용자 조회**: Slack API로 동적 사용자 ID 조회
3. **메시지 구성**: Block Kit 형식으로 구성
4. **API 호출**: Slack chat.postMessage 호출
5. **완료 보고**: 결과 메시지 출력

### 🔴 동적 사용자 조회 (Step 2) - 필수

> **하드코딩된 매핑 테이블 대신 Slack API를 통해 실시간으로 사용자 ID를 조회합니다.**
>
> **⚠️ 중요**: 모든 사용자 멘션은 반드시 `<@SLACK_ID>` 형식이어야 합니다.
> - ❌ `@gtod8010` → 텍스트로만 표시됨
> - ❌ `@dwight.k` → 텍스트로만 표시됨
> - ✅ `<@U06Q5KECB5J>` → 실제 멘션으로 표시됨

#### 조회 API 호출

```bash
# 전체 사용자 목록 조회
curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7" \
  | jq '.members[] | select(.deleted == false and .is_bot == false) | {id, name, real_name, display_name: .profile.display_name}'
```

#### 매칭 우선순위

사용자 식별자(이름, GitHub ID 등)를 받으면 다음 순서로 매칭:

| 우선순위 | 필드 | 예시 |
|----------|------|------|
| 1 | `profile.display_name` | "Reus", "Garden" |
| 2 | `name` | "reus", "garden92" |
| 3 | `real_name` | "전준영", "서정원" |

#### 매칭 로직

```bash
# 예: "Reus" 또는 "전준영"으로 사용자 찾기
SEARCH_NAME="Reus"

SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7" \
  | jq -r --arg name "$SEARCH_NAME" '
    .members[]
    | select(.deleted == false and .is_bot == false)
    | select(
        (.profile.display_name | ascii_downcase) == ($name | ascii_downcase) or
        (.name | ascii_downcase) == ($name | ascii_downcase) or
        (.real_name | ascii_downcase) == ($name | ascii_downcase)
      )
    | .id
  ' | head -1)

# 결과: URSQYUNQJ
```

#### 🔴 멘션 형식 생성 (필수)

> **⚠️ GitHub username → Slack ID 변환은 필수입니다.**

```bash
# 1. GitHub username으로 검색할 이름 결정
# GitHub ID → Display Name 매핑 (team-members.md 참조)
get_search_name() {
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
    *) echo "$github_id" ;;
  esac
}

SEARCH_NAME=$(get_search_name "$GITHUB_USERNAME")

# 2. Slack API로 ID 조회
SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  | jq -r --arg name "$SEARCH_NAME" '
    .members[]
    | select(.deleted == false and .is_bot == false)
    | select(
        (.profile.display_name | ascii_downcase) == ($name | ascii_downcase) or
        (.name | ascii_downcase) == ($name | ascii_downcase)
      )
    | .id
  ' | head -1)

# 3. 멘션 형식으로 변환
if [ -n "$SLACK_ID" ]; then
  MENTION="<@$SLACK_ID>"  # ✅ <@U06Q5KECB5J> → 실제 멘션
else
  MENTION="$SEARCH_NAME"   # ⚠️ 조회 실패 시 이름만 표시 (멘션 안 됨)
fi
```

**🔴 메시지 본문에서 담당자/멘션 대상 사용 시**:
- 반드시 위 과정을 거쳐 `<@SLACK_ID>` 형식 사용
- section 블록의 mrkdwn에서도 동일하게 적용

#### 팀원 참조 (Semicolon)

> 🔴 **중요**: 아래 Slack ID는 참조용입니다. **실제 멘션 시에는 반드시 Slack API를 통해 동적으로 조회하세요.**
> Slack ID는 사용자 탈퇴/재가입, 워크스페이스 변경 등으로 변경될 수 있습니다.

| Display Name | Real Name | GitHub ID |
|--------------|-----------|-----------|
| Reus | 전준영 | reus-jeon |
| Garden | 서정원 | garden92 |
| Goni | 고권희 | kokkh |
| kyago | 강용준 | kyago |
| Roki | 노영록 | Roki-Noh |
| bon | 장현봉 | Brightbong92 |
| dwight.k | 강동현 | gtod8010 |
| Yeomso | 염현준 | Yeomsoyam |

> 📖 전체 매핑 정보: [semo-core/_shared/team-members.md](../../_shared/team-members.md)

### 릴리스 알림 (version-manager 연동)

version-manager가 버저닝 완료 후 자동 호출합니다.

#### 표준 메시지 형식

```text
🚀 SEMO 패키지 업데이트

패키지             버전
semo-meta          v0.30.0

변경 내역
• version-manager SKILL.md에 Slack 알림 필수화 명시
• Quick Start 간소화 (9단계 → 6단계)
• 누락 시 미완료 상태 경고 추가

🔗 GitHub
```

#### 메시지 구조

| 섹션 | 내용 |
|------|------|
| **Header** | `🚀 SEMO 패키지 업데이트` |
| **Fields** | 패키지 이름 / 버전 (두 열) |
| **Body** | 변경 내역 (• bullet 형식) |
| **Footer** | GitHub 링크 |

> **📖 상세 템플릿**: [message-templates.md](references/message-templates.md) 참조

### 이슈/태스크 알림

```yaml
input:
  type: "issue"
  context:
    number: 123
    title: "댓글 기능 구현"
    url: "https://github.com/..."
  issues:
    - repo: "core-backend"
      number: 456
      title: "댓글 API 구현"
      assignee: "kyago"
```

### 커스텀 메시지 (/SEMO:slack)

```bash
/SEMO:slack #_협업 채널에 'Roki' 멘션해서 #520 이슈 확인 요청
```

**파라미터 파싱**:

| 항목 | 추출 방법 | 예시 |
|------|-----------|------|
| `channel` | `#채널명` 패턴 | `#_협업` |
| `mentions` | 이름/GitHub ID | `Roki` |
| `issue_number` | `#숫자` 패턴 | `#520` |

## 완료 메시지

```markdown
[SEMO] Skill: notify-slack 완료

✅ Slack 알림 전송 완료

**채널**: #_협업
**유형**: {release|issue|custom}
```

## Error Handling

### 채널 접근 권한 없음

```markdown
⚠️ **Slack 알림 실패**

채널 접근 권한이 없습니다.
Semicolon Notifier 앱을 해당 채널에 추가해주세요.
```

### Slack 사용자 조회 실패

```markdown
⚠️ **Slack 멘션 불가**

`{search_name}`에 해당하는 Slack 사용자를 찾을 수 없습니다.
알림은 전송되지만 멘션은 생략됩니다.

**확인 사항**:
- Slack 워크스페이스에 가입된 사용자인지 확인
- display_name, name, real_name 중 하나와 일치하는지 확인
```

## SEMO Message Format

```markdown
[SEMO] Skill: notify-slack 호출 - {알림 유형}

[SEMO] Skill: notify-slack 완료 - #_협업 채널
```

## References

- [동적 사용자 조회](references/slack-id-mapping.md) - Slack API 사용자 조회 가이드
- [메시지 템플릿](references/message-templates.md) - Block Kit 템플릿
- [채널 설정](references/channel-config.md) - 채널 설정 및 권한
