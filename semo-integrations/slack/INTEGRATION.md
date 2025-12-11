# SEMO Integration: Slack

> Slack 연동 (알림, 피드백)

**위치**: `semo-integrations/slack/`
**Layer**: Layer 2 (External Connections)

---

## 개요

Slack Webhook 및 API를 활용한 팀 커뮤니케이션 연동을 제공합니다.

---

## 하위 모듈

| 모듈 | 역할 | 주요 기능 |
|------|------|----------|
| **notify** | 알림 전송 | 작업 완료, 버저닝, 에러 알림 |
| **feedback** | 피드백 수집 | 사용자 피드백 → GitHub Issue 연동 |

---

## 사용 예시

### 알림 전송

```
사용자: 슬랙에 알려줘

[SEMO] Integration: slack/notify 호출

curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"..."}' \
  $SLACK_WEBHOOK_URL
```

### 피드백 수집

```
사용자: /SEMO:feedback 버그가 있어요

[SEMO] Integration: slack/feedback 호출
[SEMO] Integration: github/issues 호출 (연동)
```

---

## 환경 변수

| 변수 | 용도 | 필수 |
|------|------|------|
| `SLACK_WEBHOOK_URL` | Webhook URL | ✅ |
| `SLACK_CHANNEL` | 기본 채널 | ❌ |

---

## 채널 매핑

| 용도 | 채널 |
|------|------|
| 일반 알림 | `#_협업` |
| 에러 알림 | `#_에러` |
| 피드백 | `#_피드백` |

---

## 매핑 정보 (SAX → SEMO)

| 기존 패키지 | 기존 스킬 | 새 위치 |
|-------------|----------|---------|
| sax-core | notify-slack | slack/notify |
| sax-core | feedback (Slack 부분) | slack/feedback |

---

## 참조

- [SEMO Principles](../../semo-core/principles/PRINCIPLES.md)
- [Slack Webhooks](https://api.slack.com/messaging/webhooks)
