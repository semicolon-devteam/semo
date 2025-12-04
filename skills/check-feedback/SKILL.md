---
name: check-feedback
description: SAX 패키지 피드백 이슈 수집 및 리스트업. Use when (1) "피드백 확인", "피드백 있는지", (2) "유저 피드백 체크", (3) SAX 관련 open 이슈 조회.
tools: [Bash]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: check-feedback 호출` 시스템 메시지를 첫 줄에 출력하세요.

# check-feedback Skill

> SAX 패키지 관련 피드백 이슈 수집 및 리포트

## Purpose

`sax-*` 패턴의 모든 레포지토리에서 open 상태인 이슈를 수집하여 리스트업합니다.

## Trigger Keywords

- "피드백 확인", "피드백 있는지 확인"
- "유저 피드백 체크", "피드백 체크"
- "SAX 이슈 확인", "open 이슈"

## Workflow

### 1. SAX 레포지토리 목록 조회

```bash
gh repo list semicolon-devteam --json name --jq '.[] | select(.name | startswith("sax-")) | .name'
```

### 2. 각 레포별 Open 이슈 수집

```bash
for repo in $(gh repo list semicolon-devteam --json name --jq '.[] | select(.name | startswith("sax-")) | .name'); do
  echo "=== $repo ==="
  gh api repos/semicolon-devteam/$repo/issues --jq '.[] | select(.state == "open") | "- #\(.number) \(.title) [\(.labels | map(.name) | join(", "))]"'
done
```

### 3. docs 레포 SAX 관련 이슈 수집

```bash
gh api repos/semicolon-devteam/docs/issues --jq '.[] | select(.state == "open" and (.labels[].name == "sax" or .labels[].name == "feedback-requested")) | "- #\(.number) \(.title)"'
```

## Output Format

```markdown
## 📋 SAX 피드백 현황

### 📦 sax-backend
| # | 제목 | 라벨 | 생성일 |
|---|------|------|--------|
| #1 | 이슈 제목 | bug, feedback | 2024-12-01 |

### 📦 sax-next
(이슈 없음)

### 📄 docs (SAX 관련)
| # | 제목 | 라벨 | 생성일 |
|---|------|------|--------|
| #10 | sax-backend 피드백 요청 | release, sax | 2024-11-30 |

---
**총 {N}개의 Open 이슈**
```

## No Issues Case

```markdown
## 📋 SAX 피드백 현황

✅ 모든 SAX 패키지에 open 이슈가 없습니다.
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

   > 📖 **팀원 매핑**: [sax-core/_shared/team-members.md](../../sax-core/_shared/team-members.md) 참조

   ```bash
   # GitHub ID → Slack Display Name 변환 함수
   # 매핑 정보는 sax-core/_shared/team-members.md 참조
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
       *) echo "$github_id" ;;
     esac
   }

   SLACK_NAME=$(get_slack_name "$AUTHOR")
   ```

3. **Slack 사용자 ID 조회**
   ```bash
   SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
     -H "Authorization: Bearer xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb" \
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
   curl -s -X POST https://slack.com/api/chat.postMessage \
     -H "Authorization: Bearer xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb" \
     -H "Content-Type: application/json; charset=utf-8" \
     -d '{
       "channel": "#_협업",
       "text": "SAX 피드백 수정 완료",
       "blocks": [
         {
           "type": "header",
           "text": {
             "type": "plain_text",
             "text": "✅ SAX 피드백 수정 완료"
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
✅ SAX 피드백 수정 완료

패키지          이슈
sax-po         #12

제목
[Bug] Epic 생성 시 Projects 타입 필드 미설정

문의자
@Reus

수정 내용
• v0.23.0에서 이미 수정됨
• create-epic 스킬에 타입 필드 설정 추가

🔗 GitHub 이슈 확인
```

### 완료 출력

```markdown
[SAX] Skill: check-feedback → 피드백 수정 알림 완료

✅ 슬랙 알림 전송 완료
- **채널**: #_협업
- **문의자**: @{slack_name}
- **이슈**: {repo}#{number}
```

### 알림 생략 조건

- 이슈 작성자가 본인인 경우 (자기 자신에게 알림 불필요)
- Slack 사용자 매칭 실패 시 (경고 메시지만 출력)

## References

- [팀원 정보 (GitHub ↔ Slack 매핑)](../../sax-core/_shared/team-members.md)
- [notify-slack Skill](../../sax-core/skills/notify-slack/SKILL.md)
