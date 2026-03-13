---
name: wishket-crawler
description: Crawl Wishket (위시캣) freelance projects, score against Semicolon tech stack, and post qualified leads to Slack. Use when setting up or running daily Wishket project monitoring, adjusting scoring weights, or troubleshooting the crawler pipeline.
---

# Wishket Crawler

Automates crawling Wishket (위시캣) freelance platform for project opportunities, scoring them against the Semicolon team's tech stack, and posting qualified leads to Slack.

## 1. Overview

**Daily pipeline:** Crawl → Score → Filter (≥40pts) → Slack notification

- **Cron schedule:** 매일 09:00 KST
- **Target channel:** C0ABAE680PR (#개발사업팀-SI)
- **Mention user:** @yeomso (U01KH8V6ZHP)
- **Account:** reus@semi-colon.space / team-semicolon
- **Current tier:** BASIC partner (can't access BOOST/PRO/PRIME projects)

The skill provides automated daily monitoring of Wishket freelance project listings, filtering and scoring them based on Semicolon's tech stack preferences.

## 2. Pipeline Steps

The daily workflow consists of five key stages:

### 2.1 Login
- Uses Playwright headless browser to authenticate
- Credentials from environment variables: `WISHKET_EMAIL`, `WISHKET_PASSWORD`
- Handles form selectors and waits for successful authentication

### 2.2 Crawl
- Navigates to project listing page
- Extracts project metadata (title, budget, duration, skills, etc.)
- Limits to 20 projects per run to avoid rate limiting

### 2.3 Filter by Access Tier
- Checks for grade restrictions (BOOST/PRO/PRIME badges)
- Skips projects that require higher partner tiers
- Only processes projects accessible to BASIC tier

### 2.4 Score Projects
- Applies weighted scoring based on:
  - Tech stack matching (core skills weighted higher)
  - Domain preferences (AI, 핀테크, SaaS, etc.)
  - Budget bonuses (higher budgets get bonus points)
  - Competition bonuses (fewer applicants = more points)
- Minimum threshold: 40 points

### 2.5 Post to Slack
- Formats results with score breakdown
- Posts to designated channel with user mention
- Includes project details, skills, and direct link

## 3. Scoring System

### 3.1 Tech Stack Weights

**Core (15 points):**
- TypeScript, React Native, Kotlin, Spring Boot

**Mid (12 points):**
- React, Node.js, Next.js, Supabase, AI, LLM

**Support (10 points):**
- AWS, Vue.js, Terraform, PostgreSQL, Java

**Lower (8 points):**
- Docker, Python, Tailwind, MySQL, MongoDB, Redis, Kubernetes, Django, Flask, GraphQL, Angular

**Basic (5-6 points):**
- HTML, CSS, REST API

### 3.2 Domain Preferences
- AI: +10
- 핀테크 (Fintech): +9
- SaaS: +9
- 헬스케어 (Healthcare): +8
- 교육 (Education): +8
- 커머스 (E-commerce): +7
- 엔터테인먼트: +7
- 게임: +6

### 3.3 Budget Bonuses
- ≥1000만원: +10 points
- ≥500만원: +5 points

### 3.4 Competition Bonuses
- <5 applicants: +8 points
- <10 applicants: +4 points

## 4. Scripts Reference

The skill includes three scripts in the `scripts/` directory:

### 4.1 `crawl.py`
Main crawler script (Python with Playwright):
- Handles Wishket login authentication
- Crawls project listings with tier filtering
- Parses project metadata (title, budget, skills, etc.)
- Outputs JSON array of projects

**Key functions:**
- `login_wishket(page)` - Authenticates with Wishket
- `check_project_access(page, url)` - Verifies BASIC tier access
- `score_project(project)` - Initial scoring logic
- `crawl_wishket()` - Main orchestration

### 4.2 `score.js`
Scoring and formatting script (Node.js):
- Reads project JSON from stdin
- Applies weighted scoring algorithm
- Filters projects ≥40 points
- Generates Slack-formatted message output

**Key functions:**
- `scoreProject(project)` - Applies full scoring logic
- `formatProject(project, scoreInfo)` - Creates Slack message blocks

### 4.3 `daily.sh`
Orchestrator shell script:
- Coordinates crawl → score → post workflow
- Manages cache file for deduplication
- Posts to Slack via API
- Handles error reporting

**Environment variables required:**
- `WISHKET_EMAIL`
- `WISHKET_PASSWORD`
- `SLACK_BOT_TOKEN`

## 5. Configuration

### 5.1 Environment Variables

```bash
export WISHKET_EMAIL="reus@semi-colon.space"
export WISHKET_PASSWORD="team-semicolon"
export SLACK_BOT_TOKEN="xoxb-your-token-here"
```

### 5.2 Prerequisites

**Python packages:**
```bash
pip install playwright
python -m playwright install chromium
```

**Node.js:**
- Version 18+ recommended
- No additional packages required (uses built-in fs module)

### 5.3 Cache Management

The skill maintains `wishket-cache.json` to track processed projects and avoid duplicate notifications. The cache stores project URLs with timestamps.

**Cache format:**
```json
{
  "https://www.wishket.com/project/123": 1709964000,
  "https://www.wishket.com/project/124": 1709964000
}
```

### 5.4 Slack Channel Configuration

- **Channel ID:** C0ABAE680PR
- **Channel name:** #개발사업팀-SI
- **Mention user:** U01KH8V6ZHP (@yeomso)

## 6. Troubleshooting

### 6.1 Login Fails
**Symptoms:** Script exits with "로그인 실패" error

**Possible causes:**
- Incorrect credentials in environment variables
- Wishket changed login form selectors
- Rate limiting or CAPTCHA triggered

**Solutions:**
1. Verify credentials: `echo $WISHKET_EMAIL $WISHKET_PASSWORD`
2. Check Wishket login page for HTML changes
3. Update selectors in `crawl.py` `login_wishket()` function
4. Try manual login first to clear any CAPTCHA

### 6.2 No Projects Found
**Symptoms:** Crawler returns empty array or 0 projects

**Possible causes:**
- Project list page HTML structure changed
- CSS selectors are outdated
- All projects are tier-restricted

**Solutions:**
1. Visit https://www.wishket.com/project/ manually
2. Inspect current HTML structure with browser DevTools
3. Update selectors in `crawl_wishket()` function:
   - `.project-info-box, .project-card, .project-item`
   - `.title-text, .project-title`
   - `.price, .budget`
4. Check console output for parsing errors

### 6.3 Tier Filter Too Aggressive
**Symptoms:** All projects skipped with "전용 프로젝트 스킵" message

**Possible causes:**
- BASIC tier has limited access during certain periods
- Grade badge detection is too sensitive

**Solutions:**
1. Verify BASIC tier access manually on wishket.com
2. Check if team account was upgraded to higher tier
3. If upgraded, update `check_project_access()` logic to allow more tiers
4. Temporarily disable tier filtering for debugging:
   ```python
   # Comment out this block in crawl.py
   # if grade_badge:
   #     grade_text = await grade_badge.inner_text()
   #     if any(g in grade_text.upper() for g in ['BOOST', 'PRO', 'PRIME']):
   #         continue
   ```

### 6.4 Slack Posting Fails
**Symptoms:** Projects scored but not posted to Slack

**Possible causes:**
- Invalid or expired `SLACK_BOT_TOKEN`
- Incorrect channel ID
- Bot not invited to channel

**Solutions:**
1. Verify token: `curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" https://slack.com/api/auth.test`
2. Check bot is in channel C0ABAE680PR
3. Test message: `openclaw message send --target C0ABAE680PR --message "test"`

### 6.5 Scoring Weights Outdated
**Symptoms:** Relevant projects scoring too low, irrelevant projects scoring high

**Solutions:**
1. Review current Semicolon tech stack with team
2. Update weights in both `crawl.py` and `score.js`
3. Test with recent projects: `cat test-projects.json | node scripts/score.js`
4. Adjust threshold if needed (currently 40 points)

## 7. Cron Setup

To run the crawler daily at 09:00 KST:

### 7.1 OpenClaw Cron Job

Create a cron job using OpenClaw's cron system:

```javascript
{
  schedule: {
    kind: "cron",
    expr: "0 0 * * *",  // Midnight UTC = 09:00 KST
    tz: "Asia/Seoul"
  },
  payload: {
    kind: "agentTurn",
    message: "Run wishket daily crawl"
  }
}
```

### 7.2 Manual Trigger

For testing or manual runs:

```bash
cd /Users/reus/.openclaw/workspace/skills/wishket-crawler
bash scripts/daily.sh
```

### 7.3 Agent Instruction

When the agent receives "Run wishket daily crawl", execute:

```bash
cd /Users/reus/.openclaw/workspace/skills/wishket-crawler/scripts
python3 crawl.py > projects.json
cat projects.json | node score.js > message.json
# Post to Slack via OpenClaw message tool
```

## 8. Maintenance

### 8.1 Scoring Weight Updates

As Semicolon's tech stack evolves:

1. Edit `scripts/score.js` TECH_STACK and DOMAIN_PREFERENCES
2. Also update matching weights in `scripts/crawl.py`
3. Test scoring with sample projects
4. Document changes in daily notes

### 8.2 Tier Access Updates

When team upgrades Wishket partner tier:

1. Update tier filtering logic in `crawl.py`
2. Remove or adjust grade badge checks
3. Update SKILL.md overview section
4. Notify team of increased project access

### 8.3 CSS Selector Maintenance

Wishket may update their website HTML periodically:

1. Monitor for parsing errors in daily runs
2. When failures occur, inspect current HTML
3. Update selectors in `crawl.py`
4. Test thoroughly before deploying
5. Document selector changes

## 9. Usage Examples

### 9.1 Run Complete Pipeline

```bash
# Set environment variables
export WISHKET_EMAIL="reus@semi-colon.space"
export WISHKET_PASSWORD="team-semicolon"
export SLACK_BOT_TOKEN="xoxb-..."

# Run daily script
cd /Users/reus/.openclaw/workspace/skills/wishket-crawler
bash scripts/daily.sh
```

### 9.2 Test Crawler Only

```bash
cd /Users/reus/.openclaw/workspace/skills/wishket-crawler
python3 scripts/crawl.py > test-output.json
cat test-output.json
```

### 9.3 Test Scoring Only

```bash
# Use existing crawl results
cat test-output.json | node scripts/score.js
```

### 9.4 Adjust Score Threshold

Edit the filter in `score.js`:

```javascript
// Change from 40 to 35
.filter(p => p.score >= 35)
```

## 10. Important Notes

- **Copy the 3 script files** into `scripts/` directory during skill setup
- **Keep scoring weights synchronized** between `crawl.py` and `score.js`
- **BASIC tier limitation** must be monitored — as team upgrades tier, update filtering logic
- **Credentials security:** Never commit credentials to git, always use environment variables
- **Rate limiting:** Current limit of 20 projects per run helps avoid detection
- **Cache cleanup:** Periodically clean old entries from `wishket-cache.json`

## 11. Validation

After skill creation, validate the package:

```bash
python3 /Users/reus/.nvm/versions/node/v24.12.0/lib/node_modules/openclaw/skills/skill-creator/scripts/package_skill.py \
  /Users/reus/.openclaw/workspace/skills/wishket-crawler
```

Expected output:
- ✅ SKILL.md exists with valid frontmatter
- ✅ scripts/ directory exists with 3 files
- ✅ No extraneous files (no README, CHANGELOG, etc.)
- ✅ Total size under skill limit

## 12. Future Enhancements

Potential improvements for future iterations:

- **Multi-page crawling:** Increase beyond 20 projects
- **Email notifications:** Send digest to team email
- **Historical tracking:** Analyze project trends over time
- **Auto-apply:** Integrate with Wishket API to auto-apply to high-scoring projects
- **Machine learning:** Use past project outcomes to refine scoring weights
- **Competitor analysis:** Track which competitors are applying to same projects
