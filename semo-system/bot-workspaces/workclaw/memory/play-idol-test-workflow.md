# 플레이아이돌 테스트 & 배포 워크플로우 (2026-02-15~)

## 지속 테스트 프로세스

### 크론잡 동작
1. 각 이슈카드 테스트케이스 체크리스트를 기준으로 FE 코드 점검
2. 실패 항목 발견 시:
   - feature 브랜치 생성 (`fix/<issue>-<slug>`)
   - 수정 구현 + 빌드 확인 (`tsc --noEmit`)
   - PR 등록 → dev 브랜치 대상
   - 자가리뷰 후 머지
3. 머지 후:
   - GitHub Actions 확인 → 배포 완료 대기
   - 개발환경 E2E 테스트 실행 (play-land-dev.semi-colon.space)
4. 이슈카드 체크리스트 갱신 (통과 항목 체크)

### FE E2E 테스트 환경 (로컬 FE)
- **로컬 FE**: localhost:3000
- **스프링 백엔드**: 반드시 개발서버(`play-backend-dev.semi-colon.space`)를 바라봐야 함
  - `.env`의 `NEXT_PUBLIC_SPRING_API_BASE_URL`을 개발서버 URL로 설정
  - 로컬 스프링(localhost:8080)을 바라보면 스프링 로그인창이 뜨면서 테스트 불가
- **Supabase**: `play-supabase-dev.semi-colon.space` (기존 설정 유지)
- 브라우저(browser 도구)로 테스트 수행. curl/API 직접 호출 금지.

### FE E2E 테스트 환경 (개발서버)
- **개발서버 FE**: play-land-dev.semi-colon.space
- PR 머지 → GH Actions 배포 완료 후 테스트

### BE 테스트 방법
- 로컬 스프링 백엔드(localhost:8080) 구동
- HTTP curl 테스트로 API 검증
- feature 브랜치 → PR → dev 머지 → 개발서버 자동 배포

### 공통
- 테스트 계정: test / 123123 (일반), admin / ComAdminPass1212 (관리자)
- FE 레포: `/Users/reus/Desktop/Sources/semicolon/land/proj-play-land`
- BE 레포: `/Users/reus/Desktop/Sources/semicolon/land/core-backend`
- 머지 대상 브랜치: `dev`

### 관련 이슈
- #1 Epic, #2 캐러셀/피드/상세, #3 채팅탭/신청UI, #4 설정/관리자
- #5 API연동, #7 신청폼 API연동, #12 전체 E2E 테스트

### 규칙
- 수정 시 반드시 PR 등록 + 자가리뷰
- 머지 후 GH Actions 배포 확인 필수
- 배포 후 개발환경 E2E 동일 수행
- 이슈카드 체크리스트 지속 갱신
