---
name: notify-slack
description: |
  Slack 알림 전송 (채널 자동 매칭, 사용자 멘션 지원).
  Use when (1) "슬랙에 알려줘", "알림 보내줘",
  (2) 작업 완료 알림, (3) 에러 알림, (4) 팀원 멘션.
tools: [mcp__semo-integrations__slack_send_message, mcp__semo-integrations__slack_lookup_user]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: notify-slack` 시스템 메시지를 첫 줄에 출력하세요.

# notify-slack Skill

> Slack 알림 전송 자동화 (채널 자동 매칭 + 사용자 멘션)

## 사용 도구

```
mcp__semo-integrations__slack_send_message
- text: "메시지 내용"
- channel: "#채널명" (선택, 기본: #_협업)

mcp__semo-integrations__slack_lookup_user
- name: "Slack Display Name"
```

---

## 🔴 채널 자동 매칭 (channel_not_found 대응)

> **⚠️ 채널을 찾을 수 없을 때 사용자에게 묻지 말고, 유사 채널을 자동으로 찾아 전송합니다.**

### 채널 매칭 전략

```text
1. 정확한 채널명으로 전송 시도
   └→ 성공 → 완료

2. channel_not_found 오류 발생
   │
   ├→ Step 1: 접두사 정규화
   │   "#_ms-media-processor" → "ms-media-processor"
   │   "#ms-media-processor" → "ms-media-processor"
   │
   ├→ Step 2: 알려진 채널 매핑 확인
   │   (아래 채널 매핑 테이블 참조)
   │
   └→ Step 3: 사용자에게 채널 선택 요청 (최후 수단)
```

### 채널 매핑 테이블

| 입력 패턴 | 실제 채널 | 설명 |
|----------|----------|------|
| `_협업`, `협업` | `#_협업` | 기본 협업 채널 |
| `ms-*`, `microservice` | `#ms-{service}` | 마이크로서비스 채널 |
| `cm-*`, `land`, `office` | `#cm-{project}` | 프로젝트 채널 |
| `dev`, `개발` | `#_개발` | 개발 채널 |

### 자동 매칭 동작

```markdown
[SEMO] Skill: notify-slack

## 채널 전송 시도
- 요청 채널: #_ms-media-processor
- 결과: ❌ channel_not_found

## 채널 자동 매칭
- 정규화: "ms-media-processor"
- 매칭된 채널: #ms-media-processor
- 결과: ✅ 전송 완료
```

---

## 🔴 GitHub → Slack 사용자 멘션

> **팀원 매핑**: [semo-core/_shared/team-members.md](../../semo-core/_shared/team-members.md) 참조

### 매핑 테이블 (빠른 참조)

| GitHub ID | Slack Display Name | 역할 |
|-----------|-------------------|------|
| reus-jeon | Reus | 프론트/리더 |
| garden92 | Garden | 인프라/리더 |
| kokkh | Goni | QA |
| kyago | kyago | 백엔드/리더 |
| Roki-Noh | Roki | PO/리더 |
| Brightbong92 | bon | 프론트 |
| gtod8010 | dwight.k | 프론트 |
| Yeomsoyam | Yeomso | 디자인/리더 |

### 멘션 워크플로우

```text
1. GitHub ID 확인 (예: "kokkh")

2. Slack Display Name 조회
   → team-members.md에서 "kokkh" → "Goni"

3. Slack User ID 조회
   → mcp__semo-integrations__slack_lookup_user(name: "Goni")
   → SLACK_ID 반환

4. 멘션 형식 생성
   → "<@{SLACK_ID}>"
```

### 사용 예시

```markdown
[SEMO] Skill: notify-slack

## 사용자 멘션 준비
- GitHub ID: kokkh
- Slack Name: Goni
- Slack ID: U09NRR79YCW

## 메시지 전송
채널: #_협업
내용: <@U09NRR79YCW> 테스트 요청드립니다.

✅ 전송 완료
```

---

## 출력 포맷

### 성공

```markdown
[SEMO] Skill: notify-slack

✅ 메시지 전송 완료
- 채널: #_협업
- 내용: {message_preview}
```

### 채널 자동 매칭 후 성공

```markdown
[SEMO] Skill: notify-slack

⚠️ 채널 자동 매칭
- 요청: #_ms-media-processor
- 매칭: #ms-media-processor

✅ 메시지 전송 완료
```

### 실패 (채널 없음)

```markdown
[SEMO] Skill: notify-slack

❌ 전송 실패: 채널을 찾을 수 없습니다.
- 요청 채널: #nonexistent-channel

💡 사용 가능한 채널을 선택해주세요:
1. #_협업 (기본)
2. #_개발
3. #cm-land
```

---

## 🔴 프로젝트 채널 연동

> **레포지토리별 프로젝트 채널로 알림 전송**
>
> 📖 **설정 참조**: [project-channels.md](../../semo-core/_shared/project-channels.md)

### 채널 결정 로직

```text
1. 요청에 채널 지정 → 해당 채널 사용
2. 레포지토리 정보 있음 → 프로젝트 채널 조회
3. 프로젝트 채널 없음 → #_협업 (기본)
```

### 프로젝트 채널 매핑 (빠른 참조)

| 레포지토리 | Slack 채널 |
|-----------|-----------|
| mvp-link-collect | #mvp-link-collect |
| cm-land | #cm-land |
| cm-office | #cm-office |
| semo | #_협업 |

> 전체 목록: [project-channels.md](../../semo-core/_shared/project-channels.md)

---

## Related

- [team-members.md](../../semo-core/_shared/team-members.md) - GitHub ↔ Slack 매핑
- [project-channels.md](../../semo-core/_shared/project-channels.md) - 프로젝트별 Slack 채널 매핑
- [check-feedback Skill](../check-feedback/SKILL.md) - 피드백 알림 시 멘션
