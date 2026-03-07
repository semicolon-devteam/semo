# 운영 & 도구

## 프로젝트 관리 루틴
- 트래커: `memory/project-tracker.json`
- 매주 금요일 14:00 주간 리포트 → #개발사업팀 (C020RQTNPFY)
- 매주 목요일 14:00 담당자별 컨텍스트 수집 (DM)
- GitHub 모니터링 + 팀원 체크인으로 진척 파악

## Google Calendar
- 팀 캘린더: "세미콜론"
- Calendar ID: `2b3dabe6b67a16c869653de312ba2952d98901ad036cd2987e9959252bb6cd65@group.calendar.google.com`
- 토큰: `scripts/gcal-tokens.json`
- **참석자 표기**: 이벤트 제목에 `@닉네임` 형태
- 닉네임→Slack ID: reus=URSQYUNQJ, garden=URU4UBX9R, yeomso=U01KH8V6ZHP, roki=U08P11ZQY04, bon=U09LF7ZS5GR, kyago=U02G8542V9U, bae=U0A54SCQS84, harry=U08PB15P4AV, goni=U09NRR79YCW, kai=U0A4W1U0BAN
- 매일 오전 10시: 오늘+내일 일정 확인 → 참석자 리마인드 DM
- 어제 미팅 확인: 참석자에게 결과/논의 내용 물어보기

## 회의록 보관소
- `semicolon-devteam/command-center` 레포 GitHub Discussions
  - Meeting-Minutes / Decision-Log 카테고리
- ⚠️ command-center는 리더 전용 레포

## 기획 문서
- `semicolon-devteam/docs` (전체 팀 공유)
- PlanClaw이 Issue Card 형식으로 기획서 작성/공유

## 포트폴리오 & SI 플랫폼
### 내부 포트폴리오 (command-center/docs/portfolio/)
- 총 32개 등록, 포맷 통일, Vercel: ladley (team-semicolon)

### 위시캣 (Wishket)
- 파트너명: `semicolon_devteam` | 가입일: 2026.01.27
- URL: https://www.wishket.com/partners/p/semicolon_devteam/
- 등록 포트폴리오 7개 (2026-02-13 기준)
- 보유기술: 27개
- **계정 정보**: reus@semi-colon.space / team-semicolon
- **현재 등급**: BASIC 파트너 (2026-03-01 확인)
- **프로젝트 크롤링**: 매일 오전 크롤링 → 40점 이상 → Slack 전송 (C0ABAE680PR, @yeomso)
  - 스코어링 로직: `scripts/wishket-score.js`
  - 문서: `scripts/README-wishket.md`
  - Cron job: 매일 9:00 (KST)
  - 스코어 기준: 팀 스택(TypeScript/React/Kotlin/Spring Boot 등) + 도메인(AI/핀테크/교육 등) + 예산 + 경쟁률
  - **등급별 필터링 규칙 (2026-03-01)**: 
    - 위시켓 파트너 등급: BASIC → BOOST → PRO → PRIME
    - 등급별로 지원 가능한 프로젝트가 다름 (상위 등급 프로젝트는 접근 제한)
    - **현재 BASIC 등급**이므로 BOOST/PRO/PRIME 전용 프로젝트는 크롤링 결과에서 제외해야 함
    - 반드시 로그인 후 실제 화면에서 "지원하기" 버튼 활성화 여부 확인
    - 크롤러 업데이트 필요: Playwright 로그인 + 각 프로젝트 상세 페이지 접근권한 체크
