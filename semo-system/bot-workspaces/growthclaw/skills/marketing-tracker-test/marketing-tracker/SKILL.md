---
name: marketing-tracker
description: Track promotional post performance across Korean communities (Naver Cafe, FMKorea, DCInside, Clien) and Reddit. Monitors view counts, likes, comments, and detects post deletion with 7-day automated tracking. Use when the user wants to track marketing or promotional posts, monitor 홍보글 performance, check if posts were deleted, generate marketing performance reports, or batch-register multiple URLs for tracking. Triggers on requests like "홍보 성과 추적", "마케팅 트래킹", "성과 리포트", or any community post monitoring needs.
---

# Marketing Tracker

Track promotional posts across communities with automated 7-day monitoring, deletion detection, and performance reporting.

## Core Script

All operations use `scripts/tracker.py`:

```bash
python3 scripts/tracker.py add <url1> [url2] ...    # URL 등록 (배치)
python3 scripts/tracker.py check                     # 스케줄 기반 성과 체크
python3 scripts/tracker.py check --force             # 즉시 체크
python3 scripts/tracker.py report [--days N]         # 리포트 (기본 7일)
python3 scripts/tracker.py status                    # 현재 추적 현황
python3 scripts/tracker.py remove <url>              # 추적 중단
```

## Workflow

### 1. URL 등록
User가 URL을 제공하면 `tracker.py add`로 등록. 여러 URL 한번에 가능.

```bash
python3 scripts/tracker.py add "https://cafe.naver.com/example/123" "https://www.fmkorea.com/456"
```

### 2. 자동 추적 스케줄
등록 후 cron으로 자동 체크 설정:

```json
{
  "name": "marketing-check",
  "schedule": {"kind": "cron", "expr": "0 */2 * * *", "tz": "Asia/Seoul"},
  "payload": {"kind": "exec", "command": "python3 scripts/tracker.py check"}
}
```

**스케줄 로직 (스크립트 내장):**
- **Day 1**: 1.5시간 간격 3회 체크
- **Day 2-7**: 일일 1회 체크
- **7일 후**: 자동 아카이브

### 3. 삭제 감지
스크립트가 자동 구분:
- **HTTP 404/410** → 삭제 확정
- **삭제 마커 텍스트** → 삭제 확정  
- **네트워크 에러** → 삭제 아님 (consecutive_errors 카운트)
- **파싱 실패** → 삭제 아님 (메트릭 0으로 기록)

삭제 감지 시 `deleted/` 디렉토리에 아카이브 저장. 이벤트 리턴하므로 알림 발송 가능.

### 4. 댓글 분석
`comment_texts`가 수집되면 LLM으로 감정 분석 수행. 상세: `references/sentiment-analysis.md`

### 5. 리포트
```bash
python3 scripts/tracker.py report --days 7
```
커뮤니티별 성과, Top 5, 삭제 분석 포함.

## Data Storage

환경변수 `MARKETING_TRACKER_DATA`로 데이터 디렉토리 지정. 미설정 시 `scripts/../data/` 사용.

```
data/
├── tracking.json       # 추적 URL 목록 및 상태
├── history/            # 일별 스냅샷 (YYYY-MM-DD.json)
└── deleted/            # 삭제된 글 아카이브
```

## 삭제 알림 처리

`tracker.py check`가 삭제 이벤트를 stdout에 출력. 에이전트가 실행 후 출력을 읽고 Slack 등으로 알림:

```
⚠️  이벤트 발생:
  - deletion: [fmkorea] https://fmkorea.com/123 (생존 4.2h)
```

이 출력을 파싱해서 적절한 채널에 알림 전송.

## References

- `references/community-guide.md` — 커뮤니티별 접근 방법, 파싱 특성, 홍보 팁
- `references/sentiment-analysis.md` — LLM 기반 감정 분석 프롬프트 및 키워드 목록

## Limitations

- Naver Cafe 비공개 카페는 로그인 없이 접근 불가 (모바일 URL로 공개 카페만 지원)
- FMKorea/DCInside는 Cloudflare 차단 가능 — best effort, 실패 시 graceful 처리
- Reddit은 .json API로 안정적이나 rate limit 주의
- 파서는 HTML 구조 변경 시 업데이트 필요 — 0 리턴 시 수동 확인 권장
