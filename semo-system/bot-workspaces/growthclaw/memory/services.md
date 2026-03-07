# services.md — 서비스 운영 현황

## 정치판
- **서비스 유형**: 정치 커뮤니티 플랫폼
- **프로덕션 URL**: https://jungchipan.net
- **GitHub 레포**: https://github.com/semicolon-devteam/cm-jungchipan
- **기술 스택**: Next.js (SSR, static page 없음)
- **로컬 디렉토리**: `/Users/reus/Desktop/Sources/semicolon/projects/jungchipan`

### Google 연동 현황 (✅ 완료)
- **Search Console**: `sc-domain:jungchipan.net` (서비스 계정 연동)
- **GA4 Property ID**: `516515301`
- **GTM ID**: `GTM-TJHH9X6N` (하드코딩)
- **클라이언트 gtag**: `NEXT_PUBLIC_GA_ID` (환경변수)
- **구현 위치**: `src/components/GoogleAnalytics.tsx`, `src/components/GoogleTagManager.tsx`
- **Slack 리포트 채널**: `#정치판` (C09AL1LUFV4)

### SEO 현황 (2026-02-25 기준)
  - 검색 노출: 0회
  - 검색 클릭: 0회
  - 평균 CTR: 0.0%
  - 평균 순위: 0.0위
  - **⚠️ 치명적 이슈**: Search Console 등록은 되어 있으나 실제 노출 0 → 크롤링 차단 또는 색인 문제 추정

### GA4 최근 지표 (2026-02-25)
  - 활성 사용자: 3명 (WoW ↓ 25.0%)
  - 세션: 5회
  - 페이지뷰: 22회 (WoW ±0.0%)
  - 평균 체류: 11분 18초
  - 이탈률: 60.0%
  - 인기 페이지: `/` (15 PV), `/news/df5f2113-f78d-41c0-a2e6-0e3b28e41109` (5 PV)

## axoracle
- **서비스 유형**: 직종별 연봉 데이터 플랫폼
- **프로덕션 URL**: https://axoracle.com
- **로컬 디렉토리**: `/Users/reus/Desktop/Sources/semicolon/projects/axoracle` ⚠️ **대소문자 주의**: `axoracle` (소문자) | `Sources` (Projects 아님)
- **GitHub 레포**: (미확인)
- **오픈일**: 2026-02-18 (1일차)
- **현재 홍보 범위**: 국내(KR)만 — 의도적 단계별 오픈
- **향후 홍보 범위**: 미국(/us), 일본 — 추후 별도 홍보 예정
- **⚠️ 주의**: /us, /jp 페이지 작업 금지 (Roki 지시, 2026-02-19) — 다음 단계 홍보 때까지 건드리지 말 것
- **주요 직종 트래픽**: government-administrator, teacher, doctor, university-professor, nurse, architect, mechanical-engineer

### Google 연동 현황 (✅ 완료)
- **Search Console**: `sc-domain:axoracle.com` (서비스 계정 연동)
- **GA4 Property ID**: `524966604`
- **GTM ID**: `GTM-MPLD6Q62` (하드코딩)
- **구현 위치**: `src/components/GoogleTagManager.tsx`
- **Slack 리포트 채널**: `#axoracle` (C0AE4N0LSKV)

### GA4 첫날 주요 지표 (2026-02-18)
  - 활성 사용자: 2,575명 | 새 사용자: ~2,200명
  - 평균 참여 시간: 1분 06초
  - 홈(/) 참여 시간: 17초 (핵심 병목)
  - 직종 상세 페이지: 27~42초 (상대적으로 양호)

## 현재 집중 개선 과제 (1~3순위)
1. 홈 검색창 전면 배치 + CTA 개선
2. 히어로 섹션 카피 개편
3. 직종 페이지 내 연관 직종 탐색 유도
