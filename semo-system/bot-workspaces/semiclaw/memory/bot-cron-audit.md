# 봇 크론 설정 감사 (2026-02-26)

## 감사 배경
WorkClaw 이슈 #167 분석 결과, coding-agent 미사용 + 타임아웃 부족이 작업 실패 원인으로 판명. 다른 봇들도 동일한 패턴이 있는지 검토.

## 봇별 크론 현황

### 1. WorkClaw ✅ 개선 완료
**폴링 작업**: `github-polling-spec-ready`
- **이전**: 5분 폴링, 10분 타임아웃, 직접 git 명령어
- **개선 후**: 10분 폴링, 15분 타임아웃, coding-agent 스킬 명시
- **상태**: ✅ 테스트 완료 (이슈 #173)

### 2. ReviewClaw 🟡 검토 필요
**폴링 작업**: `github-pr-review-polling`
```json
{
  "name": "github-pr-review-polling",
  "schedule": { "everyMs": 300000 },  // 5분
  "payload": {
    "timeoutSeconds": 300,  // 5분
    "message": "PR diff 확인 + 코드 리뷰 수행..."
  }
}
```

**분석**:
- 폴링 간격: 5분
- 타임아웃: 5분 (마지막 실행 102초 소요)
- 작업 특성: PR diff 확인 + 코멘트 작성 (코딩 작업 없음)
- coding-agent: 사용 안 함 (필요 없음 — 리뷰만 수행)

**권장사항**:
- 🟢 **현재 설정 유지 가능**
  - 리뷰는 코딩 작업보다 빠르고 단순
  - 타임아웃 여유 충분 (5분 중 102초 사용)
- 🟡 **모니터링 필요**
  - 대형 PR (diff 3000+ 라인) 발생 시 타임아웃 가능성
  - 연속 실패 발생 시 타임아웃 → 600초(10분)로 증가 검토

### 3. PlanClaw 🟢 정상
**폴링 작업**: `PlanClaw GitHub 폴링 - bot:needs-spec`
```json
{
  "name": "PlanClaw GitHub 폴링 - bot:needs-spec",
  "schedule": { "everyMs": 600000 },  // 10분
  "payload": {
    "timeoutSeconds": 300,  // 5분
    "message": "bot:needs-spec 이슈 조회 + 기획서 작성..."
  }
}
```

**분석**:
- 폴링 간격: 10분 ✅
- 타임아웃: 5분 (마지막 실행 29초 소요)
- 작업 특성: 이슈 분석 + 기획서 코멘트 작성
- coding-agent: 사용 안 함 (필요 없음 — 기획서 작성만)

**권장사항**:
- 🟢 **현재 설정 적정**
  - 타임아웃 여유 충분 (5분 중 29초 사용)
  - 폴링 간격 10분은 적절

### 4. DesignClaw, GrowthClaw, InfraClaw
**크론 작업**: 다양한 스케줄 작업 존재하지만 GitHub 폴링 없음

**분석**:
- DesignClaw: 주간 디자인 트렌드 리포트 (cron)
- GrowthClaw: 헬스체크(30분), 블로그 자동생성(cron), 일일 리포트
- InfraClaw: 일회성 리마인더들 (현재 disabled)
- **GitHub 폴링 작업 없음** (정상)

## 종합 권장사항

### 즉시 조치 불필요
- WorkClaw: ✅ 이미 개선 완료 (10분 폴링, 15분 타임아웃, coding-agent 사용)
- ReviewClaw: 🟢 현재 설정 적정 (5분 폴링, 5분 타임아웃, 102초 소요)
- PlanClaw: 🟢 현재 설정 적정 (10분 폴링, 5분 타임아웃, 29초 소요)
- 기타 봇: GitHub 폴링 작업 없음 (정상)

### 향후 모니터링
1. **ReviewClaw 타임아웃 모니터링**
   - `~/.openclaw-reviewclaw/cron/jobs.json`의 `state.lastDurationMs` 추적
   - 250초(4분 10초) 이상 지속 시 타임아웃 증가 검토

2. **크론 실패 알림 추가**
   - 각 봇의 크론 delivery 설정에 `mode: "announce"` 추가 고려
   - 현재 ReviewClaw는 `mode: "none"` → 실패 시 조용히 넘어감

3. **주간 크론 헬스 체크**
   - HEARTBEAT.md에 주간 체크 추가:
     ```
     매주 월요일 오전: 각 봇 크론 상태 확인
     - WorkClaw: spec-ready 폴링 성공률
     - ReviewClaw: PR 리뷰 폴링 성공률
     - 연속 실패 3회 이상 → #bot-ops 알림
     ```

## 결론

**현재 상태**: ✅ 액션 불필요
- WorkClaw 개선 완료
- ReviewClaw 정상 작동 중
- 기타 봇 폴링 없음 (정상)

**다음 단계**: 모니터링 프로세스 구축
