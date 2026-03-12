# Common Context Template

> Inject this context into every new bot. Send via Slack DM and instruct the bot to save to appropriate memory files.

## Team Info

```markdown
## 팀 Semicolon
- 시니어 엔지니어 팀, 풀스택 (웹, 앱, 인프라)
- GitHub 조직: semicolon-devteam
- 주요 스택: TypeScript(프론트/서비스), Kotlin/Spring Boot(백엔드), HCL(인프라), Supabase, React Native
```

## Team Members

```markdown
## 팀원 (닉네임 → Slack ID → 역할)
- Reus (URSQYUNQJ) — 프론트 리드/팀 리더
- Garden (URU4UBX9R) — 시스템 아키텍처
- Yeomso (U01KH8V6ZHP) — 디자인/CMO/SI매니저
- Roki (U08P11ZQY04) — 서비스총괄/그로스
- bon (U09LF7ZS5GR) — 랜드/오피스 풀스택
- kyago (U02G8542V9U) — 백엔드 리더
- Bae (U0A54SCQS84) — 인프라/백엔드
- Harry Lee (U08PB15P4AV) — 시니어 FE
- Goni (U09NRR79YCW) — 오피스 운영/QA
- Kai (U0A4W1U0BAN) — 견습 엔지니어
- dwight.k (U01KNHM6PK3) — 외부 협업자
```

## Bot ID Mapping

```markdown
## 봇 ID 매핑
| 봇 | Slack ID | 역할 |
|---|---|---|
| SemiClaw | U0ADGB42N79 | PM/오케스트레이터 |
| WorkClaw | U0AFECSJHK3 | 코딩/작업 |
| ReusClaw | U0ADF0JUU79 | Reus 전용 (별개 PC) |
| PlanClaw | U0AFNMGKURX | 기획 |
| ReviewClaw | U0AF1RK0E67 | PR 리뷰 |
| DesignClaw | U0AFC0MK2TY | 디자인 |
| GrowthClaw | U0AFALA3EF7 | 그로스/마케팅 |
| InfraClaw | U0AFPDMCGHX | 인프라/CI/CD |
```

## Security Classification

```markdown
## 보안 분류
| 등급 | 예시 | 공유 범위 |
|---|---|---|
| 🔴 극비 | 계약금액, 지분율, 급여 | ReusClaw만 (Reus DM) |
| 🟡 대외비 | cm-land/cm-office 상세 | 내부 봇만, 외부 공유 X |
| 🟢 공개 | 레포 구조, 기술 스택 | 모든 봇 |
```

## Bot Communication Rules

```markdown
## 봇 간 소통 규칙 (필수)
1. **🔴 봇에게 답변/이야기할 때 반드시 @멘션 사용** — 멘션 없으면 상대 봇이 메시지를 인지하지 못함
   - 예: `<@U0ADGB42N79> 확인 완료!` (O) / `확인 완료!` (X)
2. **#bot-ops 채널 (C0AFBQ209E0)**: 봇 간 조율/상태 공유 전용
3. **SemiClaw이 오케스트레이터**: 복잡한 작업은 세미클로가 분배
4. **결과만 보고** — 중간 과정 보고 금지, 최종 결과만
5. **역할 외 요청 → #bot-ops에서 SemiClaw 멘션 → 인계**

## Config 안전 규칙
1. `config.apply` 절대 사용 금지 → 반드시 `config.patch`만 사용
2. 게이트웨이 재시작은 #bot-ops에 사전 공지 후 진행
3. config 변경 전 `config.get`으로 현재 상태 확인
4. 토큰/시크릿 관련 필드는 절대 건드리지 않기
```

## Channel Settings

```markdown
## 필수 채널 설정 (openclaw.json)
channels:
  slack:
    groupPolicy: "open"           # 모든 채널에서 응답 (allowlist 절대 X)
    allowBots: true               # 다른 봇 메시지 수신 허용
    channels:
      C0AFBQ209E0:                # #bot-ops
        allowBots: true           # 봇 간 대화 채널
plugins:
  entries:
    slack:
      enabled: true               # 명시적 활성화 필수
messages:
  ackReaction: "eyes"             # 멘션 시 👀 자동 리액션
  ackReactionScope: "all"         # DM + 그룹 + 스레드 전부
```

## Memory Structure Guide

```markdown
## 메모리 구조 (필수)
MEMORY.md                    ← 슬림 인덱스 (< 50줄, 핵심 요약 + 파일 포인터만)
memory/
  decisions.md               ← Reus/리더 의사결정, 원칙, 교육 내용
  team.md                    ← 팀원 정보, R&R
  bots.md                    ← 봇 아키텍처, ID 매핑, 봇 간 R&R
  operations.md              ← 루틴, 캘린더, 도구
  projects/                  ← 프로젝트별 상세
  YYYY-MM-DD.md              ← 일일 로그

### 원칙
- MEMORY.md는 슬림 인덱스 — 상세 내용은 memory/ 하위 파일로 분리
- 교육받은 내용은 즉시 적절한 파일에 기록 (대화에서 "알겠어"만 하고 끝내지 않기)
- 매 세션 시작 시 SOUL.md + MEMORY.md + 오늘/어제 daily note 읽기
```
