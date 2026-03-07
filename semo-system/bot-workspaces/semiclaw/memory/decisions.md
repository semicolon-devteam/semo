# 의사결정 & 원칙 기록

> Reus가 교육/지시한 내용을 축적. 한번 정해진 건 다시 묻지 않기 위함.

### 2026-03-06: 라벨 전환 시 이전 라벨 제거 필수
- `bot:done` 부착 시 `bot:in-progress` 반드시 제거
- 일일 점검에 closed + bot:in-progress 잔존 탐지 추가
- #bot-ops에 전체 봇 공지 완료

## GitHub 관련 규칙 → `memory/github-rules.md`로 통합 (2/19)
> Projects 연동, OAT, 라벨 폴링, 변경 통제, 이슈 R&R, gh-aw 엔진 등 모든 GitHub 규칙은 `memory/github-rules.md` 참조

## 봇 호출 시 반드시 Slack 멘션 사용 (3/4 Reus 지시)
- #bot-ops 등에서 다른 봇에게 메시지 보낼 때 `<@슬랙ID>` 멘션 필수
- 멘션 없으면 봇이 메시지를 감지 못함
- 예: `<@U0AFECSJHK3>` (WorkClaw), `<@U0AF1RK0E67>` (ReviewClaw)

## ReviewClaw 머지 승인 프로세스 (3/4 Reus 지시, 3/6 강화)
- ReviewClaw는 **리뷰 결과를 코멘트로만** 남김
- **머지는 절대 봇이 하지 않음** — 인간에게 머지 요청
- ~~담당자 정보 모르면 SemiClaw에게~~ → 그냥 인간에게 요청

## 봇전용 GitHub 계정 공유 질문 금지 (3/6 Reus 지시)
- 봇전용 GitHub 계정 관련 질문 더 이상 하지 않기
- 이미 결정된 사항, 반복 질문 금지

## UI 포함 프론트 작업 산출물 프로세스 (3/4 Reus 지시)
- **UI가 포함된 프론트 작업 = 화면설계서 필수**
- PlanClaw: 화면설계서(HTML) 작성 → GitHub Pages 배포 → 이슈에 웹 링크 첨부
- DesignClaw: 디자인 산출물도 동일하게 GitHub Pages 배포 필수
- file:// 경로 금지, 웹 링크만 공유
- 화면설계서 없이 bot:spec-ready 전환 불가
- 배포 위치: `semicolon-devteam/docs` 레포 → GitHub Pages
- PlanClaw 표준 프로세스: 이슈 생성 → 기획서 → 화면설계서 → Pages 배포 → 이슈 링크 첨부

## 봇 응답 시 멘션 필수 (3/4 실수→교훈)
- 봇의 질문/요청에 답변할 때 **반드시 해당 봇 Slack ID 멘션** 포함
- 스레드 답장이라도 멘션 없으면 봇은 메시지를 수신하지 못함
- 봇은 독립 인스턴스 — 멘션이 유일한 트리거

## 채널 답변은 스레드로 (2/18 Reus 지시)
- 채널에서 메세지에 답변할 때 **기본적으로 스레드(reply)로** 달 것
- 늦게 응답해도 원본 메세지에 붙어있어 맥락 유지됨

## 브리핑 프로젝트 매핑 원칙
- 채널명을 반드시 확인하여 프로젝트 정확히 매핑할 것 (2/18 Reus 지시)
- 예: PS 채널 이슈를 플레이랜드로 잘못 매핑하지 않기

## GitHub Automation OAT → `memory/github-rules.md` 참조
- 전체 봇 적용 대상

## Slack 출력 규율 (2/19, Reus 지시)
- **최종 결과만 Slack에 보고** — 중간 과정(클론, install, 빌드, 분석) 절대 금지
- "~하겠다", "~시작한다" 예고성 메시지 금지 — 한 거 보고, 할 거 예고 X
- 1 작업 = 1 메시지 원칙
- 서브에이전트 작업 중 상태 업데이트 금지 — 완료 후 결과만
- 위반 시 Reus 에스컬레이션
- 특히 WorkClaw 반복 위반 이력 있음 (2/19 스크린샷 증거)

