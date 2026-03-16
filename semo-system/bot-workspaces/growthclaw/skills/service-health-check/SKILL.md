# Service Health Check Skill

## 체크 대상 서비스

| 서비스 | URL | 비고 |
|---|---|---|
| 정치판 | https://jungchipan.net | 운영 중 |
| axoracle | https://axoracle.com | 운영 중 |

## 제외된 서비스
- ~~axoracle-dev.semi-colon.space~~ — dev 환경 없음 (Reus 확인, 2026-03-16)
- BebeCare — URL 미확인

## 헬스체크 절차

1. **HTTP 상태 확인**
   ```bash
   curl -sS -o /dev/null -w "%{http_code} (응답시간: %{time_total}s)" <URL>
   ```

2. **알림 기준** (HEARTBEAT.md 참조)
   - 트래픽 20% 이상 급락 → 즉시 알림
   - 서비스 다운 (5xx, timeout) → 즉시 알림
   - 신규 SEO 이슈 감지 → 즉시 알림

3. **리포트 형식**
   ```
   🔍 서비스 헬스체크 리포트 (YYYY-MM-DD HH:MM KST)
   
   ✅ 정상
   - 서비스명 (URL): 상태 (응답시간)
   
   ⚠️ 이슈 감지
   - 서비스명 (URL): 상태 + 조치 필요
   ```

4. **로그 기록**
   - 일일 로그: `memory/YYYY-MM-DD.md`
   - 헬스체크 로그: `memory/YYYY-MM-DD-health.md`

## 변경 이력
- 2026-03-16: axoracle-dev.semi-colon.space 제거 (dev 환경 없음, Reus 확인)
