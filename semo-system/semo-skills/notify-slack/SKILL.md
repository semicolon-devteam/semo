---
name: notify-slack
description: |
  Slack 알림 전송. Use when (1) "슬랙에 알려줘", "알림 보내줘",
  (2) 작업 완료 알림, (3) 에러 알림.
tools: [mcp__semo-integrations__slack_send_message, mcp__semo-integrations__slack_lookup_user, Read]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: notify-slack` 시스템 메시지를 첫 줄에 출력하세요.

# notify-slack Skill

> Slack 알림 전송 자동화

## Trigger Keywords

- "슬랙에 알려줘", "알림 보내줘"
- "팀에 공유해줘"
- "완료 알림"

---

## 🔴 팀원 조회 규칙 (NON-NEGOTIABLE)

> **⚠️ 메시지 대상자가 명확하지 않으면 반드시 team-members 레퍼런스를 참조합니다.**

### 대상자 조회 워크플로우

```text
1. 대상자 정보 확인
   ↓
2. GitHub ID만 알고 있는 경우
   → packages/core/_shared/team-members.md 참조
   → GitHub ID → Slack Display Name 매핑 확인
   ↓
3. Slack Display Name으로 사용자 조회
   → mcp__semo-integrations__slack_lookup_user 호출
   ↓
4. 조회 실패 시
   → team-members.md의 하드코딩된 Slack ID 사용 (폴백)
```

### 레퍼런스 파일

| 파일 | 용도 |
|------|------|
| `packages/core/_shared/team-members.md` | GitHub ID ↔ Slack 매핑 테이블 |

### 역할별 기본 대상자

| 역할 | 담당자 | Slack Name | 알림 상황 |
|------|--------|------------|----------|
| QA | 고권희 | Goni | 테스트 요청, 버그 리포트 |
| PO | 노영록 | Roki | Epic 생성, 요구사항 확인 |
| FE Lead | 전준영 | Reus | 프론트엔드 코드 리뷰 |
| BE Lead | 강용준 | kyago | 백엔드 코드 리뷰 |
| Infra | 서정원 | Garden | 인프라/배포 관련 |
| Design | 염현준 | Yeomso | 디자인 리뷰 |

---

## 사용법

```
mcp__semo-integrations__slack_send_message
- text: "메시지 내용"
- channel: "#채널명" (선택)
```

### 멘션 포함 시

```
1. Slack ID 조회
   mcp__semo-integrations__slack_lookup_user(name: "Reus")
   → <@URSQYUNQJ>

2. 메시지 전송
   mcp__semo-integrations__slack_send_message(
     channel: "#_협업",
     text: "<@URSQYUNQJ> 확인 부탁드립니다."
   )
```