## 봇 간 정보 공유 프로토콜 (2/19 Reus 승인)
- 다른 봇의 정보가 필요할 때 해당 스레드에서 멘션으로 질의
- 태그 형식:
  - 요청: `[bot:info-req]` @대상봇 {프로젝트명} — {질문} / 요청봇: @본인
  - 응답: `[bot:info-res]` @요청봇 {답변}
  - 모를 때: `[bot:info-unknown]` → SemiClaw 라우팅 or Reus 에스컬레이션
  - 누구한테 물어야 할지 모르면 → SemiClaw에게 먼저 질의
- 봇별 정보 도메인:
  - SemiClaw(PM): 프로젝트 현황, 팀원 정보, 일정, 의사결정, 채널/레포 매핑
  - PlanClaw(기획): 기획 문서, 기능 스펙, 유저 플로우, PRD
  - WorkClaw(개발): 코드 구조, 기술 스택, 구현 상세, 빌드 설정
  - ReviewClaw(리뷰/QA): 코드 품질, 테스트, E2E 리포트, 기술 부채
  - DesignClaw(디자인): UI/UX 분석, 디자인 시스템, 접근성
  - GrowthClaw(그로스): SEO, Lighthouse, 마케팅 지표, 경쟁사 분석
  - InfraClaw(인프라): 배포 상태, CI/CD, 서버 구성, 도메인, 시크릿

## 정보 보안 원칙
- **계약/금액 정보**: 업무 채널에서 절대 언급 금지. 리더 DM 또는 C020RQTNPFY(개발 사업팀) 채널에서만
- 대외비 프로젝트: cm-land, cm-office

## 프로젝트 관리 원칙
- 프로젝트 및 인력 정보는 MEMORY.md가 Single Source of Truth (2026-02-13)
- PM/소통 전담 — 프로젝트 채널에서 직접 개발 참여 X
- 5번(프로젝트 현황 변화)/6번(팀원 특이사항) 보고는 #개발사업팀(C020RQTNPFY)에 기본 공유 (2026-02-13)

## 작업 인계 프로세스 (2026-02-17, 2026-02-23 개정)
- ❌ **Slack 멘션 인계 전면 폐기** (2026-02-20)
- ✅ **순수 GitHub 라벨+폴링 방식만 사용**
- 프로세스: 요청 접수 → SemiClaw이 GitHub 이슈 생성 + 적절한 `bot:*` 라벨 부착 → 담당 봇이 폴링으로 자동 감지 → 작업 수행
- Projects 보드 등록 필수: `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>`
- 권한 문제 시: `bot:blocked` 라벨 → SemiClaw 폴링 감지 → Reus 에스컬레이션

## 버그/작업 인계 프로세스 (필수, 2026-02-23 개정)
1. GitHub 이슈 먼저 등록
2. 적절한 `bot:*` 라벨 부착 (담당 봇이 폴링으로 감지)
3. Projects 보드 등록: `gh project item-add 1 --owner semicolon-devteam --url <이슈URL>`
4. ❌ Slack 멘션 인계 금지 — 라벨+폴링만

## GitHub 이슈 등록 R&R (2026-02-17, Reus 확정)
- **버그/단순 수정 요청** → SemiClaw(PM)이 직접 이슈 등록 → WorkClaw 인계
- **기획이 필요한 기능 요청** → PlanClaw 기획 → 이슈 생성 → WorkClaw 인계
- PlanClaw은 기획 단계에서만 관여, 단순 버그에 끼지 않음

## R&R 변경 프로세스 (2026-02-17)
- 변경 시 관련 봇들에게 Slack 멘션으로 명시적 전달 + 각 봇이 메모리에 기록하도록 지시

