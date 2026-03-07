# decisions.md — 의사결정 / 원칙 / 교육 내용

## GitHub 운영 규칙

→ `memory/github-rules.md` 참조 (이슈 체크리스트, 라벨 전환, 프로젝트 보드, OAT 설정 등)

---

## 디자인 스펙 작성 방식

- 이슈 코멘트에 Tailwind CSS 클래스 + JSX 컴포넌트 예시 포함
- 완료 조건 체크리스트 포함
- 와이어프레임 이미지 링크 (Imgur 업로드 방식)

## Slack 메시지 발송 원칙 (2026-02-18 초안, 2026-02-19 강화 — Reus 지시, NON-NEGOTIABLE)

**절대 규칙 (위반 시 Reus 에스컬레이션):**
1. **Slack에는 최종 결과만 보고** — PR 생성/완료, 리뷰 결과, 블로커, 중요 의사결정 등 actionable한 것만
2. **중간 과정 절대 금지** — 클론, install, 빌드, 분석, 코드 검토, 전략 정리, 계획 수립 등 내부 작업 과정
3. **"~하겠다", "~시작한다", "~확인하겠다" 류 예고성 메시지 금지** — 한 거 보고해, 할 거 예고하지 마
4. **1 작업 = 1 메시지 원칙** — 쪼개서 여러 번 보내지 말 것
5. **서브에이전트 작업 중 상태 업데이트 금지** — 완료 후 결과만 보고

**배경**: Tool call 사이에 중간 텍스트를 쓰면 각각 별도 Slack 메시지로 나가므로 토큰 낭비 + UX 저하. 다른 봇이 중간 메시지를 모두 읽어야 해서 팀 전체 토큰 낭비 발생.

---

## 봇 간 정보 공유 프로토콜 (2026-02-19, SemiClaw 공지, Reus 승인)

### 질의 형식
- 요청: `[bot:info-req]` @대상봇 {프로젝트명} — {질문} / 요청봇: @본인
- 응답: `[bot:info-res]` @요청봇 {답변}
- 모를 때: `[bot:info-unknown]` → SemiClaw 라우팅 or Reus 에스컬레이션
- 모르면 → <@U0ADGB42N79> 에게 먼저 질의

### DesignClaw 정보 도메인
UI/UX 분석, 디자인 시스템, 접근성

### 봇별 정보 도메인 (참조용)
| 봇 | 도메인 |
|---|---|
| SemiClaw | 프로젝트 현황, 팀원 정보, 일정, 채널/레포 매핑 |
| PlanClaw | 기획 문서, 기능 스펙, 유저 플로우, PRD |
| WorkClaw | 코드 구조, 기술 스택, 구현 상세, 빌드 설정 |
| ReviewClaw | 코드 품질, 테스트 결과, E2E 리포트, 기술 부채 |
| DesignClaw | UI/UX 분석, 디자인 시스템, 접근성 |
| GrowthClaw | SEO 점수, Lighthouse, 마케팅 지표, 경쟁사 분석 |
| InfraClaw | 배포 상태, CI/CD, 서버 구성, 도메인, 시크릿 |

---

## 봇 간 인계 방식 변경 (2026-02-20, Reus 승인, NON-NEGOTIABLE)

**모든 봇 간 직접 Slack 멘션 인계 전면 폐기 → 순수 GitHub 라벨+폴링 방식으로 전환**

### 절대 규칙
1. ❌ **작업 인계 목적으로 다른 봇을 Slack 멘션하지 말 것**
2. ✅ **GitHub 이슈에 적절한 `bot:*` 라벨만 부착 → 다음 봇이 폴링으로 감지**
3. 라벨 체인: `bot:needs-spec` → `bot:spec-ready` → `bot:needs-review` → `bot:done`
4. 리뷰 피드백: ReviewClaw은 `request changes`만. WorkClaw이 `review:changes_requested` 폴링으로 감지
5. E2E 버그: 이슈 생성 + `bot:spec-ready` 라벨만 (멘션 X)
6. 정보 요청: GitHub 이슈 `bot:info-req` 라벨 경유. 답변 후 즉시 close
7. `bot:blocked`는 SemiClaw이 15분 폴링으로 감지

### 폴링 주기 (기존과 동일)
- PlanClaw: 10분
- WorkClaw: 5분
- ReviewClaw: 5분
- SemiClaw: 15분

### DesignClaw 적용 사항
- 디자인 스펙 완료 후 → `bot:spec-ready` 라벨만 부착 (WorkClaw 멘션 금지)
- UI 리뷰 요청 받으면 → 코멘트 작성 + 라벨 전환 (직접 멘션 금지)
- 정보 모를 때 → GitHub 이슈에 `bot:info-req` 라벨 + 코멘트 질의

---

## 이미지 공유 방법

- Slack bot token에 `files:write` 스코프 없음
- 대안: Imgur 익명 업로드 (`curl -X POST https://api.imgur.com/3/image -H "Authorization: Client-ID 546c25a59c58ad7"`)
- Chrome headless 렌더링: `Google Chrome --headless=new --screenshot=output.png --window-size=WxH file://path.html`

---

## 프로젝트 디렉토리 관리 원칙 (2026-02-19, Reus 지시 → SemiClaw 전파)

### 1. 프로젝트 소스코드 위치
모든 프로젝트는 `/Users/reus/Desktop/Sources/semicolon/projects/` 하위에 위치

**주요 매핑:**
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

### 2. 필수 규칙 (NON-NEGOTIABLE)
✅ **작업 시 반드시 해당 프로젝트 디렉토리에서 수행**
❌ **디렉토리가 없는 프로젝트 → 임의로 git clone이나 디렉토리 생성 절대 금지**
   → SemiClaw(<@U0ADGB42N79>)에게 문의
   → Reus에게 보고하여 세팅
