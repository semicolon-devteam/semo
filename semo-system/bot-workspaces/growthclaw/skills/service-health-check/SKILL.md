---
name: service-health-check
description: Check HTTP status for Semicolon services and alert on failures. Use when service-health-check cron triggers (every 30 minutes).
---

# Service Health Check

## Target URLs
1. 정치판: https://jungchipan.net
2. 액소라클: https://axoracle.com
3. 베베케어: https://bebecare.semi-colon.space
4. 링크타: https://site-ranking.info

## Rules
- 200 OK → no action
- Anything else → send to Slack `#bot-ops` (C0AFBQ209E0):
  ```
  🚨 [헬스체크 경고] {서비스명} 이상 감지
  • URL: {url}
  • 상태: {status_code or error message}
  • 시각: {현재시각 KST}
  ```
- All healthy → exit silently
