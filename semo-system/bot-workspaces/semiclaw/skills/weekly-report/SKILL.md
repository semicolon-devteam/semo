---
name: weekly-report
description: Generate and post the Semicolon team weekly progress report. Use when creating the Friday weekly report, collecting team updates, summarizing GitHub activity, or setting up the weekly report cron job. Covers data collection from GitHub, team DMs, and project trackers.
---

# Weekly Report Skill

Generates the Semicolon team's weekly progress report every Friday at 14:00 KST. Collects data from GitHub (issues, PRs, commits), team member updates, and project trackers, then posts a formatted report to #개발사업팀.

## 1. Schedule

- **When**: Every Friday at 14:00 KST
- **Where**: #개발사업팀 (C020RQTNPFY)
- **Prep**: Thursday 14:00 — send DMs to team members collecting context

## 2. Data Collection (Thursday)

Send DM to each active team member asking for weekly updates:
- What they worked on this week
- Blockers or concerns
- Plans for next week

### Team Members to Contact

| Name | Slack ID | Role |
|---|---|---|
| Reus | URSQYUNQJ | Frontend Lead |
| Garden | URU4UBX9R | System Architecture |
| Yeomso | U01KH8V6ZHP | Design/CMO |
| Roki | U08P11ZQY04 | Service/Growth |
| bon | U09LF7ZS5GR | Fullstack |
| kyago | U02G8542V9U | Backend Lead |
| Bae | U0A54SCQS84 | Infra/Backend |
| Harry Lee | U08PB15P4AV | Senior FE |
| Goni | U09NRR79YCW | Office Ops/QA |
| Kai | U0A4W1U0BAN | Junior Engineer |

### DM Template

```
안녕하세요! 주간 리포트 준비 중입니다 📊

이번 주 업데이트 공유해 주세요:
1. 이번 주 작업 내용
2. 블로커나 이슈
3. 다음 주 계획

목요일 저녁까지 답변 부탁드립니다!
```

### Collecting Responses

Use the `message` tool to send DMs:

```bash
# For each team member:
message send --channel slack --target <USER_ID> --message "<DM Template>"
```

Store responses in `memory/weekly-report-responses-YYYY-MM-DD.json`:

```json
{
  "weekEnding": "2026-03-14",
  "responses": {
    "URSQYUNQJ": {
      "name": "Reus",
      "completed": ["Task A", "Task B"],
      "blockers": ["Issue X"],
      "nextWeek": ["Task C"]
    }
  }
}
```

## 3. GitHub Data Collection

Run across all active repos. Key repos:
- semo, cm-land, proj-game-land, proj-play-land, proj-office-land
- core-backend, ms-point-exchanger
- proj-bebecare, cm-jungchipan, cm-labor-union

### Commands

```bash
# Issues closed this week
gh issue list --state closed --search "closed:>=$(date -v-7d +%Y-%m-%d)" \
  --repo semicolon-devteam/<repo> \
  --json number,title,closedAt,assignees

# PRs merged this week  
gh pr list --state merged --search "merged:>=$(date -v-7d +%Y-%m-%d)" \
  --repo semicolon-devteam/<repo> \
  --json number,title,mergedAt,author

# Commits this week (per repo)
git clone https://github.com/semicolon-devteam/<repo>.git /tmp/<repo>
cd /tmp/<repo>
git log --oneline --since="1 week ago" --format="%h %s (%an)"
```

### Automation Script

Use a loop to iterate over all repos:

```bash
REPOS=(semo cm-land proj-game-land proj-play-land proj-office-land core-backend ms-point-exchanger proj-bebecare cm-jungchipan cm-labor-union)

for repo in "${REPOS[@]}"; do
  echo "=== $repo ==="
  
  # Issues
  gh issue list --state closed \
    --search "closed:>=$(date -v-7d +%Y-%m-%d)" \
    --repo semicolon-devteam/$repo \
    --json number,title,closedAt,assignees
  
  # PRs
  gh pr list --state merged \
    --search "merged:>=$(date -v-7d +%Y-%m-%d)" \
    --repo semicolon-devteam/$repo \
    --json number,title,mergedAt,author
  
  echo ""
done
```

Store results in `memory/github-activity-YYYY-MM-DD.json`:

```json
{
  "weekEnding": "2026-03-14",
  "repos": {
    "semo": {
      "issuesClosed": 12,
      "prsMerged": 8,
      "commits": 45,
      "highlights": [
        {"number": 123, "title": "Fix login bug", "author": "Reus"}
      ]
    }
  }
}
```

## 4. Report Format

Generate the report using this markdown template:

