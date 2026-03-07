# review-standards.md — 리뷰 기준 및 프로세스

## 리뷰 프로세스 (Critical!)

### 1. 전체 파일 컨텍스트 확인 필수
- **❌ diff만 보고 리뷰 금지** — import 누락 등 false positive 위험
- **✅ 수정 파일 전체 읽기** — `gh pr diff` + `Read <file>`로 전체 확인
- 특히 import, 타입 정의, 전역 변수는 diff에 안 보이는 경우 많음

### 2. 검증 단계
1. **Diff 확인**: `gh pr diff <number>` — 변경사항 파악
2. **전체 파일 확인**: 수정된 각 파일 전체 읽기 — 컨텍스트 누락 방지
3. **컴파일 체크**: `tsc --noEmit` / `npm run build` — 타입 에러 확인
4. **Before/After 비교**: 중요 변경 시 부모 커밋과 비교 — regression 탐지

### 3. 교훈 (2026-03-02, PR #142)
- **사례**: `clientSupabase` import 누락 지적 → 실제로는 파일 4번째 줄에 존재
- **원인**: diff만 보고 전체 파일 미확인
- **개선**: 모든 리뷰 시 수정 파일 전체 읽기

---

## 코드 리뷰 기준
- DB 스키마 변경 시 로컬 쿼리 테스트 필수
- 커밋 전 `npm run build` + DB 쿼리 확인
- 배포 후 E2E (랜딩/리스트/상세 3페이지)

## 리뷰 피드백 레벨
- `[MUST]` 🔴 반드시 수정 / `[SHOULD]` 🟡 수정 권장 / `[CONSIDER]` 🟢 고려 제안
- `[QUESTION]` 설명 요청 / `[PRAISE]` 👍 칭찬

## 리뷰 체크리스트
- 기능: 요구사항 충족, 엣지케이스, 에러처리, 데이터 검증
- 코드 품질: DRY, SOLID, 추상화, 네이밍
- 성능: 불필요한 연산, 알고리즘, 메모리 누수, 캐싱
- 보안: 입력값 검증, SQL Injection, XSS, 민감정보 노출
- 테스트: 단위/통합 테스트, 커버리지

## 🚨 SSR 전환 PR 리뷰 체크리스트 (2026-02-26, PR #169 Regression 교훈)

**배경**: PR #169에서 SSR → CSR regression 발생. 메인 토론 목록 `getDebates()` prefetch 누락으로 로딩 스피너 노출.

**필수 체크 (Regression 탐지)**:

1. **Before/After 데이터 fetch 비교 (Critical!)**
   ```bash
   # Before 코드 확인 (부모 커밋)
   gh api /repos/<org>/<repo>/commits/<commit> --jq '.parents[0].sha' | \
   xargs -I {} gh api '/repos/<org>/<repo>/contents/<file>?ref={}' --jq '.content' | base64 -d
   
   # After 코드 확인 (현재 커밋)
   gh pr diff <number> -R <org>/<repo>
   ```
   - [ ] Before에서 호출하던 모든 fetch 함수 목록 작성
   - [ ] After에서 prefetch하는 모든 query 목록 작성
   - [ ] **1:1 매핑 확인** — Before의 모든 fetch가 After에 대응되는가?
   - [ ] 누락된 fetch 없는지 명시적으로 확인

2. **제거된 기능 탐지**
   - [ ] `git diff`에서 `-` (삭제) 라인 중 `fetch`, `get`, `load` 등 데이터 로딩 함수 검색
   - [ ] 삭제된 각 함수가 새로운 prefetch로 대체되었는지 확인
   - [ ] 대체되지 않았으면 **Critical Regression** — Must Fix

3. **SSR 동작 검증**
   - [ ] 각 페이지의 prefetch가 페이지에서 실제로 사용하는 데이터와 일치하는가?
   - [ ] `HydrationBoundary`로 전달되는 `dehydratedState`에 필요한 모든 query가 포함되는가?
   - [ ] 클라이언트 컴포넌트에서 `useQuery` 호출 시 SSR 캐시를 사용하는가? (로딩 스피너 없어야 함)

4. **에러 핸들링 (기존 체크리스트 + SSR 특수)**
   - [ ] prefetch 실패 시 CSR fallback 동작하는가?
   - [ ] 부분 실패 시나리오 (일부 query만 실패) 고려했는가?

**Should Fix**:
- [ ] 중복 prefetch 제거 (여러 페이지에서 동일한 query 반복 시 layout.tsx로 이동 검토)
- [ ] prefetch 패턴 HOC/헬퍼 추출 (코드 중복 제거)

**위반 사례 (교훈)**:
- **PR #169 (2026-02-25)**: `src/app/page.tsx`에서 `getDebates()` prefetch 누락
  - Before: `getDebates()` + `getCloseDebates(3)` + `fetchLatestNews(3)` (3개)
  - After: `closeDebatesOptions(3)` + `latestNewsOptions(3)` (2개)
  - 결과: 메인 토론 목록이 SSR에서 로드 안 되고 CSR만 로드 → 로딩 스피너 노출
  - 교훈: "추가된 것"만 체크하지 말고 **"제거된 것"도 명시적으로 체크**

## PR 가이드라인
- 200줄 이하 권장, 단일 목적
- PR 생성 전 자체 검토, UI 변경 시 스크린샷, 이슈 연결 필수
- Squash and merge 또는 Merge commit

## GitHub 운영 규칙
→ `memory/github-rules.md` 참조 (이슈 체크리스트, OAT, 라벨, 폴링, 워크플로우 등 통합)

## 플레이아이돌 E2E 정기 테스트 (WorkClaw→ReviewClaw 인계, 2026-02-18)
- cron job ID: `d73a9de6-761f-40ef-ac72-08ad92a26fbd`
- 주기: 매시 정각 9~22시 KST
- 대상: play-land-dev.semi-colon.space (semicolon-devteam/proj-play-land)
- 계정: test/123123 (일반), admin/ComAdminPass1212 (관리자)
- 이슈 #12: 전체 E2E 테스트케이스 체크리스트
- 실패 시: GitHub 이슈 생성 (라벨: bot:spec-ready, assignee: WorkClaw)
- 결과 보고: Slack C08P9TDK0UR
- 코드 직접 수정 금지 → 이슈카드로만 처리
- **E2E 후처리 순서 (SemiClaw 원칙, 2026-02-18)**:
  1. 실패 항목 → GitHub 이슈 생성 (`bot:spec-ready` 라벨)
  2. 이슈 생성 완료 → `#bot-ops`에서 <@U0ADGB42N79>(SemiClaw) 멘션 + 이슈 링크 포함 인계
  3. 인계 완료 후 → 프로젝트 채널에 테스트 리포트 발행
  - ⚠️ 인계 없이 리포트만 올리면 안 됨. 순서: ① 이슈 → ② 인계 → ③ 리포트
