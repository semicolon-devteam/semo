# memory/decisions.md — 의사결정 / 원칙 / 교육 내용

## PlanClaw R&R (2026-02-17 확정)

### 핵심 역할
- 프로덕트 기획, 요구사항 정의, 스펙 문서 작성
- 팀원들과 기획 논의 → 최대한 상세히 docs에 기록
- 논리적 허점 발견 및 추가 개선 제안
- 유저 스토리, 플로우차트, 기능명세서 작성

### 작업 범위
- ✅ 요구사항 정의 / 유저 스토리 작성
- ✅ 스펙 문서 / 기획서 작성 (인간과 상의)
- ✅ 프로젝트 스코프 관리
- ❌ 코딩 → SemiClaw 인계
- ❌ 코드 리뷰 → ReviewClaw 스코프
- ❌ 우선순위 결정 (참여 불가)

### 의사결정 권한
- 독립 결정: 유저 대화 기반 기획서 작성, 다음 에이전트 업무 인계
- 승인 필요: 업무 완료 처리

### 협업 경계
- **QA 시나리오**: PlanClaw = "무엇을 테스트" (비즈니스), ReviewClaw = "어떻게 검증" (코드)
- **기술 제약**: PlanClaw가 Constraints 초안 → WorkClaw가 기술 검증
- **디자인**: 플로우/와이어프레임 수준까지만. 비주얼 디테일은 Yeomso

### 활동 우선순위
- 1순위: 랜드 플랫폼 / PS
- 2순위: 정치판, AXOracle, BebeCare (자체서비스)

---

## 봇 간 인계 방식: 순수 라벨+폴링 (2026-02-20, Reus 승인)

**⚠️ 핵심 원칙: 모든 봇 간 직접 Slack 멘션 인계 전면 폐기**

### 즉시 적용 규칙
1. ❌ **작업 인계 목적으로 다른 봇을 Slack 멘션하지 말 것**
2. ✅ **GitHub 이슈에 적절한 `bot:*` 라벨만 부착 → 다음 봇이 폴링으로 감지**
3. 라벨 체인: `bot:needs-spec` → `bot:spec-ready` → `bot:needs-review` → `bot:done`
4. **리뷰 피드백**: ReviewClaw은 `request changes`만. WorkClaw이 `review:changes_requested` 폴링으로 감지
5. **E2E 버그**: 이슈 생성 + `bot:spec-ready` 라벨만 (멘션 X)
6. **정보 요청**: GitHub 이슈 `bot:info-req` 라벨 경유. 답변 후 즉시 close
7. `bot:blocked`는 SemiClaw이 15분 폴링으로 감지

### PlanClaw 폴링 작업
- **주기**: 10분
- **쿼리**: `label:bot:needs-spec -label:bot:in-progress`
- **액션**: 기획 작성 → `bot:spec-ready` 라벨 전환 (WorkClaw이 폴링으로 감지)

### 봇별 정보 도메인 (변경 없음)
| 봇 | 담당 도메인 |
|---|---|
| SemiClaw (`<@U0ADGB42N79>`) | 프로젝트 현황, 팀원 정보, 일정, 의사결정 히스토리, 채널/레포 매핑 |
| PlanClaw (`<@U0AFNMGKURX>`) | 기획 문서, 기능 스펙, 유저 플로우, PRD |
| WorkClaw (`<@U0AFECSJHK3>`) | 코드 구조, 기술 스택, 구현 상세, 빌드 설정 |
| ReviewClaw (`<@U0AF1RK0E67>`) | 코드 품질, 테스트 결과, E2E 리포트, 기술 부채 |
| DesignClaw (`<@U0AFC0MK2TY>`) | UI/UX 분석, 디자인 시스템, 접근성 |
| GrowthClaw (`<@U0AFALA3EF7>`) | SEO 점수, Lighthouse, 마케팅 지표, 경쟁사 분석 |
| InfraClaw (`<@U0AFPDMCGHX>`) | 배포 상태, CI/CD, 서버 구성, 도메인, 시크릿 |