```markdown
📊 주간 리포트 (MM/DD ~ MM/DD)

## 🎯 이번 주 하이라이트
- [핵심 성과 1~3개]

## 📋 프로젝트별 진척

### [프로젝트명]
- 완료: #이슈번호 제목 (담당자)
- 진행: #이슈번호 제목 (진척률)
- 블로커: [있으면]

## 📈 수치 요약
- 이슈 완료: N건
- PR 머지: N건  
- 커밋: N건

## 🚧 블로커 & 리스크
- [있으면 기재]

## 📅 다음 주 계획
- [팀원별 계획 요약]
```

### Example Report

```markdown
📊 주간 리포트 (03/03 ~ 03/07)

## 🎯 이번 주 하이라이트
- 게임랜드 베타 출시 완료 🎮
- 플레이랜드 멀티플레이어 시스템 구현
- 포인트 교환 서비스 안정화

## 📋 프로젝트별 진척

### 게임랜드 (proj-game-land)
- 완료: #245 베타 테스터 초대 시스템 (Reus)
- 완료: #251 리더보드 UI 개선 (Harry Lee)
- 진행: #260 튜토리얼 플로우 (60%, bon)

### 플레이랜드 (proj-play-land)
- 완료: #89 WebRTC 연결 로직 (kyago)
- 완료: #92 방 생성/입장 API (Bae)
- 블로커: #95 Safari 호환성 이슈

### 백엔드 인프라
- 완료: #34 Redis 캐싱 레이어 추가 (Bae)
- 완료: #37 모니터링 대시보드 구축 (kyago)

## 📈 수치 요약
- 이슈 완료: 24건
- PR 머지: 18건  
- 커밋: 127건

## 🚧 블로커 & 리스크
- Safari WebRTC 이슈로 플레이랜드 iOS 출시 1주 지연 예상
- 베베케어 디자인 리소스 부족 (Yeomso 병행 작업 중)

## 📅 다음 주 계획
- Reus: 게임랜드 튜토리얼 완성, 오피스랜드 기획
- Garden: 시스템 아키텍처 리뷰, 코드 리팩토링
- Yeomso: 게임랜드 마케팅 소재 제작
- Roki: 유저 피드백 분석, 그로스 전략 수립
- bon: 플레이랜드 멀티플레이어 테스트
- kyago: API 성능 최적화
- Bae: 배포 파이프라인 개선
- Harry Lee: 오피스랜드 프론트 개발 시작
- Goni: QA 테스트 케이스 작성
- Kai: 게임랜드 버그 픽스 지원
```

## 5. Project Tracker Integration

Read from `memory/project-tracker.json` for current project status:

```json
{
  "projects": [
    {
      "name": "게임랜드",
      "repo": "proj-game-land",
      "status": "active",
      "priority": "high",
      "lead": "Reus",
      "phase": "beta"
    }
  ]
}
```

Cross-reference with GitHub activity:
1. Match closed issues to project milestones
2. Identify projects with no activity (raise alert)
3. Calculate velocity (issues closed per week)

Update tracker after report:
```bash
# Update last_report_date
jq '.projects[0].last_report_date = "2026-03-07"' memory/project-tracker.json > /tmp/tracker.json
mv /tmp/tracker.json memory/project-tracker.json
```

## 6. Cron Setup

Use OpenClaw's cron scheduling to automate the weekly report.

### Thursday Context Collection

```json
{
  "schedule": {
    "kind": "cron",
    "expr": "0 5 * * 4",
    "tz": "Asia/Seoul"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Collect weekly report context from team members via DM. Use the weekly-report skill."
  }
}
```

- **Cron**: `0 5 * * 4` = Every Thursday at 05:00 UTC (14:00 KST)
- **Action**: Send DMs to all team members requesting updates

### Friday Report Generation

```json
{
  "schedule": {
    "kind": "cron",
    "expr": "0 5 * * 5",
    "tz": "Asia/Seoul"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Generate and post weekly report to #개발사업팀 (C020RQTNPFY). Use the weekly-report skill."
  }
}
```

- **Cron**: `0 5 * * 5` = Every Friday at 05:00 UTC (14:00 KST)
- **Action**: Collect GitHub data, compile report, post to Slack

### Setting Up Cron Jobs

To register these cron jobs with OpenClaw:

1. **Via Gateway API** (if running):
   ```bash
   curl -X POST http://localhost:7777/cron/schedule \
     -H "Content-Type: application/json" \
     -d '{
       "schedule": {"kind": "cron", "expr": "0 5 * * 4", "tz": "Asia/Seoul"},
       "payload": {"kind": "agentTurn", "message": "Collect weekly report context"}
     }'
   ```

