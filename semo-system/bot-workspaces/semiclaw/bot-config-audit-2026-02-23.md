# 봇 설정 감사 보고 (2026-02-23 16:37)

## 요청사항
1. 봇들이 서로 Slack 멘션으로 임의 업무 인계하는 원인 조사
2. ReviewClaw가 리뷰 후 자동 머지하는 설정 확인 (리뷰만 해야 함)

---

## 1️⃣ ReviewClaw 자동 머지 문제

### 현재 설정 (문제 있음)

**위치**: `~/.openclaw-reviewclaw/workspace/SOUL.md`, `AGENTS.md`

```markdown
### ✅ 내가 하는 것
- PR 리뷰 전담 (컨벤션, 보안, 성능)
- Approve 후 머지 권한 (머지는 내 Approve 후에만)  ← 🚨 문제
```

- 명시: "Approve 후 머지 권한"
- 출처: "2026-02-17 Reus 승인 R&R 규칙"이라고 기록됨
- 실제 동작: approve 후 즉시 머지 또는 auto-merge 설정

### 실제 동작 증거 (채팅 히스토리)
```
ReviewClaw: "Approve → 즉시 머지 완료"
ReviewClaw: "Auto-merge 설정 완료"
ReviewClaw: "Approved → 머지 완료"
```

### 현재 Reus 요구사항
> "리뷰 이후에 왜 자꾸 머지 처리하는지... 리뷰까지만 진행하고 임의로 머지해선 안됨"

### 권장 조치
ReviewClaw SOUL.md & AGENTS.md 수정:
```diff
- Approve 후 머지 권한 (머지는 내 Approve 후에만)
+ PR 리뷰 및 Approve까지만 (머지 권한 없음)
```

---

## 2️⃣ 봇 간 Slack 멘션 인계 문제

### 문서 간 충돌

#### A. github-rules.md (2026-02-20 승인)
```markdown
## 순수 라벨+폴링 인계 규칙 (2026-02-20 승인)
**원칙: 봇 간 직접 Slack 멘션 인계 전면 폐기. 라벨 전환 → 폴링 감지만 허용.**

## ~~봇 간 정보 공유 (Slack 멘션)~~ → 폐기 (2026-02-20)
> **폐기됨.** 정보 요청도 GitHub 이슈 (`bot:info-req` 라벨) 경유.
```

#### B. 각 봇 AGENTS.md (여전히 Slack 멘션 사용)

**ReviewClaw AGENTS.md**:
```markdown
## 역할 외 업무 인계 프로토콜 (중앙화 라우팅)
- 🔴 내가 안 하는 것 요청이 오면 → 무조건 `#bot-ops`에서 <@U0ADGB42N79>(SemiClaw)에게 인계
```

**WorkClaw AGENTS.md**:
```markdown
1. 요청자에게 간단히 안내
2. `#bot-ops`에 `<@U0ADGB42N79>` (SemiClaw) 멘션 + 공유
3. SemiClaw가 적절한 봇에게 위임
```

**GrowthClaw AGENTS.md**:
```markdown
### 라벨 전환 후 Slack 멘션 (즉시 알림)
- 다음 담당 봇에게 #bot-ops 멘션
```

### 실제 Slack 활동 증거
최근 #bot-ops 채널:
- PlanClaw: `[bot:info-req] <@U0ADGB42N79> 정치판 프로젝트...`
- GrowthClaw: `<@U0ADGB42N79> [follow-up] 정치판 프로젝트 정보 요청...`
- ReviewClaw: `<@U0AFPDMCGHX> 배포 모니터링 요청` (InfraClaw 멘션)

### 권장 조치
1. **모든 봇 AGENTS.md 업데이트**: Slack 멘션 인계 프로토콜 전부 삭제
2. **github-rules.md 기준 준수**: 라벨+폴링만 사용
3. **예외**: `bot:blocked` 시 SemiClaw에게 Slack 알림만 허용 (긴급 상황)

---

## 3️⃣ 폴링 자동화 구현 상태

### github-rules.md 명시사항
| 봇 | 주기 | 쿼리 |
|---|---|---|
| PlanClaw | 10분 | `label:bot:needs-spec -label:bot:in-progress` |
| WorkClaw | 5분 | `label:bot:spec-ready -label:bot:in-progress` |
| ReviewClaw | 5분 | `is:pr is:open review:none` |
| SemiClaw | 15분 | `label:bot:blocked`, `label:bot:done` |

### 실제 크론잡 상태 (조사 결과)
```bash
SemiClaw: 크론잡 0개
WorkClaw: 크론잡 0개
PlanClaw: 크론잡 0개
ReviewClaw: 크론잡 0개
GrowthClaw: 크론잡 0개
DesignClaw: 크론잡 0개
InfraClaw: 크론잡 0개
```

### Gap 분석
- 문서: 폴링 자동화 명시
- 실제: 크론잡 미구현
- 추정: 봇들이 수동으로 폴링 또는 HEARTBEAT 사용 (확인 불가)

### 권장 조치
각 봇에 OpenClaw 크론잡 설정:
```json
{
  "cron": {
    "jobs": [
      {
        "name": "GitHub 폴링 (bot:spec-ready)",
        "schedule": { "kind": "every", "everyMs": 300000 },
        "payload": { "kind": "agentTurn", "message": "GitHub 폴링: label:bot:spec-ready 이슈 확인 후 작업" },
        "sessionTarget": "isolated"
      }
    ]
  }
}
```

---

## 요약 및 권장 액션

| 문제 | 현상 | 원인 | 조치 |
|---|---|---|---|
| ReviewClaw 자동 머지 | approve 후 즉시 머지 | SOUL.md에 "머지 권한" 명시 | SOUL.md 수정: 리뷰만, 머지 금지 |
| 봇 간 Slack 멘션 | #bot-ops 멘션 인계 빈번 | AGENTS.md에 Slack 인계 프로토콜 존재 | 모든 봇 AGENTS.md에서 멘션 인계 삭제 |
| 폴링 자동화 부재 | 크론잡 0개 | github-rules.md와 실제 구현 gap | 각 봇에 크론잡 추가 |

## 다음 단계
1. Reus 승인 대기
2. 승인 후 각 봇 설정 일괄 업데이트
3. 업데이트 후 #bot-ops에 공지