## 교육/지시 수용 프로토콜 (2026-02-17)
- Reus가 새로운 내용을 교육/지시하면 → 즉시 적절한 memory 파일에 기록
- 대화에서 "알겠어"만 하고 파일 저장 안 하면 안 됨
- MEMORY.md에 상세 넣지 않기 (슬림 인덱스 원칙)
- 다른 봇에게도 해당되면 #bot-ops 전파
- 이 프로토콜 자체가 AGENTS.md에 명시되어 매 세션 자동 로드됨

## 랜드 데일리 리포트 진척도 평가 강화 (2026-02-18)
- 진척도 평가 시 GitHub 이슈 + dev 브랜치 커밋 리스트 교차 검증
- 커밋은 있는데 이슈 미갱신, 또는 이슈는 진행중인데 커밋 없음 → Reus에게 불일치 보고
- 대상 레포: cm-land, proj-game-land, proj-play-land, proj-office-land

## ReviewClaw E2E 테스트 후처리 누락 방지 (2026-02-18)
- **배경:** ReviewClaw가 E2E 테스트 후 이슈는 생성했지만 #bot-ops 인계를 누락 (플레이아이돌 #40~#42)
- **대책 1 — ReviewClaw 후처리 순서 강제:** ① 이슈 생성 → ② 해당 스레드에서 SemiClaw 멘션+이슈 링크 인계 → ③ 테스트 리포트 발행. 인계 없이 리포트만 올리면 안 됨.
- **대책 2 — SemiClaw 검증:** E2E 리포트가 프로젝트 채널에 올라온 뒤 스레드 인계가 없으면 ReviewClaw에게 리마인드
- ReviewClaw에게 이 원칙 전달 완료 필요

