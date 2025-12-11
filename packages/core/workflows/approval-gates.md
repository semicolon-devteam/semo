# Human-in-the-Loop: Approval Gates

> 중요 변경사항에 대한 인간 승인 게이트 워크플로우

---

## Overview

Human-in-the-Loop(HITL)은 AI 에이전트가 특정 위험도 이상의 작업을 수행할 때 인간의 승인을 요구하는 안전장치입니다.

### 핵심 원칙

```
모든 AI 결정은 되돌릴 수 있어야 한다 (Reversible by Default)
위험한 작업은 인간이 승인해야 한다 (Human Approval for Risk)
```

---

## Approval Gate 트리거

### 위험도 분류

| Level | 설명 | 승인 요구 | 예시 |
|-------|------|----------|------|
| **CRITICAL** | 되돌리기 어려운 변경 | 필수 | DB 스키마 변경, 프로덕션 배포 |
| **HIGH** | 광범위한 영향 | 권장 | API 계약 변경, 인증 로직 수정 |
| **MEDIUM** | 제한적 영향 | 선택 | 컴포넌트 리팩토링, 테스트 추가 |
| **LOW** | 최소 영향 | 불필요 | 오타 수정, 주석 추가 |

### 자동 트리거 조건

```yaml
approval_triggers:
  # CRITICAL - 항상 승인 필요
  - pattern: "migration/*.sql"
    level: CRITICAL
    reason: "데이터베이스 마이그레이션"

  - pattern: ".github/workflows/*.yml"
    level: CRITICAL
    reason: "CI/CD 파이프라인 변경"

  - pattern: "**/auth/**"
    level: CRITICAL
    reason: "인증/인가 로직 변경"

  - pattern: "package.json"
    changes: ["dependencies", "devDependencies"]
    level: HIGH
    reason: "의존성 변경"

  # HIGH - 검토 권장
  - pattern: "**/api/**"
    level: HIGH
    reason: "API 엔드포인트 변경"

  - pattern: "**/*.env*"
    level: CRITICAL
    reason: "환경 변수 변경"

  # 파일 수 기반
  - condition: "files_changed > 10"
    level: HIGH
    reason: "대규모 변경 (10개 이상 파일)"

  # 라인 수 기반
  - condition: "lines_changed > 500"
    level: HIGH
    reason: "대규모 변경 (500줄 이상)"
```

---

## 승인 워크플로우

### 1. 승인 요청 생성

```markdown
[SEMO] ⚠️ Approval Required

## 변경 요약
- **위험도**: CRITICAL
- **이유**: 데이터베이스 마이그레이션
- **영향 범위**: users 테이블 스키마 변경

## 변경 내용
| 파일 | 변경 유형 | 라인 |
|------|----------|------|
| migrations/001_add_user_role.sql | 추가 | +25 |

## 영향 분석
- 기존 users 테이블에 `role` 컬럼 추가
- 기본값: 'user'
- NOT NULL 제약조건 포함
- 롤백 스크립트 포함됨 ✓

## 승인 옵션
- ✅ `/approve` - 변경 승인
- ❌ `/reject [이유]` - 변경 거부
- 🔍 `/review` - 상세 리뷰 요청
- ⏸️ `/defer` - 나중에 검토
```

### 2. 승인 상태 추적

```json
{
  "approval_id": "apr-{uuid}",
  "status": "pending", // pending | approved | rejected | deferred
  "requested_at": "2025-12-11T10:00:00Z",
  "requested_by": "semo-agent",
  "risk_level": "CRITICAL",
  "trigger": "migration/*.sql",
  "changes": [
    {
      "file": "migrations/001_add_user_role.sql",
      "type": "add",
      "lines": 25
    }
  ],
  "approver": null,
  "approved_at": null,
  "comments": []
}
```

### 3. 승인 후 처리

```yaml
on_approved:
  - action: proceed_with_changes
  - action: log_approval
    metadata:
      approver: "{{approver}}"
      timestamp: "{{timestamp}}"
  - action: notify_slack
    channel: "#semo-approvals"
    message: "✅ 변경 승인됨: {{summary}}"

on_rejected:
  - action: rollback_changes
  - action: log_rejection
    metadata:
      rejector: "{{rejector}}"
      reason: "{{reason}}"
  - action: notify_slack
    channel: "#semo-approvals"
    message: "❌ 변경 거부됨: {{reason}}"
```

---

## Slack 통합