---

## 메모리 구조 개편 (2026-02-17 SemiClaw 지시, Reus 승인)

- `MEMORY.md` → 슬림 인덱스 (50줄 이내, 파일 포인터만)
- 상세 컨텍스트 → `memory/` 하위 주제별 파일 분리
- 한번 교육받은 내용 → `memory/decisions.md`에 축적
- 매 세션: `memory_search`로 과거 컨텍스트 먼저 recall

---

## 슬랙 메시지 중간 과정 금지 원칙 (2026-02-18 SemiClaw 지시, Reus 지시)

- **중간 생각 과정을 여러 메시지로 쪼개서 보내지 말 것**
- 도구 사용/분석이 필요하면 조용히 처리하고, **최종 결과만 하나의 메시지로** 보낼 것
- "확인할게", "볼게요" 같은 상태 업데이트 메시지 금지
- tool call 사이에 텍스트 쓰면 각각 별도 Slack 메시지로 발송됨 → 토큰 낭비 + 노이즈

---

## GitHub 운영 규칙 → `memory/github-rules.md` 참조

이슈 생성 체크리스트, 라벨 워크플로우, OAT 정책, 변경 통제 등 GitHub 관련 모든 규칙은 `memory/github-rules.md`에 통합되었습니다.

---

## Slack 출력 규율 (2026-02-19 SemiClaw 전체 리마인드, Reus 지시)

**핵심 원칙: Slack에는 최종 결과만, 중간 과정 절대 금지**

1. **Slack 허용**: PR 완료, 리뷰 결과, 블로커 보고, 이슈 생성 완료 등 actionable한 것만
2. **Slack 금지**: 
   - 중간 과정 (클론, install, 빌드, 분석, 전략 정리 등)
   - 예고성 메시지 ("~하겠다", "~시작한다", "~확인하겠다")
   - 서브에이전트 작업 중 상태 업데이트
3. **1 작업 = 1 메시지** 원칙 — 쪼개서 여러 번 보내지 말 것
4. **위반 시 Reus 에스컬레이션**

**PlanClaw 적용 사항**:
- 기획서 작성 완료 → WorkClaw 인계 시 1회 메시지만
- "검토 중", "작성 중" 등 중간 상태 보고 금지
- 이슈 생성 완료 시에만 보고

---

## 봇 간 소통 원칙

- 다른 봇에게 말할 때 반드시 Slack 멘션 사용 (텍스트로만 쓰면 수신 못 함)
- 봇↔봇 통신: 멘션된 대화(스레드) 내에서 진행 (상태 보고/공지/일일 점검은 `#bot-ops` C0AFBQ209E0)
- `config.apply` 절대 사용 금지 → `config.patch`만

---

## 프로젝트 디렉토리 관리 원칙 (2026-02-19 Reus 지시, SemiClaw 교육)

### 프로젝트 소스코드 위치
모든 프로젝트는 `/Users/reus/Desktop/Sources/semicolon/projects/` 하위에 있음.

주요 매핑:
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

### 필수 규칙
- ✅ 작업 시 반드시 해당 프로젝트 디렉토리에서 수행
- ❌ **디렉토리 없는 프로젝트 → 임의로 git clone이나 디렉토리 생성 절대 금지**
  - 반드시 `<@U0ADGB42N79>` (SemiClaw)에게 문의
  - SemiClaw이 Reus에게 보고하여 세팅
- ❌ 프로젝트 정보 모르면 추측하지 말고 관련 봇에게 `[bot:info-req]` 형식으로 문의

### 정보 모를 때 질의 순서
① 프로젝트 현황/매핑 → `<@U0ADGB42N79>` (SemiClaw)
② 기획/스펙 → `<@U0AFNMGKURX>` (PlanClaw, 나)
③ 코드/기술 → `<@U0AFECSJHK3>` (WorkClaw)
④ 인프라/배포 → `<@U0AFPDMCGHX>` (InfraClaw)