❌ **프로젝트 정보를 모를 때 → 추측하지 말고 관련 봇에게 `[bot:info-req]` 형식으로 문의**

### 3. 정보 모를 때 질의 순서
1. 프로젝트 현황/매핑 → SemiClaw(<@U0ADGB42N79>)
2. 기획/스펙 → PlanClaw(<@U0AFNMGKURX>)
3. 코드/기술 → WorkClaw(<@U0AFECSJHK3>)
4. 인프라/배포 → InfraClaw(<@U0AFPDMCGHX>)

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

### 라벨 전환 규칙 (2026-03-06, SemiClaw 공지, NON-NEGOTIABLE)

**필수 규칙: 라벨 전환 시 이전 단계 라벨 반드시 제거**

1. **`bot:in-progress` → `bot:done` 전환 시**:
   - `bot:done` 라벨 추가 전에 **반드시 `bot:in-progress` 라벨 제거**
   - 명령어: `gh issue edit <number> --remove-label "bot:in-progress" --add-label "bot:done"`

2. **이슈 close 시**:
   - `bot:in-progress` 잔존 여부 확인
   - 남아있으면 제거

3. **배경**:
   - closed + bot:done 상태인데 bot:in-progress가 남아있는 이슈 6건 발견
   - 라벨 전환 로직이 "추가만 하고 이전 라벨 제거를 안 하는" 패턴이 원인

4. **적용 범위**:
   - 모든 `bot:*` 라벨 전환 시 이전 단계 라벨 정리 필수
   - 특히 `bot:in-progress` → `bot:done` 전환 시 주의

---

## 🎨 디자인 워크플로우 (2026-03-01, Reus 지시, NON-NEGOTIABLE)

### 필수 단계
모든 디자인 작업은 **반드시 인터랙티브 프리뷰 먼저!**

1. **디자인 요청 접수**
2. **HTML 프로토타입 작성** (TailwindCSS, 실제 동작하는 코드)
3. **인터랙티브 프리뷰 공유**:
   - Canvas로 렌더링 (`canvas` tool) — 우선순위 1
   - 또는 HTML 파일 저장 후 경로 공유
   - 스크린샷 첨부 (Imgur 업로드)
4. **Reus 리뷰 & 피드백 반영**
5. **최종 승인 받으면 → 그때 구현 이슈 생성**

### ❌ 절대 금지
- 마크다운 문서만 작성하고 바로 구현 이슈 생성
- 승인 없이 다음 단계 진행
- 시각적 프리뷰 없이 WorkClaw 인계

### Canvas 활용법
```bash
# HTML 파일을 Canvas로 렌더링
canvas present <html-file-path>

# 또는 직접 HTML 문자열
canvas eval "<html>...</html>"
```

### 참고 사례
- 과거 작업물: `point-exchanger-mockup.html` (성공 사례)
- 현재 작업물: `land-account-linking-point-exchange-design.md` (프리뷰 누락 → 수정 필요)

---

## 디자인 시안 웹 공유 방법 (2026-03-01, Reus 재교육, NON-NEGOTIABLE)

### 핵심 원칙: 반드시 웹 URL로 공유
- **배경**: Reus와 물리적으로 다른 PC에 있음 → 로컬 파일 경로는 무의미
- **절대 규칙**: `file://...` 경로, workspace 상대 경로 공유 금지
- **필수**: 웹 브라우저로 바로 접근 가능한 URL 제공

### 웹 공유 방법 (우선순위)

**1. CodePen/JSFiddle/CodeSandbox 업로드 (최우선)**
```bash
# CodePen API (익명)
curl -X POST https://cpwebassets.codepen.io/assets/packs/json/evanyou-68c2889346fca3af156f.json

# 또는 JSFiddle
# https://jsfiddle.net/ 에서 수동 업로드 후 Share 링크

# 또는 CodeSandbox
# https://codesandbox.io/ 에서 업로드
```

**2. Playwright 브라우저 확인 + 스크린샷**
```bash
# browser tool 사용
browser screenshot --url "file://<절대경로>" --fullPage true

# 또는 브라우저 열어서 직접 확인
browser open --url "file://<절대경로>"
browser snapshot
```

**3. Canvas 렌더링**
```bash
canvas present --url "file://<절대경로>"
```

### 작업 순서 (강제)
1. HTML 프로토타입 완성
2. **본인이 먼저 Playwright로 확인** (UI 깨짐 여부 검증)
3. CodePen 등에 업로드 → 웹 URL 획득
4. **다시 한번 웹 URL을 브라우저로 열어서 확인**
5. 확인 완료한 URL을 Reus에게 공유

### ❌ 절대 금지
- "workspace/design.html 저장했습니다" 같은 로컬 경로 공유
- 확인 안 하고 URL만 던지기
- 마크다운 코드 블록만 공유

### 디자인 피드백 및 공유 프로토콜 (2026-02-23, Reus 지시)

### DesignClaw 역할 (필수 수행)
1. **디자인 확인 및 피드백 시**
   - Playwright 활용하여 UI 직접 확인
   - 필요 시 스크린샷 캡처 후 공유

2. **디자인 시안 공유 방법**
   - HTML 마크업 작업 완료 후:
     - **방법 1 (최우선)**: CodePen/JSFiddle/CodeSandbox 업로드 → 웹 URL
     - **방법 2**: Playwright 스크린샷 (browser tool)
     - **방법 3**: Canvas 렌더링 (`canvas` tool)

### 적용 범위
- 디자인 피드백 요청 받을 때
- 디자인 시안 공유 필요할 때
- UI 리뷰 작업 시
