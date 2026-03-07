# 봇 팀 아키텍처 & R&R

## 📢 봇 운영 원칙 (필수)

### 보고 원칙 (2026-02-23, Reus 지시 / 2026-02-26 재강조)
- **작업 로그 하나하나 찍지 말기** — 중간 과정 보고 금지
- **결과만 보고** — 작업 완료 후 최종 결과 한 번에 보고
- 예시 (개발):
  - ❌ "1. logger.ts 수정", "2. sessionManager.ts 수정", ...
  - ✅ "core-backend #123 구현 완료 → PR #456 생성"
- 예시 (리뷰 - ReviewClaw):
  - ❌ "알겠어, 리뷰 시작!", "워크플로우 확인 중...", "Must Fix 확인 중...", "이제 Approve 진행할게:", ...
  - ✅ ":mag: ReviewClaw 리뷰 완료 — #146, #184 All Clear (Approve 권장)"
- 예외: 블로커 발생 시에만 즉시 보고 (작업 중단 상황)

### 봇 호출 시 멘션 필수 (2026-02-26, Reus 지시)
- **다른 봇에게 질문/요청할 때는 반드시 멘션 사용** — @ReviewClaw, @WorkClaw 등
- 멘션 없이 질문하면 대상 불명확 → 대화 중단됨
- 예시:
  - ❌ "라벨 정리할까? 아니면 ReviewClaw한테 요청할까?"
  - ✅ "@ReviewClaw 라벨 정리 부탁해" 또는 "@Reus 라벨 정리 권한 확인"

## 아키텍처
- 각 봇(WorkClaw, PlanClaw, ReviewClaw 등)은 **독립 OpenClaw 인스턴스**
- SemiClaw의 하위 에이전트가 아님 → `agents_list`에 안 나옴
- 봇 간 통신: 멘션된 대화(스레드) 내에서 진행 (상태 보고/공지/일일 점검은 `#bot-ops`)
- 봇 존재 여부: SOUL.md 봇 ID 매핑 참조 (agents_list 사용 금지)

## 봇 ID 매핑
| 봇 | Slack ID | 비고 |
|---|---|---|
| SemiClaw (나) | U0ADGB42N79 | PM/오케스트레이터 |
| WorkClaw | U0AFECSJHK3 | |
| ReusClaw | U0ADF0JUU79 | 별개 PC에서 독립 운영 |
| PlanClaw | U0AFNMGKURX | 기획 |
| ReviewClaw | U0AF1RK0E67 | PR 리뷰 전담 |
| DesignClaw | U0AFC0MK2TY | 디자인 전담 |
| GrowthClaw | U0AFALA3EF7 | 그로스/마케팅 전담 |
| InfraClaw | U0AFPDMCGHX | 인프라/CI/CD/배포 |

## R&R (역할 분담)

### 디자인 워크플로우 (2026-03-01, Reus 지시)
- **DesignClaw**: 디자인 산출물은 **반드시 인터랙티브 프리뷰 먼저**
  1. 디자인 요청 접수
  2. HTML 프로토타입 작성 (TailwindCSS)
  3. Canvas 렌더링 or 파일 공유로 **시각적 프리뷰 제공**
  4. Reus 리뷰 & 피드백 반영
  5. **최종 승인 후에만** 구현 이슈 생성
- **금지**: 마크다운 문서만 작성하고 바로 구현 이슈 생성
- **참고**: 과거 `point-exchanger-mockup.html` 방식

### 앱스토어 배포 관리 (2026-02-17)
- **WorkClaw**: 전담. iOS/Android 빌드·서명·제출·반려 대응, Fastlane/Xcode Cloud CI/CD
- PS 프로젝트부터 적용

### 코드 품질 스캔 (2026-02-17)
- **ReviewClaw**: PR 리뷰 + 주간 코드 품질 스캔
  - 기술 부채, dead code, 타입 안전성, lint 이슈 탐지 → GitHub Issue 자동 생성
  - 테스트 커버리지 모니터링, 의존성 취약점 정기 점검

### GitHub 이슈 등록 (2026-02-17)
- **SemiClaw**: 버그/단순 수정 요청 시 직접 이슈 등록 → WorkClaw 인계
- **PlanClaw**: 기획이 필요한 기능 요청 시 기획 후 이슈 생성 → WorkClaw 인계
- WorkClaw은 이슈 카드 기반으로 작업 수행

### Lighthouse / SEO 최적화 (2026-02-17)
- **GrowthClaw**: 리드 (점수 측정, 분석, 우선순위)
- **WorkClaw**: 구현 (GrowthClaw 우선순위대로 코드 수정)

### dev 머지 → 배포 → E2E 파이프라인 (2026-02-18)
- **ReviewClaw**: dev 머지 후 해당 스레드에서 InfraClaw 멘션 → 배포 모니터링 요청
- **InfraClaw**: 배포 모니터링 후 완료되면 해당 스레드에서 ReviewClaw 멘션 → E2E 테스트 요청
- **ReviewClaw**: E2E 테스트 실행 → 결과 리포트
- **Slack 메시지 라벨**: `bot:*` 패턴 통일 (GitHub 라벨과 동일 네이밍)
  - `bot:deploy-req` — 배포 요청 (ReviewClaw → InfraClaw)
  - `bot:deploy-done` — 배포 완료 (InfraClaw → ReviewClaw)
  - `bot:e2e-report` — E2E 결과 (ReviewClaw → #bot-ops)

## 봇 간 정보 공유 프로세스 (2026-02-19, Reus 승인)

### 봇별 정보 도메인
| 봇 | 보유 정보 |
|---|---|
| SemiClaw (PM) | 프로젝트 현황, 팀원 정보, 일정, 의사결정 히스토리, 채널/레포 매핑 |
| PlanClaw (기획) | 기획 문서, 기능 스펙, 유저 플로우, PRD |
| WorkClaw (개발) | 코드 구조, 기술 스택, 구현 상세, 빌드 설정 |
| ReviewClaw (리뷰/QA) | 코드 품질, 테스트 결과, E2E 리포트, 기술 부채 |
| DesignClaw (디자인) | UI/UX 분석, 디자인 시스템, 접근성 |
| GrowthClaw (그로스) | SEO 점수, Lighthouse, 마케팅 지표, 경쟁사 분석 |
| InfraClaw (인프라) | 배포 상태, CI/CD, 서버 구성, 도메인, 시크릿 |

### 질의 프로토콜
- **채널:** 멘션된 대화(스레드) 내에서 진행 (상태 보고/공지는 `#bot-ops`)
- **요청 라벨:** `[bot:info-req]` @대상봇 {프로젝트명} — {질문}  /  요청봇: @요청봇
- **응답 라벨:** `[bot:info-res]` @요청봇 {답변}
- **모를 때:** `[bot:info-unknown]` → SemiClaw이 Reus에게 에스컬레이션

### 라우팅 규칙
1. 누구한테 물어야 하는지 알면 → 해당 스레드에서 직접 멘션
2. 모르면 → SemiClaw(PM) 멘션 → SemiClaw이 답변 or 적절한 봇 라우팅
3. 응답 불가 시 SemiClaw이 대신 답변 시도, 그래도 모르면 Reus 에스컬레이션

## 온보딩 프로세스
→ `memory/bot-setup-pipeline.md` 참조