2. **Via config file** (persistent):
   Edit `~/.openclaw/config.json` or `~/.openclaw-semiclaw/config.json`:
   ```json
   {
     "cron": {
       "jobs": [
         {
           "name": "weekly-report-collect",
           "schedule": {"kind": "cron", "expr": "0 5 * * 4", "tz": "Asia/Seoul"},
           "payload": {"kind": "agentTurn", "message": "Collect weekly report context from team members via DM"}
         },
         {
           "name": "weekly-report-post",
           "schedule": {"kind": "cron", "expr": "0 5 * * 5", "tz": "Asia/Seoul"},
           "payload": {"kind": "agentTurn", "message": "Generate and post weekly report to #개발사업팀"}
         }
       ]
     }
   }
   ```

## 7. Meeting Minutes

After the weekly team meeting, save minutes to the `command-center` repository.

### command-center Repository
- **Owner**: semicolon-devteam
- **Access**: Leader-only (private)
- **Purpose**: Decision log, meeting minutes, strategic docs

### Posting Meeting Minutes

Use GitHub Discussions:

```bash
# Create a discussion post
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/semicolon-devteam/command-center/discussions \
  -f title="주간 미팅 (2026-03-07)" \
  -f body="$(cat meeting-minutes.md)" \
  -f category_id="<MEETING_MINUTES_CATEGORY_ID>"
```

### Discussion Categories
- **Meeting-Minutes**: Weekly team meetings, retrospectives
- **Decision-Log**: Architecture decisions, strategic pivots

### Meeting Minutes Template

```markdown
# 주간 미팅 (YYYY-MM-DD)

## 참석자
- Reus, Garden, Yeomso, Roki, bon, kyago, Bae, Harry Lee, Goni, Kai

## 안건

### 1. 지난주 리뷰
- [하이라이트 요약]

### 2. 진행 중인 프로젝트
- **게임랜드**: [상태 및 논의사항]
- **플레이랜드**: [상태 및 논의사항]

### 3. 블로커 & 리스크
- [논의된 블로커]
- [해결 방안]

### 4. 의사결정
- **결정 1**: [내용 및 배경]
- **결정 2**: [내용 및 배경]

### 5. 액션 아이템
- [ ] Reus: [액션 아이템]
- [ ] kyago: [액션 아이템]

## 다음 미팅
- 일시: 2026-03-14 (금) 14:00
- 안건: [예상 안건]
```

### Automation

After posting the weekly report to Slack, prompt for meeting minutes:

```
주간 리포트가 포스팅되었습니다. 미팅이 있었다면 회의록을 command-center에 기록할까요?
```

## 8. Workflow Summary

### Thursday (14:00 KST)
1. Cron job triggers
2. Send DMs to all 10 team members
3. Store responses in `memory/weekly-report-responses-YYYY-MM-DD.json`

### Friday (14:00 KST)
1. Cron job triggers
2. Collect GitHub data (issues, PRs, commits) from all repos
3. Read team member responses from Thursday
4. Read `memory/project-tracker.json` for project status
5. Generate report using template
6. Post report to #개발사업팀 (C020RQTNPFY)
7. Save report to `memory/weekly-reports/YYYY-MM-DD.md`
8. Update `memory/project-tracker.json` with report date

### Post-Meeting (As Needed)
1. Collect meeting notes (manual input or recording)
2. Format using meeting minutes template
3. Post to `semicolon-devteam/command-center` GitHub Discussions
4. Tag appropriate category (Meeting-Minutes or Decision-Log)

## 9. Troubleshooting

### Common Issues

**DMs not sent**
- Check Slack token validity
- Verify user IDs are correct
- Ensure bot has DM permissions

**GitHub API rate limit**
- Use authenticated `gh` CLI (increases limit to 5000/hour)
- Batch requests efficiently
- Cache results where possible

**Missing team responses**
- Send reminder DM on Friday morning
- Default to "No update" if no response by report time
- Log non-responders for follow-up

**Cron not firing**
- Check OpenClaw gateway status: `openclaw gateway status`
- Verify timezone settings (Asia/Seoul)
- Review cron logs: `~/.openclaw/logs/cron.log`

### Testing

Test the report generation manually:

```bash
# Trigger Thursday collection
message send --channel slack --target URSQYUNQJ \
  --message "테스트: 주간 업데이트를 공유해 주세요"

# Trigger Friday report (dry run)
# Run GitHub data collection
# Generate report
# Review before posting
```

## 10. Maintenance

### Weekly
- Review report accuracy
- Update team member list if roster changes
- Archive old response files (keep last 4 weeks)

### Monthly
- Review GitHub repo list (add/remove as projects evolve)
- Update report template if new sections needed
- Check cron job reliability

### Quarterly
- Analyze report engagement (Slack reactions/comments)
- Survey team for report improvements
- Optimize data collection (reduce noise)

---

**End of Skill Documentation**

Total lines: ~460