### 승인 요청 메시지

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "⚠️ SEMO Approval Required"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Risk Level:*\n🔴 CRITICAL"
        },
        {
          "type": "mrkdwn",
          "text": "*Trigger:*\nDB Migration"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Changes:*\n```migrations/001_add_user_role.sql (+25)```"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "✅ Approve" },
          "style": "primary",
          "action_id": "approve_change"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "❌ Reject" },
          "style": "danger",
          "action_id": "reject_change"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "🔍 Review" },
          "action_id": "review_change"
        }
      ]
    }
  ]
}
```

### 승인 채널 설정

```yaml
slack_channels:
  approvals: "#semo-approvals"
  critical_alerts: "#semo-critical"

notification_rules:
  CRITICAL:
    channels: ["approvals", "critical_alerts"]
    mention: "@channel"
  HIGH:
    channels: ["approvals"]
    mention: "@here"
  MEDIUM:
    channels: ["approvals"]
    mention: null
```

---

## 타임아웃 정책

### 승인 대기 시간

| 위험도 | 대기 시간 | 타임아웃 액션 |
|--------|----------|--------------|
| CRITICAL | 무제한 | 작업 보류 |
| HIGH | 24시간 | 알림 재전송 |
| MEDIUM | 4시간 | 자동 승인 (설정 시) |
| LOW | - | 승인 불필요 |

### 에스컬레이션

```yaml
escalation:
  - after: 1h
    action: remind
    message: "승인 대기 중: {{summary}}"

  - after: 4h
    action: escalate
    to: "tech-lead"
    message: "긴급 승인 필요: {{summary}}"

  - after: 24h
    action: escalate
    to: "engineering-manager"
    message: "장기 미승인 건: {{summary}}"
```

---

## 승인 우회 (Emergency Override)

### 긴급 상황 처리

```markdown
[SEMO] 🚨 Emergency Override Requested

## 요청자
- **이름**: {{requester}}
- **역할**: Tech Lead

## 사유
- **유형**: Production Incident
- **심각도**: P1
- **티켓**: JIRA-1234

## 우회 내용
- 승인 게이트: DB Migration
- 정상 승인자: @garden92
- 우회 사유: 프로덕션 장애 긴급 대응

## 감사 로그
- 우회 요청: {{timestamp}}
- 사후 검토 필수: ✓
```

### 우회 조건

```yaml
emergency_override:
  allowed_roles:
    - tech-lead
    - engineering-manager
    - on-call-engineer

  required_fields:
    - incident_ticket
    - justification
    - post_mortem_required: true

  audit:
    log_to: "audit-log"
    notify: ["security-team", "engineering-manager"]
    review_within: "24h"
```

---

## Skill: approval-gate

### 트리거

- Agent가 위험 작업 감지 시 자동 호출
- `/SEMO:approve` 수동 호출

### 인터페이스

```yaml
name: approval-gate
version: "1.0.0"

inputs:
  risk_level: string  # CRITICAL | HIGH | MEDIUM | LOW
  changes: array      # 변경 파일 목록
  reason: string      # 트리거 사유
  auto_approve: boolean  # 자동 승인 허용 여부 (MEDIUM 이하)

outputs:
  status: string      # approved | rejected | pending | timeout
  approver: string    # 승인자
  timestamp: string   # 승인 시각
  comments: array     # 승인/거부 코멘트
```

### 사용 예시

```markdown
[SEMO] Skill: approval-gate 호출

## 입력
- Risk Level: HIGH
- Changes: 5 files (API endpoints)
- Reason: API contract changes

## 출력
- Status: approved
- Approver: garden92
- Timestamp: 2025-12-11T10:30:00Z
- Comments: "LGTM, API 변경 확인했습니다."
```

---

## 구현 로드맵

### Phase 1: 기본 구현 (현재)

- [x] Approval Gate 설계 문서
- [ ] 위험도 분류 로직
- [ ] Slack 알림 연동

### Phase 2: 워크플로우 자동화

- [ ] 자동 트리거 감지
- [ ] 승인 상태 추적
- [ ] 타임아웃 처리

### Phase 3: 고급 기능

- [ ] 에스컬레이션 체인
- [ ] Emergency Override
- [ ] 감사 로그 대시보드

---

## References

- [LangFuse 관측성 설정](../observability/langfuse-config.md)
- [Self-Learning RAG](../rag/feedback-index.md)
- [SEMO → SEMO 전환 계획](../../.claude/plans/prancy-scribbling-falcon.md)
