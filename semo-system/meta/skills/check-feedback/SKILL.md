---
name: check-feedback
description: SEMO 패키지 피드백 이슈 수집 및 리스트업. Use when (1) "피드백 확인", "피드백 있는지", (2) "유저 피드백 체크", (3) SEMO 관련 open 이슈 조회.
tools: [Bash]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: check-feedback 호출` 시스템 메시지를 첫 줄에 출력하세요.

# check-feedback Skill

> SEMO 패키지 관련 피드백 이슈 수집 및 리포트

## Purpose

`semicolon-devteam/semo` 레포지토리에서 open 상태인 이슈를 수집하여 리스트업합니다.

## Trigger Keywords

- "피드백 확인", "피드백 있는지 확인"
- "유저 피드백 체크", "피드백 체크"
- "SEMO 이슈 확인", "open 이슈"

## Workflow

### 1. semo 레포지토리 Open 이슈 수집

```bash
gh api repos/semicolon-devteam/semo/issues --jq '.[] | select(.state == "open") | {
  number: .number,
  title: .title,
  labels: [.labels[].name],
  created_at: (.created_at | split("T")[0]),
  author: .user.login,
  body: .body
}'
```

### 2. 프로젝트 정보 추출

이슈 본문에서 프로젝트 정보를 추출합니다:

```bash
# 본문에서 프로젝트명 패턴 추출
# 패턴: "발생 프로젝트: {name}", "[{project}]", "프로젝트: {name}"
extract_project() {
  local body="$1"
  # 우선순위: 명시적 필드 > 라벨 > 접두사
  echo "$body" | grep -oE '(발생 프로젝트|프로젝트)[:\s]*[가-힣a-zA-Z0-9_-]+' | head -1 | sed 's/.*[:\s]//'
}
```

### 3. GitHub → Slack 사용자 매칭

> 📖 **팀원 매핑**: [semo-core/_shared/team-members.md](../../semo-core/_shared/team-members.md) 참조

```bash
# GitHub ID → 팀원 이름 변환
get_member_name() {
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
```

## Output Format

```markdown
## 📋 SEMO 피드백 현황

### 📦 semo
| # | 제목 | 프로젝트 | 작성자 | 라벨 | 생성일 |
|---|------|----------|--------|------|--------|
| #1 | 이슈 제목 | cm-labor-union | Reus | bug | 2024-12-01 |

---
**총 {N}개의 Open 이슈**

---

## 🎯 처리 우선순위 제안

{우선순위 제안 섹션}
```

## 처리 우선순위 제안 로직

> **리스트업 후 반드시 처리 우선순위를 제안합니다.**

### 우선순위 결정 기준

| 순위 | 조건 | 가중치 |
|------|------|--------|
| 1 | `bug` 라벨 | +3 |
| 2 | 오래된 이슈 (7일 이상) | +2 |
| 3 | `enhancement` 라벨 | +1 |
| 4 | 동일 프로젝트 이슈 묶음 | +1 (효율성) |

### 우선순위 제안 포맷

```markdown
## 🎯 처리 우선순위 제안

### 즉시 처리 (High Priority)
1. **#{number}** - {title}
   - 사유: Bug 라벨, {N}일 경과
   - 프로젝트: {project}

### 일반 처리 (Normal Priority)
2. **#{number}** - {title}
   - 사유: Enhancement 요청
   - 프로젝트: {project}

### 묶음 처리 제안
- **{project}** 관련 이슈 {N}개를 함께 처리하면 효율적
  - #{n1}, #{n2}, #{n3}

---
💡 **제안**: #{number}부터 시작하시겠습니까?
```

### 우선순위 계산 예시

```javascript
// 우선순위 점수 계산
function calculatePriority(issue) {
  let score = 0;

  // 라벨 기반 가중치
  if (issue.labels.includes('bug')) score += 3;
  if (issue.labels.includes('enhancement')) score += 1;

  // 경과일 기반 가중치
  const daysOld = daysSince(issue.created_at);
  if (daysOld >= 7) score += 2;
  else if (daysOld >= 3) score += 1;

  return score;
}
```

## No Issues Case

```markdown
## 📋 SEMO 피드백 현황

✅ semo 레포에 open 이슈가 없습니다.
```

---

## 🔴 피드백 수정 완료 후 슬랙 알림 (NON-NEGOTIABLE)

> **⚠️ 피드백 이슈 수정 완료 후, 문의자에게 반드시 슬랙 알림을 전송합니다.**

### 트리거

- 피드백 이슈 수정 후 이슈 종료 시
- 이슈에 코멘트 작성 후 종료 시

### 프로세스

1. **이슈 작성자 확인**
   ```bash
   # 이슈 작성자 GitHub ID 조회
   AUTHOR=$(gh api repos/semicolon-devteam/{repo}/issues/{number} --jq '.user.login')
   ```

2. **GitHub → Slack 사용자 매칭**

   > 📖 **팀원 매핑**: [semo-core/_shared/team-members.md](../../semo-core/_shared/team-members.md) 참조
   >
   > 🔴 **Slack ID는 하드코딩하지 마세요!** 반드시 Slack API를 통해 동적으로 조회합니다.

   ```bash
   # GitHub ID → Slack Display Name 변환 함수
   # 매핑 정보는 semo-core/_shared/team-members.md 참조
   # 🔴 이 함수는 Display Name만 반환합니다. Slack ID는 Step 3에서 동적 조회!
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
       *) echo "$github_id" ;;
     esac
   }

   SLACK_NAME=$(get_slack_name "$AUTHOR")
   ```

3. **Slack 사용자 ID 조회**

   > 📖 **Slack 설정**: [semo-core/_shared/slack-config.md](../../semo-core/_shared/slack-config.md) 참조

   ```bash
   # 토큰은 semo-core/_shared/slack-config.md 참조
   SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
     -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     | jq -r --arg name "$SLACK_NAME" '
       .members[]
       | select(.deleted == false and .is_bot == false)
       | select(
           (.profile.display_name | ascii_downcase) == ($name | ascii_downcase) or
           (.name | ascii_downcase) == ($name | ascii_downcase)
         )
       | .id
     ' | head -1)
   ```

4. **슬랙 알림 전송**
   ```bash
   # 토큰은 semo-core/_shared/slack-config.md 참조
   curl -s -X POST https://slack.com/api/chat.postMessage \
     -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     -H "Content-Type: application/json; charset=utf-8" \
     -d '{
       "channel": "#_협업",
       "text": "SEMO 피드백 수정 완료",
       "blocks": [
         {
           "type": "header",
           "text": {
             "type": "plain_text",
             "text": "✅ SEMO 피드백 수정 완료"
           }
         },
         {
           "type": "section",
           "fields": [
             {
               "type": "mrkdwn",
               "text": "*패키지*\n{repo}"
             },
             {
               "type": "mrkdwn",
               "text": "*이슈*\n<{issue_url}|#{number}>"
             }
           ]
         },
         {
           "type": "section",
           "text": {
             "type": "mrkdwn",
             "text": "*제목*\n{issue_title}"
           }
         },
         {
           "type": "section",
           "text": {
             "type": "mrkdwn",
             "text": "*문의자*\n<@'"$SLACK_ID"'>"
           }
         },
         {
           "type": "section",
           "text": {
             "type": "mrkdwn",
             "text": "*수정 내용*\n{fix_summary}"
           }
         },
         {
           "type": "context",
           "elements": [
             {
               "type": "mrkdwn",
               "text": "🔗 <{issue_url}|GitHub 이슈 확인>"
             }
           ]
         }
       ]
     }'
   ```

### 알림 메시지 형식

```text
✅ SEMO 피드백 수정 완료

패키지          이슈
semo-po         #12

제목
[Bug] Epic 생성 시 GitHub Issue Type 미설정

문의자
@Reus

수정 내용
• v0.23.0에서 이미 수정됨
• create-epic 스킬에 Issue Type 설정 추가

🔗 GitHub 이슈 확인
```

### 완료 출력

```markdown
[SEMO] Skill: check-feedback → 피드백 수정 알림 완료

✅ 슬랙 알림 전송 완료
- **채널**: #_협업
- **문의자**: @{slack_name}
- **이슈**: {repo}#{number}
```

### 알림 생략 조건

- 이슈 작성자가 본인인 경우 (자기 자신에게 알림 불필요)
- Slack 사용자 매칭 실패 시 (경고 메시지만 출력)

## References

- [Slack 설정 (토큰, 채널)](../../semo-core/_shared/slack-config.md)
- [팀원 정보 (GitHub ↔ Slack 매핑)](../../semo-core/_shared/team-members.md)
- [notify-slack Skill](../../semo-core/skills/notify-slack/SKILL.md)
