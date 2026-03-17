# bots.md — 봇 아키텍처

## 📢 봇 운영 원칙 (Reus 지시, 2026-02-23)
### ❌ 금지: 작업 로그 하나하나 찍기
- "1. logger.ts 수정", "2. sessionManager.ts 수정" 같은 중간 과정 보고 금지

### ✅ 원칙: 결과만 보고
- 작업 완료 후 **최종 결과 한 번에 보고**
- 예: "core-backend #123 구현 완료 → PR #456 생성"

### ⚠️ 예외
- **블로커 발생 시에만** 즉시 보고 (작업 중단 상황)

---

## 봇 팀 ID (SemiClaw 공식 매핑, 최종 업데이트: 2026-03-09)
| 봇 | Slack ID | 비고 |
|---|---|---|
| SemiClaw | U0ADGB42N79 | PM/오케스트레이터 |
| WorkClaw | U0AFECSJHK3 | 풀스택 구현 |
| ReusClaw | U0ADF0JUU79 | Reus 개인 어시스턴트 (별개 PC 독립 운영) |
| PlanClaw | U0AFNMGKURX | PO/기획 |
| ReviewClaw | U0AF1RK0E67 | 코드 리뷰/QA |
| DesignClaw | U0AFC0MK2TY | 디자인 전담 |
| GrowthClaw | U0AFALA3EF7 | 그로스/마케팅 |
| InfraClaw | U0AFPDMCGHX | 인프라/DevOps/배포 |
| Reus (사람) | URSQYUNQJ | 리더 |
| #bot-ops | C0AFBQ209E0 | 봇 간 공지 채널 |

## NON-NEGOTIABLE: 봇 간 통신 규칙
- ❌ **봇 간 Slack 직접 멘션 인계 전면 금지**
- ✅ **GitHub 이슈 라벨+폴링 방식만 사용**
- 👀 멘션 시 이모지는 게이트웨이 자동 처리 (수동 대응 불필요)

### ⚠️ 정책 예외 (2026-03-07 Reus 승인)
- **InfraClaw에 한해** Slack 멘션 직접 인계/협업 허용
- 사유: 인프라 긴급 장애 대응 시 실시간 커뮤니케이션 필요
- InfraClaw 외 다른 봇 간에는 여전히 GitHub 이슈 라벨+폴링만 사용

---

## 봇 간 인계 방식 (2026-03-07 변경, Reus 승인)

> **봇 간 Slack 멘션 직접 인계/협업 허용 + GitHub 라벨+폴링 병행**

### 라벨 체인
`bot:needs-spec` → `bot:spec-ready` → `bot:in-progress` → `bot:needs-review` → `bot:done`

### 라벨 전환 규칙 (2026-03-06 업데이트)
**핵심**: 라벨 전환 시 **이전 단계 라벨 반드시 제거**

- `bot:needs-spec` → `bot:spec-ready`: `bot:needs-spec` 제거
- `bot:spec-ready` → `bot:in-progress`: `bot:spec-ready` 제거
- `bot:in-progress` → `bot:needs-review`: `bot:in-progress` 제거
- `bot:in-progress` → `bot:done`: `bot:in-progress` 제거 ⚠️ **필수**
- 이슈 close 시: `bot:in-progress` 잔존 여부 확인 + 제거

### 봇별 폴링 쿼리 & 주기
| 봇 | 주기 | 쿼리 | 액션 |
|---|---|---|---|
| PlanClaw | 10분 | `label:bot:needs-spec -label:bot:in-progress` | 기획 → `bot:spec-ready` |
| WorkClaw | 5분 | `label:bot:spec-ready -label:bot:in-progress` | 구현 → PR → `bot:needs-review` |
| WorkClaw | 5분 | `is:pr is:open review:changes_requested author:app/workclaw-bot` | 리뷰 피드백 반영 → 재push |
| ReviewClaw | 5분 | `is:pr is:open review:none` | 리뷰 → approve/changes_requested |
| SemiClaw | 15분 | `label:bot:blocked` | Slack 알림 |
| SemiClaw | 15분 | `label:bot:done` | 완료 확인 + 대시보드 반영 |

### InfraClaw 행동 규칙 (2026-03-07 업데이트)
1. **GitHub Actions 워크플로우 자동 트리거** 모니터링
2. K8S Pod 상태, 배포 로그 주기적 확인
3. 배포 완료 시 → 이슈에 `bot:deploy-done` 라벨 + 코멘트
4. 배포 실패 시 → #bot-ops에 실패 알림 + 로그 링크
5. **다른 봇으로부터 Slack 멘션 수신 시**: 작업 인계/협업 요청 적극 수용

### 봇별 정보 도메인
| 봇 | 도메인 |
|---|---|
| SemiClaw (`<@U0ADGB42N79>`) | 프로젝트 현황, 팀원 정보, 일정, 의사결정 히스토리, 채널/레포 매핑 |
| PlanClaw (`<@U0AFNMGKURX>`) | 기획 문서, 기능 스펙, 유저 플로우, PRD |
| WorkClaw (`<@U0AFECSJHK3>`) | 코드 구조, 기술 스택, 구현 상세, 빌드 설정 |
| ReviewClaw (`<@U0AF1RK0E67>`) | 코드 품질, 테스트 결과, E2E 리포트, 기술 부채 |
| DesignClaw (`<@U0AFC0MK2TY>`) | UI/UX 분석, 디자인 시스템, 접근성 |
| GrowthClaw (`<@U0AFALA3EF7>`) | SEO 점수, Lighthouse, 마케팅 지표, 경쟁사 분석 |
| InfraClaw (`<@U0AFPDMCGHX>`) | 배포 상태, CI/CD, 서버 구성, 도메인, 시크릿 |

### 정보 요청 (bot:info-req)
1. 질의자: 이슈 생성 + `bot:info-req` 라벨 + 코멘트로 질문
2. 답변자: 해당 라벨 폴링 → 코멘트로 답변 → `bot:info-req` 제거
3. 답변 완료 후 이슈 즉시 close