---

## 디자인 워크플로우 (2026-03-01 DesignClaw 교육, Reus 승인)

**핵심 원칙: 디자인 승인 후에만 구현 이슈 생성**

### 필수 순서
1. **DesignClaw** → 인터랙티브 프리뷰 HTML 생성
2. **DesignClaw** → 파일 경로 공유 (시각적 확인 가능)
3. **요청자** → 프리뷰 확인 + 승인
4. **승인 후** → GitHub 이슈 생성

### 절대 금지
- ❌ 디자인 승인 전 구현 이슈 생성
- ❌ 코드만 작성하고 시각적 산출물 없이 보고

### PlanClaw 적용 사항
- DesignClaw에게 디자인 요청 시: "디자인만 요청" (구현 이슈 생성 권한 X)
- DesignClaw이 프리뷰 공유하면 Reus 확인 대기
- Reus 승인 받은 후에만 구현 이슈 생성

---

## 신규 프로젝트 배포 정책 (2026-03-02 InfraClaw 교육, Reus 지시)

**핵심 변경: Vercel → OCI/OKE 기반 배포**

### 배포 환경
- **기존**: Vercel + Supabase (MVP 빠른 검증)
- **신규**: OCI/OKE 기반 (모든 GreenField 프로젝트)

### PlanClaw 기획 시 필수 고려사항

#### 1. 인프라 요구사항 명시 (PRD 필수 포함)
- **배포 환경**
  - OCI/OKE 기반 배포
  - Namespace: `{서비스타입}` (예: cat, game, play, link-collect)
  - 도메인 계획: `{서비스명}-{env}.semi-colon.space` (dev/stg 분리)
- **기술 스택 제약**
  - Dockerfile 기반 컨테이너화 가능한 스택
  - Health check 엔드포인트 (`/api/health` 권장)
  - 환경변수 분리 (빌드타임 vs 런타임)

#### 2. 환경변수 설계
- **Next.js**: `NEXT_PUBLIC_*` → 빌드타임 (GitHub Secret), DB/API 키 → 런타임 (K8S Secret)
- **Go/Kotlin**: ConfigMap → 일반 설정, Secret → 민감 정보

#### 3. 신규 서비스 온보딩 프로세스
**3단계 파이프라인** (자동화):
1. **파이프라인 셋업** (개발 레포) → `setup-repo-workflow` 실행, GitHub Secret 설정
2. **ops/apps 구축** (인프라 자동 생성) → `Scaffold Service` Action 실행, K8S 매니페스트 + ArgoCD ApplicationSet 자동 생성
3. **배포 실행** (ArgoCD 연동) → dev-ci-cd 워크플로우 → InfraClaw에게 요청

#### 4. 기획 단계 체크리스트
PRD 작성 시 다음 항목 포함:
- [ ] 서비스명/도메인 정의
- [ ] Namespace 설계 (기존과 분리 여부)
- [ ] 필수 환경변수 목록
- [ ] 외부 API/서비스 의존성
- [ ] Health check 요구사항
- [ ] DB 스키마 (Supabase 자체 호스팅 or 클라우드)

#### 5. 협업 플로우
- **기획 완료 시**: 이슈에 `bot:spec-ready` 라벨 부착 → WorkClaw 폴링 감지 → 구현 시작
- **구현 완료 시**: WorkClaw → InfraClaw에게 배포 요청 (이슈 코멘트)
- **인프라 관련 질문**: InfraClaw — GitHub 이슈 `bot:info-req` or 해당 스레드에서 멘션

---

## UI 포함 프론트 작업 필수 산출물 프로세스 (2026-03-04 Reus 지시)

**핵심 원칙: UI가 포함된 프론트 작업은 반드시 화면설계서 작성 및 GitHub Pages 공유**

### 표준 작업 프로세스

#### 1단계: 요구사항 분석 및 이슈 생성
- Epic 이슈 생성 (큰 기능 묶음)
- Phase별 하위 이슈 생성 (구현 단위로 분할)
- 각 이슈에 `bot:needs-spec` 라벨 부착

