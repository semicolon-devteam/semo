# memory/decisions.md — 의사결정 / 원칙 / 교육 내용

## 업무 프로세스 룰 (확정, 2026-02-17, Reus 지시)
- **모든 작업은 이슈카드를 통해서만 진행** (직접 WorkClaw에 요청 금지)
- GrowthClaw 분석 완료 후 → 해당 스레드에서 @PlanClaw 멘션으로 이슈카드 생성 자동 요청
- PlanClaw이 GitHub 이슈 생성 → WorkClaw이 이슈 기반으로 실행
- GrowthClaw이 알아서 이슈카드 생성 요청까지 완결 처리

## R&R — Lighthouse / SEO 최적화 (확정, 2026-02-17, SemiClaw 전달)
| 역할 | 담당 | 내용 |
|---|---|---|
| 분석 & 리드 | GrowthClaw (나) 🌱 | 점수 측정, SEO/Performance 임팩트 분석, 개선 우선순위 설정 |
| 코드 레벨 구현 | WorkClaw ⚙️ | GrowthClaw이 정한 우선순위대로 코드 수정/최적화 실행 |

- R&R 변경 시 관련 봇들에게 명시 전달 + 메모리 기록 (Reus 지시)

## 역할 위임 프로토콜 (확정, 2026-02-17)
1. 자기 역할 밖 요청 받으면 → 요청자에게 간단 안내
2. 해당 스레드에서 `<@U0ADGB42N79>` (SemiClaw) 멘션 + 요청자/내용
3. SemiClaw가 적절한 봇에게 위임

## GCP 모니터링 계획 (2026-02-17, Reus 지시)
- 서비스 운영 URL 헬스체크, GCP Search Console, GA4 Analytics 주기적 점검 필요
- GCP 서비스 계정 JSON 키 필요 (search-console.readonly + analytics.readonly)
- 서비스 운영 URL 목록 확인 필요 (일부 미확인)

## Slack 메시지 발송 원칙 (NON-NEGOTIABLE, 2026-02-18/2026-02-19, Reus 지시 + SemiClaw 전파)
**즉시 적용 규칙 (위반 시 Reus 에스컬레이션):**

1. **Slack에는 최종 결과만 보고** — PR 완료, 리뷰 결과, 블로커 등 actionable한 것만
2. **중간 과정 절대 금지** — 클론, install, 빌드, 분석, "~하겠다" 예고 등 내부 작업 과정
3. **1 작업 = 1 메시지 원칙** — 쪼개서 여러 번 보내지 말 것
4. **서브에이전트 작업 중 상태 업데이트 금지** — 완료 후 결과만 보고

**금지 사례:**
- ❌ "분석 시작하겠습니다"
- ❌ "레포 클론 완료"
- ❌ "npm install 진행 중"
- ❌ "코드 확인하겠습니다"
- ❌ "서브에이전트를 띄우겠다"

**배경:** tool call 사이 텍스트 전송 시 별도 Slack 메시지 발송 → 다른 봇 토큰 낭비

**공지:** SemiClaw #bot-ops 전체 공지 (2026-02-18, 2026-02-19)

## GitHub 운영 규칙 (통합, 2026-02-19, SemiClaw 전파, Reus 지시)

### 🔴 이슈 생성 시 필수 체크리스트 (위반 금지)
1. `gh issue create` (적절한 `bot:*` 라벨 포함)
2. `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>` ← 프로젝트 보드 등록 필수!
3. 담당 봇에게 Slack 멘션 인계 (이슈 링크 포함)
4. 한 기능에 한 이슈

프로젝트 번호: `1` | ID: `PVT_kwDOC01-Rc4AtDz2`

### 라벨 워크플로우
- `bot:needs-spec` → PlanClaw (기획 필요)
- `bot:spec-ready` → WorkClaw (구현 가능)
- `bot:in-progress` → 작업 중
- `bot:needs-review` → ReviewClaw (리뷰 필요)
- `bot:done` → 완료
- `bot:blocked` → 블로커 발생 (SemiClaw 알림)

### 라벨 전환 필수 규칙 (2026-03-06, SemiClaw 전파, Reus 지시)
**NON-NEGOTIABLE:**
- **`bot:done` 라벨 부착 시 반드시 `bot:in-progress` 라벨 제거** (동시 진행)
- 이슈 close 시에도 `bot:in-progress` 잔존 여부 확인
- 배경: closed + bot:done 상태인데 bot:in-progress가 남아있는 이슈 6건 발견됨
- 원칙: 라벨 전환 시 이전 단계 라벨 정리 필수

### 이슈 R&R
- 버그 → SemiClaw → WorkClaw
- 기획 → PlanClaw → WorkClaw
- DesignClaw는 코멘트만 (직접 이슈 생성 안 함)

### OAT & 엔진
- GitHub Actions OAT: **Claude Code OAT**만 사용 (Copilot OAT 금지)
- gh-aw 엔진: `engine: claude`
- 토큰 값은 채널 게시 금지 (DM만)

### 변경 통제
- 공용 레포 (actions-template 등) 단독 수정 금지
- Garden 승인 필수

## axoracle 피드백 파이프라인 (2026-02-19, SemiClaw 인계, Reus 지시)
- 크론잡 등록: `axoracle-feedback-pipeline`
- 스케줄: 매일 08:50 KST
- 동작: Supabase feedback 테이블에서 전날(KST 00:00~24:00) 데이터 추출
- 리포팅: #proj-axoracle (C0AE4N0LSKV) 채널
- 0건이어도 "전날 피드백 0건" 보고
- Supabase URL: https://nmawdwgrjgocyxecrsbx.supabase.co
- 인증: service_role key 필요 (Reus에게 요청 중)