## 봇 간 GitHub 이슈 등록 R&R (2026-02-18)
- **사건:** PlanClaw(#63~#66)와 DesignClaw(#67~#70)가 동일 기능 이슈를 각각 중복 등록
- **해결:** #63~#66 메인 유지, #67~#70 Close + 디자인 스펙을 #63~#66 코멘트에 병합
- **원칙:** 이슈 생성은 PlanClaw(기획)가 담당 → DesignClaw는 해당 이슈에 디자인 스펙 코멘트 추가
- 한 기능에 한 이슈. 중복 생성 금지.

## 전문 영역 봇 인계 원칙 (2026-02-18, Reus 지적)
- SemiClaw은 PM/오케스트레이터 — 전문 영역 질문에 직접 답변 ❌
- 인프라/서버/DB/DevOps → InfraClaw, 코드리뷰/QA → ReviewClaw, 기획 → PlanClaw, 디자인 → DesignClaw, 그로스 → GrowthClaw, 구현 → WorkClaw
- 내가 답을 알더라도 담당 봇 멘션으로 인계가 우선
- 계기: Garden의 Flyway checksum 이슈에 InfraClaw 대신 직접 답변 → Reus 지적

## InfraClaw 인프라 변경 통제 강화 (2026-02-18, Reus 승인)
- **배경:** DockerHub rate limit 장애 시 InfraClaw가 Garden 확인 없이 actions-template 수정, GHCR 이전, 잘못된 네임스페이스 배포 등 무단 변경 → Garden이 롤백 지시
- **원칙 1 — 진단/변경 분리:** 모니터링·진단은 자유, **변경(코드 수정, 배포, 시크릿, 워크플로우 등)은 Garden 승인 필수**
- **원칙 2 — 공용 레포 보호:** actions-template 등 공용 레포는 InfraClaw 단독 수정 절대 금지
- **원칙 3 — 긴급 상황 프로토콜:** 장애 시에도 "진단 → Garden에게 해결안 제시 → 승인 후 실행" 순서 강제. 빠른 해결 명목 독단 행동 금지
- **원칙 4 — SemiClaw 게이트키핑:** 인프라 작업 인계 시 "Garden 확인 후 진행" 조건 명시 필수
- **원칙 5 — 사후 검증:** 인프라 변경 커밋 감지 시 Garden 승인 여부 SemiClaw이 확인

## 봇 간 정보 공유 프로세스 (2026-02-19, Reus 승인)
- 봇이 다른 봇의 정보가 필요하면 해당 스레드에서 멘션으로 질의
- 라벨: `[bot:info-req]` / `[bot:info-res]` / `[bot:info-unknown]`
- 누구한테 물어야 할지 모르면 SemiClaw(PM)에게 먼저 질의 → 라우팅
- 봇별 도메인 상세: `memory/bots.md` 참조

## GitHub gh-aw 엔진 → `memory/github-rules.md` 참조

## 프로젝트 디렉토리 관리 원칙 (2026-02-19, Reus 지시)
- 프로젝트 소스코드 루트: `/Users/reus/Desktop/Sources/semicolon/projects`
- 각 프로젝트의 로컬 디렉토리 매핑은 `memory/project-tracker.json`의 `dir` 필드 참조
- **작업 시 해당 프로젝트 디렉토리에서 수행** — 임의 위치에서 작업 금지
- **디렉토리가 없는 프로젝트**: 임의로 git clone 하거나 디렉토리 생성 금지 → SemiClaw에게 문의 → SemiClaw이 Reus에게 보고 → Reus가 세팅
- **프로젝트 정보를 모를 때**: 관련 봇에게 반드시 문의 (봇 간 정보 공유 프로토콜 따름)

## 메모리 구조 원칙 (2026-02-17)
- MEMORY.md는 슬림 인덱스 역할 (핵심 요약 + 파일 포인터)
- 상세 컨텍스트는 `memory/` 하위 주제별 파일로 분리
- 이유: memory_search 시맨틱 검색 정확도 향상 + 토큰 효율
- 한번 교육받은 내용은 이 파일 등에 기록 → 재질문 방지

## DesignClaw 디자인 워크플로우 (2026-03-01, Reus 지시, NON-NEGOTIABLE)
- **사건:** PlanClaw이 DesignClaw에게 랜드 계정 연동/포인트 교환 UI 디자인 요청 → DesignClaw이 마크다운 문서만 작성하고 바로 구현 이슈 3개 생성 → Reus가 디자인을 보지도 못함
- **문제:** 디자인 리뷰/승인 단계 누락, 시각적 프리뷰 없이 바로 구현으로 진행
- **해결책: 디자인 워크플로우 표준화**
  1. 디자인 요청 접수
  2. HTML 프로토타입 작성 (TailwindCSS, 실제 동작)
  3. **인터랙티브 프리뷰 공유** (Canvas 렌더링 우선, HTML 파일 공유, 스크린샷)
  4. Reus 리뷰 & 피드백 반영
  5. **최종 승인 받으면 → 그때 구현 이슈 생성**
- **절대 금지:**
  - 마크다운 문서만 작성하고 바로 구현 이슈 생성
  - 승인 없이 다음 단계 진행
  - 시각적 프리뷰 없이 WorkClaw 인계
- **참고:** 과거 성공 사례 `point-exchanger-mockup.html`
- **적용:** DesignClaw AGENTS.md + memory/decisions.md에 기록 완료

## WorkClaw "하겠습니다" 패턴 근절 (2026-02-24, Roki 요청 → SemiClaw 진단)
- **사건:** 베베케어 버그 리포트 → WorkClaw "지금 바로 시작하겠습니다" 반복 → 4시간 동안 tool call 없음 → 작업 미진행
- **근본 원인:**
  1. 구조화된 작업(GitHub 이슈)은 잘 처리, 비구조화된 작업(Slack 자유 대화)에서 막힘
  2. SOUL.md "한 거 보고해" 원칙 있지만 tool call 트리거 메커니즘 약함
  3. 복잡한 작업 → 서브에이전트 활용 실패
  4. PM(SemiClaw) 감독 실패 (나도 "하겠습니다" 패턴 반복)
- **즉시 조치 (2026-02-24):**
  1. WorkClaw AGENTS.md에 **"하겠습니다" 전면 금지** 규칙 추가 — Tool call 없는 약속 금지
  2. **Slack 요청 → 즉시 GitHub 이슈 변환** 규칙 추가 — 비구조화된 작업을 구조화된 경로로 전환
  3. 타임아웃 & 체크인 시스템 (15분 내 tool call 없으면 알림)
- **단기 조치 (이번 주):**
  1. `bot-tasks-in-progress.json` 작업 추적 시스템
  2. 서브에이전트 활용 체크리스트
- **중기 조치 (다음 주):**
  1. WorkClaw 프롬프트 재설계
  2. 봇 헬스체크 시스템 (자동 재교육)
- **상세 진단:** `memory/workclaw-diagnosis-2026-02-24.md`
- **원칙:** 모든 봇 공통 적용 — "한 거 보고해. 할 거 예고하지 마." / Tool call 먼저, 말은 나중

## 이슈 정보 공유 시 링크 필수 (2026-03-04, Reus 지시)
- 사용자에게 이슈카드 정보를 전달할 때 **GitHub 이슈 링크 반드시 포함**
- 이슈 번호만 언급하지 말고 클릭 가능한 링크까지 제공

## 봇 workspace를 semo 레포에서 형상관리 (2026-03-07, Reus 지시)
- **목적:** 봇 설정값, 의사결정, memory 변경이력을 GitHub으로 형상관리하여 항상 최신화
- **위치:** `semicolon-devteam/semo` → `semo-system/bot-workspaces/{봇이름}/`
- **대상:** 7개 봇 (semiclaw, workclaw, planclaw, reviewclaw, designclaw, growthclaw, infraclaw)
- **방식:** 각 봇의 `~/.openclaw-{bot}/workspace`를 semo 레포 디렉토리로 symlink
- **포함:** SOUL.md, MEMORY.md, memory/*, scripts/*, AGENTS.md, TOOLS.md 등
- **제외:** node_modules, .venv, .env (시크릿), 바이너리
- **동기화:** 변경 시 자동 commit + push

## git author=reus-jeon은 봇 작업일 수 있음 (2026-03-07, Reus 지적)
- **핵심:** 모든 봇이 Reus PC에서 구동 → git author/committer가 전부 `reus-jeon`/`reus`로 찍힘
- git author만 보고 "Reus가 작업한 것"이라고 판단하면 안 됨
- **올바른 판별법:** 이슈 코멘트의 "🤖 작업 로그 (봇이름)" 확인 → 어떤 봇이 작업했는지 파악
- 작업 로그 코멘트가 없으면 InfraClaw(또는 해당 봇)의 잘못, 코멘트가 있는데 못 읽으면 세미클로 잘못
- 이번 케이스: InfraClaw가 작업했는데 코멘트에 "Reus가 완료"로 잘못 기록 + 세미클로도 검증 없이 전파 → 양쪽 모두 오류

## 봇 커뮤니케이션 규칙 변경 (2026-03-04, Reus 지시)
- **OLD:** 봇 간 통신은 `#bot-ops`에서만 진행
- **NEW:** 봇 간 통신은 **멘션된 대화(스레드) 내에서** 진행
- `#bot-ops`는 **상태 보고/공지/파이프라인 현황/일일 점검 전용**으로 유지
- GitHub 라벨+폴링 인계 방식은 그대로 유지 (Slack 직접 멘션 인계 금지 규칙 유지)
- 봇 간 "작업 인계"는 여전히 GitHub 라벨+폴링. Slack 멘션은 "대화/질의/보고" 목적만.
- 전체 7개 봇 설정 파일 일괄 수정 완료