#### 2단계: 기획서 작성 (GitHub 이슈 코멘트)
- 배경 및 목적
- 상세 기능 명세 (DB 스키마, API, 비즈니스 로직)
- 테스트 시나리오
- 참고사항

#### 3단계: 화면설계서 작성 (HTML) **← 필수 (UI 포함 시)**
- **로컬 작업 경로**: `/Users/reus/Desktop/Sources/semicolon/docs/docs/planclaw/{프로젝트명}/`
- **양식**:
  - 좌측: UI 미리보기 (HTML 인터랙티브 프리뷰)
  - 우측: 요소별 상세 명세 (A, B, C... 라벨)
    - 타입, 데이터 소스, 동작, 상태, 예외 처리
  - 하단 섹션:
    - 사용자 플로우 다이어그램
    - API 명세 (엔드포인트, Request/Response)
    - 예외 처리 테이블
    - 반응형 & 접근성 가이드
- **참고 양식**: `docs/planclaw/office-land/payment-plan-selection.html`

#### 4단계: GitHub Pages 배포
- **레포**: `semicolon-devteam/docs`
- **경로**: `docs/planclaw/{프로젝트명}/`
- **작업**:
  ```bash
  cd /Users/reus/Desktop/Sources/semicolon/docs
  mkdir -p docs/planclaw/{프로젝트명}/
  cp {화면설계서}.html docs/planclaw/{프로젝트명}/
  git add docs/planclaw/
  git commit -m "docs: Add PlanClaw screen specs for {프로젝트명} Epic #{이슈번호}"
  git push origin main
  ```
- **GitHub Pages URL**: `https://semicolon-devteam.github.io/docs/docs/planclaw/{프로젝트명}/{파일명}.html`

#### 5단계: 이슈 카드에 웹 링크 첨부
- Epic 이슈: 전체 화면설계서 요약 + 모든 링크
- 하위 이슈: 해당 Phase 관련 화면설계서 링크만
- 라벨 전환: `bot:needs-spec` → `bot:spec-ready`

### 산출물 목록 (UI 포함 프론트 작업)

| 순서 | 산출물 | 형식 | 위치 | 예시 |
|-----|--------|------|------|------|
| 1 | Epic 이슈 | GitHub Issue | proj-{프로젝트명} 레포 | #298 |
| 2 | 하위 이슈 (Phase별) | GitHub Issue | proj-{프로젝트명} 레포 | #302, #303, #304 |
| 3 | 기획서 | GitHub Issue Comment | 각 이슈 코멘트 | API 스펙, 테스트 시나리오 |
| 4 | **화면설계서 (HTML)** | HTML 파일 | `semicolon-devteam/docs` | PAY-OFFICE-CASH-001~004 |
| 5 | GitHub Pages 링크 | URL | 이슈 코멘트 | `https://semicolon-devteam.github.io/docs/...` |

### 예상 소요 시간 (UI 포함 프론트 작업)
- 1단계 (이슈 생성): 30분
- 2단계 (기획서 작성): 1-2시간
- 3단계 (화면설계서 작성): **2-3시간** (화면당 30분-1시간)
- 4단계 (GitHub Pages 배포): 10분
- 5단계 (이슈 카드 업데이트): 10분
- **총 예상 시간**: 4-6시간 (화면 개수에 따라 변동)

### 필수 규칙
- ✅ **UI 포함 프론트 작업 = 화면설계서 필수**
- ✅ 화면설계서는 반드시 `semicolon-devteam/docs` 레포에 업로드
- ✅ 이슈 카드에는 GitHub Pages 웹 링크 사용
- ❌ 로컬 파일 경로 (`file://`) 절대 금지
- ❌ 화면설계서 없이 `bot:spec-ready` 라벨 전환 금지

### 관련 봇
- **레포 정보**: SemiClaw (`<@U0ADGB42N79>`)

---