## Config 안전 규칙
- `config.apply` 절대 사용 금지 → `config.patch`만 사용
- 토큰/시크릿 관련 필드 절대 건드리지 않기
- 게이트웨이 재시작 전 #bot-ops 공지

## 봇 간 정보 공유 프로토콜 (2026-02-19, SemiClaw 전달, Reus 승인)
**필수 규칙 (2026-02-19 23:30, SemiClaw 재강조):**
- 프로젝트 정보(현황, 팀원, 일정, 기획, 기술 스택 등)를 모르거나 컨텍스트가 부족할 때
- **먼저 SemiClaw에게 물어볼 것** — 추측해서 답변 금지
- SemiClaw가 답변하거나 적절한 봇으로 라우팅해줌
- SemiClaw도 모르면 Reus 에스컬레이션

**질의 방법:**
- 질의 포맷: `[bot:info-req]` @대상봇 {프로젝트명} — {질문} / 요청봇: @본인
- 응답 포맷: `[bot:info-res]` @요청봇 {답변}
- 모를 때: `[bot:info-unknown]` → SemiClaw 라우팅 or Reus 에스컬레이션
- 누구한테 물어야 할지 모르면 → SemiClaw (<@U0ADGB42N79>)에 먼저 질의

봇별 정보 도메인:
| 봇 | 도메인 |
|---|---|
| SemiClaw | 프로젝트 현황, 팀원 정보, 일정, 의사결정 히스토리, 채널/레포 매핑 |
| PlanClaw | 기획 문서, 기능 스펙, 유저 플로우, PRD |
| WorkClaw | 코드 구조, 기술 스택, 구현 상세, 빌드 설정 |
| ReviewClaw | 코드 품질, 테스트 결과, E2E 리포트, 기술 부채 |
| DesignClaw | UI/UX 분석, 디자인 시스템, 접근성 |
| GrowthClaw (나) | SEO 점수, Lighthouse, 마케팅 지표, 경쟁사 분석 |
| InfraClaw | 배포 상태, CI/CD, 서버 구성, 도메인, 시크릿 |

## 프로젝트 디렉토리 관리 원칙 (NON-NEGOTIABLE, 2026-02-19, Reus 지시, SemiClaw 전파)
**프로젝트 소스코드 위치:**
- 모든 프로젝트는 `/Users/reus/Desktop/Sources/semicolon/projects/` 하위에 위치
- 주요 매핑:
  - `projects/ps` → PS
  - `projects/land/` → 게임랜드, 플레이랜드, 오피스, core-backend, ms-point-exchanger
  - `projects/jungchipan` → 정치판
  - `projects/labor-union` → 노조관리
  - `projects/bebecare` → BebeCare
  - `projects/axoracle` → AXOracle
  - `projects/celeb-map` → Celeb Map
  - `projects/car-dealer` → 바이바이어
  - `projects/chagok` → 차곡
  - `projects/cointalk` → 코인톡
  - `projects/introduction` → 팀 소개사이트
  - `projects/link-collect` → 링크모음(링크타)
  - `projects/sales-keeper` → 매출지킴이
  - `projects/samho-work-clothes` → 삼호작업복
  - `projects/seoul-tourist` → 서울관광앱
  - `projects/shipyard-management` → 조선소관리
  - `projects/viral` → 바이럴(오르다)

**필수 규칙:**
1. **작업 시 반드시 해당 프로젝트 디렉토리에서 수행**
2. **디렉토리가 없는 프로젝트**:
   - ❌ 임의로 `git clone`이나 디렉토리 생성 절대 금지
   - ✅ <@U0ADGB42N79> (SemiClaw)에게 해당 스레드에서 문의
   - SemiClaw → Reus 보고 → 디렉토리 세팅
3. **프로젝트 정보를 모를 때**: 추측하지 말고 관련 봇에게 `[bot:info-req]` 형식으로 문의

**정보 질의 순서:**
- 프로젝트 현황/매핑 → <@U0ADGB42N79> (SemiClaw)
- 기획/스펙 → <@U0AFNMGKURX> (PlanClaw)
- 코드/기술 → <@U0AFECSJHK3> (WorkClaw)
- 인프라/배포 → <@U0AFPDMCGHX> (InfraClaw)

## 메모리 구조 (2026-02-17, SemiClaw 지시, Reus 승인)
- MEMORY.md: 슬림 인덱스 (50줄 이내, 핵심 요약 + 파일 포인터)
- memory/team.md: 팀원 정보
- memory/bots.md: 봇 아키텍처
- memory/services.md: 서비스 정보 (URL, 레포, SEO 현황)
- memory/decisions.md: 의사결정/원칙/교육 내용
- memory/YYYY-MM-DD.md: 일일 로그

---

## 봇 간 인계 방식: 순수 라벨+폴링 (2026-02-23, Reus 승인)

**⚠️ 핵심 원칙: 모든 봇 간 직접 Slack 멘션 인계 전면 폐기**

### 즉시 적용 규칙
1. ❌ **작업 인계 목적으로 다른 봇을 Slack 멘션하지 말 것**
2. ✅ **GitHub 이슈에 적절한 `bot:*` 라벨만 부착 → 다음 봇이 폴링으로 감지**
3. 라벨 체인: `bot:needs-spec` → `bot:spec-ready` → `bot:needs-review` → `bot:done`
4. **E2E 버그**: 이슈 생성 + `bot:spec-ready` 라벨만 (멘션 X)
5. **정보 요청**: GitHub 이슈 `bot:info-req` 라벨 경유. 답변 후 즉시 close
6. `bot:blocked`는 SemiClaw이 15분 폴링으로 감지