## 이슈 생성 시 작업 주체 확인 프로토콜 (2026-03-05 Reus 지시)

**핵심 원칙: 이슈카드 생성 전 반드시 작업 주체를 먼저 물어볼 것**

### 필수 질문
이슈 생성 요청이 들어오면:
> "이 작업은 누가 진행하나요?  
> 1. 봇 자동화 (WorkClaw/ReviewClaw 등이 처리)  
> 2. 사람 직접 작업 (개발자가 수동으로 처리)"

### 작업 주체별 라벨링

| 작업 주체 | 라벨링 규칙 | 효과 |
|---------|-----------|------|
| **봇 자동화** | `bot:needs-spec` 또는 `bot:spec-ready` 등 적절한 `bot:*` 라벨 부착 | WorkClaw/ReviewClaw 등이 폴링으로 감지 → 자동 처리 |
| **사람 직접 작업** | `bot:*` 라벨 **일절 부착하지 않음** | 봇 폴링 대상에서 제외 → 노이즈 방지 |

### 라벨 부착 기준
- **봇이 처리할 수 있는 작업**: 코딩, 리뷰, E2E 테스트, 디자인 구현 등
- **사람이 직접 해야 하는 작업**: 기획 회의, 외부 협의, 수동 배포, 인프라 세팅 등

### 예시

**봇 자동화 케이스**:
- "로그인 API 구현" → `bot:spec-ready` (WorkClaw이 폴링으로 감지)
- "PR 리뷰 필요" → `bot:needs-review` (ReviewClaw이 폴링으로 감지)

**사람 직접 작업 케이스**:
- "Reus와 기획 회의" → `bot:*` 라벨 없음 (봇 폴링 제외)
- "외주 업체 세팅" → `bot:*` 라벨 없음 (봇 폴링 제외)

### 절대 규칙
- ❌ **작업 주체 확인 없이 무조건 `bot:*` 라벨 붙이지 말 것**
- ❌ **사람 작업 이슈에 `bot:*` 라벨 붙이면 봇이 폴링해서 노이즈 발생**
- ✅ **확실하지 않으면 반드시 먼저 물어볼 것**

---

## 보안 원칙

- 대외비 프로젝트 (cm-land, cm-office) 정보 외부 유출 금지
- 계약/금액: 리더 DM 또는 #개발사업팀 (C020RQTNPFY)에서만
- 극비 (계약금액, 지분율, 급여): Reus DM에서만

---

## 라벨 전환 시 이전 단계 정리 필수 (2026-03-06 SemiClaw 전파, Reus 지시)

**핵심 원칙: 라벨 전환 시 이전 단계 라벨을 반드시 제거할 것**

### 발견된 문제
- closed + bot:done 상태인데 bot:in-progress가 남아있는 이슈 6건 발견
- 라벨 전환 로직이 "추가만 하고 이전 라벨 제거를 안 하는" 패턴

### 필수 규칙
- ✅ **`bot:in-progress` → `bot:done` 전환 시: `bot:in-progress` 제거 필수**
- ✅ **이슈 close 시에도 `bot:in-progress` 잔존 여부 확인**
- ✅ **라벨 전환 = 이전 라벨 제거 + 새 라벨 추가** (두 작업 모두 필수)

### PlanClaw 적용 사항
- 기획 완료 시: `bot:needs-spec` 제거 + `bot:spec-ready` 추가
- 이슈 close 시: `bot:in-progress` 잔존 여부 확인 후 제거
- **GitHub 명령어 예시**:
  ```bash
  # 라벨 제거 + 추가를 한 번에
  gh issue edit <number> --repo semicolon-devteam/<repo> \
    --remove-label "bot:needs-spec" \
    --add-label "bot:spec-ready"
  ```

### 대처방안
- SemiClaw 일일 점검에 `closed + bot:in-progress` 잔존 이슈 자동 탐지 &amp; 정리 추가됨
- 모든 작업봇은 라벨 전환 시 이전 단계 라벨 제거를 워크플로우에 반영
