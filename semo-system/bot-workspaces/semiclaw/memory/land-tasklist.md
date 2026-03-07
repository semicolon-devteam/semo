# 🏗️ 랜드 플랫폼 개편 태스크리스트

> 최종 업데이트: 2026-03-04 19:04
> 담당자: bon(풀스택), Garden(인프라/아키텍처), Reus(프론트리드), Roki(서비스총괄), kyago(백엔드리더)

## 인프라 분리
- [x] 게임랜드 인프라 분리 — @Garden ✅ 완료 (논리적 분리 + 독립 운영, 2/16)
- [x] 플레이랜드 인프라 분리 — @Garden ✅ 완료 (논리적 분리 + 독립 운영, 2/16)
- [ ] OCI CSP 이관 — @Garden (예정)

## 오피스랜드 (cm-office)
- [ ] 포인트 기능 활성화 (game-land 참고) — 선행 필수 (@Garden 확인 2/15)
- [x] 쿠폰 발행 및 구매 시스템 개발 (Garden 요구사항 V2.0) — @bon ✅ 완료 (2/23)
  - [ ] Admin: 쿠폰 정책 관리 (사이트 Config)
  - [ ] Admin: 업체 등록 쿠폰 승인/반려
  - [ ] Partner: 쿠폰 등록/수정/삭제/통계
  - [ ] Partner: 사용 처리(Redeem) — UUID/QR
  - [ ] User: 쿠폰 목록 (필터링, 카드형 UI)
  - [ ] User: 쿠폰 구매 + 중복 구매 제한
  - [ ] User: 마이페이지 쿠폰함
  - [ ] 동시성 처리 (수량 차감)
  - [ ] UUID 위변조 방지 서버사이드 검증
  - [ ] 유효기간 만료 자동 상태 변경 배치
  - [ ] 알림 (승인→업체, 만료 3일전→사용자)
- [ ] Epic #298: 기업회원 오피스캐시 결제 및 홍보 시스템 — @bon (3/3 시작)
  - [ ] Phase 1 (#303): 오피스캐시 충전 및 홍보 등록 기능 — 🚧 백엔드 완료 (core-backend PR #231, #235 머지, 3/5), 프론트 TBD (cm-office PR #306 머지, 3/5)
  - [ ] Phase 2 (#304): 홍보 만료 알림 및 자동 연장 처리 — 🚧 백엔드 완료 (core-backend PR #234 머지, 3/5), 프론트 TBD
  - [x] Phase 3 (#302): PROMOTED OFFICES 노출 개수/순서 관리 개선 ✅ 완료 (3/4)
- [ ] Spring Boot API 전환 지속 — @bon

## 플레이랜드 (proj-play-land)
- [x] 플레이아이돌 기능점검 및 버그 수정 — @Roki ✅ 완료 (3/5)
  - ✅ #154: 아이돌 상태 변경 UI 추가 (PR #155 머지, 3/5)
  - ✅ #156: 소셜 플랫폼 이미지 URL 지원 및 채팅 idolId 전달 (PR #157 머지, 3/5)
- [ ] 포인트 교환소 width 수정 (#159) — @Reus (오픈, 3/5)
- [ ] Feature 개발 (구체 항목 TBD)

## 게임랜드 (proj-game-land)
- [ ] Feature 개발 (구체 항목 TBD)

## 포인트 통합 생태계 (마이크로서비스)
- [x] 포인트 교환 UI — 4개 랜드 전부 구현 완료 ✅ (cm-land #778/#777, game-land #778/#777, play-land #158/#145, office #306/#300 - 3/5)
- [x] ms-authenticator 개발환경 배포 — @Garden ✅ (3/3)
- [x] ms-point-exchanger 개발환경 배포 — @Garden ✅ (3/3)
- [ ] ms-point-exchanger openapi docs 작성 — @Reus (진행중, 3/4)
- [ ] core-backend #228: ms-point-exchanger용 Internal API Key 발급 — 블로커
- [x] core-backend 포인트 교환소 API 500 에러 수정 ✅ (#237, #238, #239, #240, #241, #242, #243, #244 - 3/5)
  - Flyway 마이그레이션 버전 충돌/스키마 이슈 전면 해결
  - accounts/linked, points/balance, points/history API 정상화
- [ ] 프론트엔드 ↔ 백엔드 통합 테스트

## 플레이랜드 버그/이슈
- [ ] play-land-dev Basic Auth 인증창 문제 (#140) — @bon 백엔드 수정 완료, 프론트 Authorization 헤더 확인 필요
  - kyago에 백엔드 배포 요청 대기 중

## 공통
- [x] 포인트 통합 생태계 — 랜드 간 포인트 교환 UI 완성 (3/1) ✅
- [ ] 서비스 분리 완료 후 Feature 개발 본격화

---

## 📊 일일 진행 현황
<!-- 매일 오전 GitHub 체크 + 담당자 체크인 결과 여기에 기록 -->

### 2026-02-15 (토)
- 태스크리스트 초기 생성
- 오피스랜드 쿠폰 시스템 요구사항 정의 완료 (Garden V2.0)
- 오피스랜드 포인트 기능 미구현 확인 (Garden 2/15)

### 2026-02-16 (일) 09:02
- **GitHub 체크**: core-backend에서 아이돌 관련 버그 수정 5건 (PR #147~#157 머지, Reus 커밋)
- cm-land, cm-office, proj-play-land, proj-game-land: 변동 없음
- 랜드 플랫폼 태스크 진척 사항 없음 (주말)

### 2026-02-16 (월) 14:00
- **GitHub 체크 (최근 8시간)**: 모든 레포에서 활동 없음
- proj-play-land: 어제~오늘 새벽 아이돌 관련 PR 4건 머지됨 (#9~#14)
  - 환전 UI 개선 이슈(#20~#22) 오픈 상태
- core-backend: 아이돌 도네이션 관련 이슈(#158) 오픈 상태
- 랜드 플랫폼 핵심 태스크(인프라 분리, 오피스 쿠폰) 진척 확인 안 됨

### 2026-02-16 (월) 14:01 — 데일리 체크인 수집
- **응답자**: bon, Reus, Roki (스레드 내용 확인 불가 — API 제한)
- **미응답자**: Garden, kyago → 스레드에 리마인드 발송 완료
- ⚠️ 스레드 reply 내용을 읽지 못해 구체적 작업 현황 기록 불가. 다음 체크인 시 보완 필요

### 2026-02-16 (월) 19:02
- **GitHub 체크 (최근 8시간)**: 커밋 활동 없음
- **proj-play-land**: 어제~새벽 아이돌 기능 PR 5건 머지 (#9~#14), 새 이슈 4건 (#23~#26) — 프로필박스/배지 표시
- **core-backend**: 아이돌 도네이션 버그 이슈 #158 오픈, 수정 PR #159 제출됨
- **cm-land, cm-office, proj-game-land**: 활동 없음
- ⚠️ 랜드 플랫폼 핵심 태스크(인프라 분리, 오피스 쿠폰) 관련 진척 없음

### 2026-02-17 (화) 14:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- ⚠️ 랜드 플랫폼 핵심 태스크(인프라 분리, 오피스 쿠폰) 진척 미확인 — 담당자(Garden, bon) 직접 체크인 필요

### 2026-02-18 (수) 09:05
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- ⚠️ 랜드 플랫폼 핵심 태스크(인프라 분리, 오피스 쿠폰) 진척 미확인 — 담당자(Garden, bon) 직접 확인 필요

### 2026-02-18 (수) 14:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- ⚠️ 랜드 플랫폼 핵심 태스크(인프라 분리, 오피스 쿠폰) 진척 미확인 — 담당자(Garden, bon) 직접 확인 필요

### 2026-02-18 (수) 19:01
- **GitHub 체크 (최근 8시간)**: 활발한 커밋 활동
- **cm-land** (Reus): 🚀 v2.0.0 → v2.0.1 연속 릴리즈
  - `feat: 홈페이지 섹션 제목 DB 관리 (#761)` (07:38)
  - `hotfix: _next/image 400 에러 수정 (#763)` (08:46)
  - `fix: kustomize 이미지 경로 DockerHub → GHCR 전환` (인프라, 09:14~09:34)
  - v2.0.0 릴리즈 (08:24), v2.0.1 핫픽스 릴리즈 (09:44)
- **proj-game-land**: cm-land와 동일 릴리즈 — v2.0.0, v2.0.1 릴리즈 완료
- **cm-office** (bon): PR #277 머지 — `feat: 채팅 시스템 구현 (#275)` (09:30)
  - 이슈 #276 코인 결제 기능 오픈
- **proj-play-land** (Reus): 아이돌 기능 대규모 구현
  - 피드 타임라인, 상세 페이지, 캐로셀, 구매 바텀시트, 라이트박스 뷰어 (#63~#66)
  - 커밋 10+건 (06:07~08:50)
- **core-backend** (bon/Reus): 쿠폰+아이돌 API 작업
  - `feat: 피드/상세 응답에 isFree, unlockCost, attachments 필드 추가` (Reus)
  - `feat: Swagger Coupon Domain 그룹 추가` (bon)
  - Flyway 마이그레이션 충돌 수정 (bon)
- ✅ 태스크 진척:
  - cm-office 채팅 기능 구현 완료 (PR #277 머지)
  - proj-play-land 아이돌 콘텐츠 E2E 기능 구현 진행중
  - 인프라 GHCR 전환 (Garden/Reus)

### 2026-02-19 (목) 09:01
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: proj-game-land 2/18 22:48 KST, proj-play-land 2/18 21:58 KST
- ⚠️ 랜드 플랫폼 핵심 태스크(인프라 분리, 오피스 쿠폰 서브태스크) 진척 미확인 — 담당자 확인 필요

### 2026-02-18 (수) 14:01 — 데일리 체크인 수집
- **bon** (U09LF7ZS5GR): 쿠폰작업 마무리 & 이슈카드 처리
- **Roki** (URSQYUNQJ): 플레이아이돌 기능점검 및 버그 수정
- **Garden** (URU4UBX9R): 운영 서비스 분리
- **kyago** (U08P11ZQY04): ❌ 미응답 → 리마인드 발송
- **Reus** (U02G8542V9U): ❌ 미응답 → 리마인드 발송

### 2026-02-17 (화) 19:03
- **GitHub 체크 (최근 8시간)**: 커밋 활동 3건 감지
- **cm-land** (Reus): `fix: 게임 API point_code GAME_POINT → ACTIVITY_POINT 통일 (#756)` — 17:36 KST
- **proj-game-land** (Reus): 동일 수정 반영 — 17:36 KST
- **proj-play-land** (Reus): `feat: 아이돌 콘텐츠 등록 UI 개편 - 유료/무료 토글, 미디어 첨부 (#31)(#35)` — 16:41 KST
- **cm-office, core-backend**: 변동 없음
- ⚠️ 랜드 플랫폼 핵심 태스크(인프라 분리, 오피스 쿠폰) 관련 커밋은 아님 — Game API point_code 버그 수정 및 아이돌 기능 개발 계속

### 2026-02-19 (목) 14:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: cm-land/proj-game-land v2.0.2 릴리즈 (2/18 22:48 KST)
- ⚠️ 랜드 플랫폼 핵심 태스크(인프라 분리, 오피스 쿠폰) 진척 미확인 — 담당자 확인 필요

### 2026-02-19 (목) 14:01 — 데일리 체크인 수집
- **bon** (U09LF7ZS5GR): ✅ 응답 (스레드 reply 내용 API 제한으로 확인 불가)
- **Garden** (URU4UBX9R): ❌ 미응답 → 리마인드 발송
- **Roki** (URSQYUNQJ): ❌ 미응답 → 리마인드 발송
- **kyago** (U08P11ZQY04): ❌ 미응답 → 리마인드 발송 (연속 미응답)
- **Reus** (U02G8542V9U): ❌ 미응답 → 리마인드 발송

### 2026-02-19 (목) 19:02
- **GitHub 체크 (최근 8시간)**: 활발한 개발 활동 감지
- **cm-land** (Bab): 
  - 🐛 어드민 아이콘 이미지 업로드 깨짐 수정 (#759) — 16:17 KST
  - ✨ DB 기반 사이트 리다이렉트 기능 추가 (site_config_kv) — 14:24 KST
  - 🚀 **v2.1.0 릴리즈** — 15:13 KST
- **proj-game-land**: 
  - cm-land와 동일 커밋 반영
  - 🚀 **v2.1.0 릴리즈** — 15:13 KST
- **proj-play-land** (Jeon Junyeong/reus): 아이돌 안정화 집중 작업 — 커밋 9건
  - ✅ Supabase auth stale refresh token 처리 (#99 #104)
  - ✅ 아이돌 프로필/상세 페이지 크래시 수정 (#94 #96 #102 #103)
  - ✅ error boundary 추가로 전역 크래시 방지 (#95 #101)
  - ✅ 로그아웃 시 캐시 미초기화 버그 (#88 #90)
  - ✅ 인피니티 스크롤 페이지당 10개로 조정 (#43 #93)
  - ✅ 아이돌 콘텐츠 미노출 수정 (#89 #91)
  - 📌 이슈 #750 (일일퀘스트 수정) 오픈 상태
- **core-backend** (Jeon Junyeong):
  - ✅ 코인 결제(충전) 기능 구현 완료 (#276 #179)
  - ✅ 코인 결제 동시성 이슈 수정 (#180)
  - ✅ DM 아이돌 채팅 포인트 차감 누락 수정 (#97 #181)
  - ✅ 일일퀘스트: 다운로드 3회 → 추천받기 10회 변경 (#750 #182)
  - ✅ 쿠폰 시스템 API 구현 완료 (#165 closed)
- **cm-office**: 변동 없음
- ✅ **태스크 진척**:
  - **플레이아이돌 안정화** 집중 진행 (Jeon Junyeong) — 버그 8건+ 수정
  - **core-backend 쿠폰 API 구현 완료** (#165) — 오피스 쿠폰 시스템 백엔드 완성
  - **코인 결제 기능 완성** — 동시성 처리 포함

### 2026-02-20 (금) 19:05
- **GitHub 체크 (최근 8시간)**: core-backend에서만 활동 감지
- **core-backend** (Jeon Junyeong): 플레이아이돌 백엔드 작업 — 커밋 3건
  - ✅ 콘텐츠 해금 추적 시스템 구현 (#185) — content_unlocks 테이블 + isUnlocked 필드 지원 (06:49)
  - ✅ broadcast 자기 자신 제외 로직 수정 (#185)
  - 🐛 Flyway V48 마이그레이션 coin_types 스키마 불일치 수정 (#187 #186 closed) (08:00)
  - 🐛 Flyway V48/V50 마이그레이션 종합 수정 (#190 #188 closed) (08:16)
    - V48: coin_types CREATE → ALTER TABLE 전환, symbol → coin_symbol 매핑 수정
    - V50: challenge_action_types code → action_code 수정, FK 충족
  - 📌 이슈 #191 오픈: 🐛 아이돌 콘텐츠 피드 API SQL 문법 에러 (NULLWHERE) 수정
- **cm-land, cm-office, proj-play-land, proj-game-land**: 변동 없음
- ✅ **태스크 진척**:
  - **플레이아이돌 콘텐츠 해금 시스템 백엔드 완성** (#185) — 유료 콘텐츠 잠금/해금 기능 구현
  - **DB 마이그레이션 안정화** — Flyway 스키마 불일치 문제 해결 (coin_types, challenge_action_types)

### 2026-02-22 (일) 09:01
- **GitHub 체크 (최근 8시간)**: 모든 레포에서 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: core-backend 2/20 17:16 KST
- ⚠️ 주말로 활동 없음

### 2026-02-22 (일) 19:00
- **GitHub 체크 (최근 8시간)**: 오늘 오전(04:42~09:06) 활동 감지, 8시간 이내(11:00 이후)는 없음
- **cm-land** (Jeon Junyeong/Reus): 댓글 버그 수정 집중 작업
  - 🐛 #765 알림 댓글 클릭 시 콘텐츠 미이동 버그 수정 (04:42~06:50 closed)
  - 🐛 #766 댓글 계급 마크 1레벨 통일 버그 수정 (#770 #771 closed, 05:08~05:39)
  - 📌 #764 인피니티 스크롤 페이지당 20개→10개 수정 필요 (오픈)
  - 🚀 **v2.1.1 릴리즈** (07:59)
- **proj-game-land**: cm-land와 동일 릴리즈 — **v2.1.1** (07:59)
- **proj-play-land**: 
  - 🐛 #107 game remote 댓글 계급 마크 버그 수정 체리픽 (09:05~09:06 closed)
  - #43, #44 (인피니티 스크롤, 알림 이동) 오늘 업데이트
- **cm-office**: 
  - #276 (코인 결제 기능) 업데이트 (07:36)
  - #151 (알림 Epic) 업데이트 (07:31)
  - #185 (SEO 최적화) 업데이트 (04:34)
- **core-backend**: 아이돌 콘텐츠 피드 관련 작업
  - 🐛 #201 아이돌 콘텐츠 피드 API 500 에러 수정 (SQL 문법 오류) — #202, #203 PR closed (06:16~06:24)
  - ✨ #204 댓글/답글 오프셋 기반 페이징 API 추가 (#637) — closed (08:00)
- ✅ **태스크 진척**:
  - **댓글 시스템 안정화** — cm-land/play-land 댓글 계급 마크 버그 수정 완료
  - **core-backend 아이돌 피드 API 안정화** — SQL 에러 수정, 페이징 API 추가
  - **cm-office Epic 진행중** — 코인 결제, 알림, SEO

### 2026-02-23 (월) 14:00
- **GitHub 체크 (최근 8시간)**: proj-play-land에서 커밋 1건 감지
- **proj-play-land** (장현봉): 
  - ✨ 아이돌 기능 API 타입 자동생성 파일 업데이트 및 타입 호환성 수정 (a1a11fd, 10:42)
- **cm-land, cm-office, proj-game-land, core-backend**: 변동 없음
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-23 (월) 19:04
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-24 (화) 09:01
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: proj-play-land 2/23 19:42 KST
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-24 (화) 14:00
- **GitHub 체크 (최근 8시간)**: 이슈 변동 2건 감지 (커밋/PR/릴리즈 없음)
- **cm-office**: 
  - ✅ #278 "채팅 관리자 일괄전송 API 개발" 종료 (00:27)
    - 채팅 시스템(PR #277, 2/18) 후속 기능 완료
- **proj-play-land**: 
  - 📌 #112 "일일퀘스트 - 다운로드 항목을 추천 받기 10회로 수정" 신규 오픈 (00:25)
    - core-backend #750/#182 (2/19)에서 백엔드 처리 완료, 프론트엔드 반영 필요
- **cm-land, proj-game-land, core-backend**: 변동 없음
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-24 (화) 14:01 — 데일리 체크인 수집
- **bon** (U09LF7ZS5GR): ✅ 응답 (스레드 reply 내용 API 제한으로 확인 불가)
- **Garden** (URU4UBX9R): ❌ 미응답
- **Roki** (URSQYUNQJ): ✅ DM 응답 (15:31)
  - 이번주 이사로 바쁨
  - PS 어드민: 버그 수정 완료, 종료
  - 게임랜드: 아직 수정할 내용 많음
  - 이번주 작업: 이사 + 랜드 분할 + 베베케어 + X 오라클 + 랜드 소통/커뮤니케이션
- **kyago** (U08P11ZQY04): ❌ 미응답
- **Reus** (U02G8542V9U): ❌ 미응답
- ⚠️ 미응답자 3명 (Garden, kyago, Reus) → 2시간 후(16:00) 리마인드 크론 필요

### 2026-02-24 (화) 19:02
- **GitHub 체크 (최근 8시간)**: 릴리즈 3건 + Spring Boot 마이그레이션 진척
- **cm-office** (장현봉): 
  - 🚀 **v1.0.33 릴리즈** (16:48 KST)
  - ✅ PR #285 머지: 자동생성 API 클라이언트 업데이트 (#189) (17:53)
  - ✅ PR #284 머지: 게시글 상세 조회 Spring Boot API **1-Hop 마이그레이션** (#189) (17:50)
    - 2-Hop(Next.js) → 1-Hop(Spring Boot) 전환 완료
    - PostDetailResponseType camelCase 통일, 타입 정확도 개선
- **cm-land**: 
  - 🚀 **v2.1.2 릴리즈** (16:38 KST)
  - 릴리즈 자동화 머지 커밋 3건
- **proj-game-land**: 
  - 🚀 **v2.1.2 릴리즈** (16:38 KST)
  - 릴리즈 자동화 머지 커밋 3건
- **proj-play-land, core-backend**: 변동 없음
- ✅ **태스크 진척**:
  - **cm-office Spring Boot API 전환 지속** (@bon) — 게시글 상세 조회 1-Hop 완성 (#284)

### 2026-02-25 (수) 19:02
- **GitHub 체크 (최근 8시간)**: cm-office에서만 활동 감지 (5건 커밋)
- **cm-office** (장현봉): Spring Boot API 마이그레이션 지속 — #189
  - ✅ PR #288 머지: 게시글 작성 Spring Boot API **1-Hop 마이그레이션** (#189) (16:36)
    - route.ts POST 핸들러 제거, usePostCreateUpdateForm → Spring Boot 직접 호출
    - isAdmin 기반 관리자 전용 검증 추가, 테스트 완료
  - 📝 프로젝트 문서 초기 작성 (claudedocs)
- **cm-land, proj-play-land, proj-game-land, core-backend**: 변동 없음
- ✅ **태스크 진척**:
  - **cm-office Spring Boot API 전환 지속** (@bon) — 게시글 작성 1-Hop 완성 (PR #288 머지)

### 2026-02-26 (목) 09:31
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: cm-office 2/25 저녁 (Spring Boot 마이그레이션)
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-26 (목) 14:02
- **GitHub 체크 (최근 8시간)**: cm-office에서 이슈 1건 종료
- **cm-office** (장현봉): 
  - ✅ 이슈 #289 closed (10:52 KST): 게시글 수정 Spring Boot API **1-Hop 마이그레이션** 완료 (#189)
    - usePostCreateUpdateForm → postsV1Api.updatePost() 직접 호출로 전환
    - Next.js route.ts PATCH 핸들러 제거, 테스트 7개 통과
- **cm-land, proj-play-land, proj-game-land, core-backend**: 변동 없음
- ✅ **태스크 진척**:
  - **cm-office Spring Boot API 전환 지속** (@bon) — 게시글 수정 1-Hop 완성 (#289)

### 2026-02-26 (목) 15:15
- **GitHub 체크 (최근 5시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- ⚠️ **Slack #platform-land 스레드 접근 불가** — API channel_not_found 에러로 데일리 체크인 응답 수집 실패
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-26 (목) 19:02
- **GitHub 체크 (최근 8시간)**: cm-office에서 이슈 업데이트 1건 감지
- **cm-office**: 
  - 📌 이슈 #286 업데이트 (08:49 KST): "[Bug] 업체소개 상단고정 이미지 미표시 및 충전하기 미동작" — 오픈 상태
- **cm-land, proj-play-land, proj-game-land, core-backend**: 변동 없음
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-27 (목) 09:01 — 데일리 리포트 발행
- 📊 진행률: 5% (완료 1 / 진행중 2 / 미착수 18)
- ✅ 어제 변동: cm-office 게시글 수정 1-Hop 마이그레이션 완료 (#289)
- 🔥 오늘 포커스: 인프라 분리(Garden), 오피스 쿠폰 프론트(bon), 플레이아이돌(Roki)
- ⚠️ 블로커: 인프라 분리 지연, 쿠폰 백엔드 완료했으나 프론트 미착수, #platform-land 채널 접근 불가 이슈
- 📤 보고 완료: #platform-land + Reus DM

### 2026-02-27 (목) 14:02
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: cm-office 2/26 19:49 KST (이슈 #286 업데이트)
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-27 (목) 19:04
- **GitHub 체크 (최근 8시간)**: core-backend에서 커밋 1건 감지
- **core-backend** (장현봉): 
  - ✨ #637: 코인 API metadata 필드 추가 + Swagger Coin Domain 그룹 추가 (fc093bc, 17:31 KST)
    - Co-Authored-By: Claude Opus 4.6
- **cm-land, cm-office, proj-play-land, proj-game-land**: 변동 없음
- ✅ **태스크 진척**: 코인 API 기능 확장 (포인트 관련 작업 계속)

### 2026-02-28 (금) 09:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: core-backend 2/27 17:31 KST (코인 API 메타데이터 추가)
- ⚠️ **핵심 태스크 진척 미확인**: 인프라 분리(Garden), 오피스 쿠폰(bon) — 담당자 직접 확인 필요

### 2026-02-28 (금) 09:02 — 데일리 리포트 발행
- 📊 진행률: 11% (완료 1 / 진행중 4 / 미착수 4)
- ✅ 어제 변동: core-backend 코인 API metadata 필드 + Swagger Coin Domain 추가 (bon)
- 🔥 오늘 포커스: 인프라 분리(Garden), 오피스 쿠폰 프론트(bon), 플레이아이돌(Roki), Spring Boot 전환(bon)
- ⚠️ 블로커: 인프라 분리 2주째 지연, 쿠폰 백엔드 완료(2/19)했으나 프론트 13개 서브태스크 미착수, 포인트 통합 생태계 설계 필요
- 📤 보고 완료: #platform-land (C0AEFRMN0E9) + Reus DM (D0AEBL7AK4H)

### 2026-02-28 (금) 13:50 — Garden 인프라 분리 상태 확인
- ✅ **논리적 분리 완료** (2/16)
- ✅ **독립 운영 완료** (2/16)
- ⏳ **OCI CSP 이관 예정** (별도 진행)
- 📝 **업데이트**: 리포트에서 "인프라 분리 지연" 블로커 제거 필요 — 실제로는 2/16에 완료됨

### 2026-02-28 (금) 14:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: core-backend 2/27 17:31 KST (코인 API 메타데이터 추가)
- ⚠️ **핵심 태스크 진척 미확인**: 오피스 쿠폰 프론트(bon), 플레이아이돌(Roki) — 담당자 직접 확인 필요

### 2026-02-28 (금) 19:08
- **GitHub 체크 (최근 8시간)**: proj-play-land + core-backend 활동 감지
- **proj-play-land** (reus): 
  - 🔄 CI 설정 revert: "Disable source tagging job and update build ref" 커밋 되돌림 (d05d8ee, 19:07 KST)
- **core-backend**: 
  - 🚀 **v1.0.14 릴리즈** — 자동화 커밋 3건 (18:21~18:24 KST)
    - release/1.0.14 → main 머지 (828456c)
    - main → dev 백머지 (1fcf155)
    - 릴리즈 브랜치 준비 (a768a8b)
- **cm-land, cm-office, proj-game-land**: 변동 없음
- ✅ **태스크 진척**: core-backend 신규 버전 배포 완료 (v1.0.14)

### 2026-03-01 (토) 09:00
- **GitHub 체크 (최근 8시간)**: proj-play-land 11건, core-backend 1건 활동 감지
- **proj-play-land** (ladley/Jeon Junyeong): 아이돌 콘텐츠 UX 개선 집중 작업 — 커밋 11건 + PR 머지 5건
  - ✨ #127: 아이돌 콘텐츠 미디어 업로드 UX 개선 (#128 #129 머지)
    - 썸네일 그리드 미리보기 + @dnd-kit 드래그앤드롭 순서 변경
    - 유료 콘텐츠 첫 번째 미디어 "공개" 뱃지 + 파란 border 강조
    - 모바일 터치 드래그 지원 (touch-action: none)
  - 🐛 #127: 코인 드롭다운 수정 + 미디어 카드 레이어 개선 (#129 머지)
    - 코인 API를 Spring Boot 백엔드로 전환 (Supabase RLS 우회)
    - coin_symbol 필드명 정리, CustomSelect 빈 옵션 안내
  - 🐛 #125: 아이돌 콘텐츠 URL 정규화 + 라이트박스 수정 (#126 머지)
    - Supabase 절대경로 → 상대경로 정규화
    - 가이드 라이트박스 Portal 렌더링
  - 🔄 #106: 로컬 미반영 변경사항 dev 동기화 (#130 머지)
  - 🧪 테스트 커밋 1건 (bb0ff26)
- **core-backend** (Jeon Junyeong): 
  - ✨ #214: 아이돌 채팅 시 인기도(popularity_score) 상승 기능 추가 (#215 머지, 17:51 KST)
    - idol_profiles에 chat_score 컬럼 추가 (V52 마이그레이션)
    - 무료 채팅: chat_score +1, 유료 채팅: chat_score += chatPointCost
    - 인기도 공식에 chat_score × chat_weight 항목 포함
- **cm-land, cm-office, proj-game-land**: 변동 없음
- ✅ **태스크 진척**: 플레이아이돌 기능 개선 지속 — 미디어 업로드 UX, 코인 시스템, 채팅 인기도 연동 완료

### 2026-03-01 (토) 14:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: core-backend 2/3/01 06:51 KST (아이돌 채팅 인기도 기능)
- ⚠️ 주말로 활동 없음

### 2026-03-01 (토) 19:00
- **GitHub 체크 (최근 8시간)**: 🚀 **포인트 교환소 UI 이슈 4건 종료** + 아이돌 백엔드 개선
- **🎯 포인트 통합 생태계 대진척!**
  - ✅ **cm-land #775** "계정 연동 & 포인트 교환소 UI 구현" closed (17:38 KST)
  - ✅ **cm-office #296** "계정 연동 & 포인트 교환소 UI 구현" closed (17:38 KST)
  - ✅ **proj-play-land #131** "계정 연동 & 포인트 교환소 UI 구현" closed (17:38 KST)
  - ✅ **proj-game-land #775** "계정 연동 & 포인트 교환소 UI 구현" closed (17:38 KST)
  - 👉 랜드 간 포인트 교환 UI 완성 — 넥슨ID식 통합 계정 컨셉 구현
- **proj-play-land** (reus): 
  - 🐛 아이돌 콘텐츠 리다이렉트 로직 디버깅 로그 추가 (37ee542, 17:41 KST)
  - 📌 /post/[id] 페이지에서 아이돌 콘텐츠 리다이렉트 동작 추적 강화
- **proj-play-land** (won): CI/CD workflow 개선
  - ✨ dockerfile_name 파라미터 추가 (70f07b7, 17:30 KST)
  - 🔧 dev-ci-cd.yml 업데이트 (68af679, 17:29 KST)
- **proj-play-land** (garden): 
  - 🧹 Unused import 제거 (5b1c403, 16:32 KST)
- **core-backend** (Jeon Junyeong): 아이돌 채팅 UX 개선 — 대규모 기능 추가
  - ✅ **#219 closed**: 아이돌 후원 수신 내역 조회 API 추가 (#220 PR 머지, 18:41 KST)
    - DonationReceivedResponse DTO 생성, GET /rest/v1/idol/donations/received 엔드포인트 추가
    - 후원 받은 내역 조회 + 총 후원 금액 집계 기능
  - ✅ **#216 closed**: 아이돌 채팅 UX 개선 (#217, #218 PR 머지, 17:57~18:38 KST)
    - 아이돌 발신 포인트 면제 로직 추가 (isIdol() 체크)
    - DM 메시지 metadata에 pointCost, cashEarned 저장
    - GET /rest/v1/dm/rooms/{roomId}/point-summary API 추가 (대화방 포인트 요약)
    - IdolChatService: chargeIfIdolChat() 반환 타입 Boolean → IdolChargeResult로 개선
  - ✅ **#221 closed**: IdolChatRoomResponse에 userId 추가 (#222 PR 머지, 18:51 KST)
    - DM 일반 탭 아이돌 필터링 개선 (userId 노출)
- **core-backend** (won): CI/CD 공통 설정 전환
  - 🔧 CI workflow를 공통 config 사용하도록 업데이트 (001218d, 17:34 KST)
- **cm-land, cm-office, proj-game-land**: 변동 없음
- ✅ **태스크 진척**:
  - 🎯 **포인트 통합 생태계 — 랜드 간 포인트 교환 UI 완성** (cm-land, cm-office, play-land, game-land 전부)
  - **플레이아이돌 채팅 시스템 고도화** — 후원 내역 조회, 포인트 면제, 요약 API, 필터링 개선

### 2026-03-02 (일) 09:04
- **GitHub 체크 (최근 8시간)**: core-backend에서 Java 빌드 호환성 이슈 2건 감지
- **core-backend**: 
  - 📌 **#227 오픈**: fix: Java 21 LTS 설정으로 빌드 호환성 확보 (2026-03-01 23:48 KST)
  - 📌 **#226 오픈**: [코드품질] Java 25 호환성 이슈로 빌드 실패 (2026-03-01 21:49 KST)
  - 👉 Spring Boot 프로젝트 Java 버전 호환성 이슈 — 빌드 실패 위험 존재
- **cm-land, cm-office, proj-play-land, proj-game-land**: 변동 없음
- ⚠️ **빌드 블로커 주의**: Java 호환성 이슈로 인한 배포 영향 가능성 — 담당자(bon/kyago) 확인 필요

### 2026-03-02 (일) 14:00
- **GitHub 체크 (최근 8시간)**: core-backend 이슈 #226 업데이트만 감지 (06:49 KST)
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 커밋/PR/릴리즈 활동 없음
- ⚠️ **Java 빌드 이슈** 지속 — #226 오픈 상태, 빌드 실패 위험 여전
- 📌 주말로 개발 활동 미미

### 2026-03-02 (일) 19:01
- **GitHub 체크 (최근 8시간)**: proj-play-land + core-backend 활동 감지
- **proj-play-land** (Jeon Junyeong): 
  - 🐛 #141 closed: 비로그인 시 브라우저 네이티브 인증 팝업 제거 및 토스트 안내 처리 (#142 PR 머지, 40f8c54, 17:58 KST)
  - 🐛 #140 오픈: play-land-dev API Basic Auth 인증 창 문제 해소 (오픈 상태)
  - 🐛 #79 closed: [Bug] 환전 신청/내역 API 500 에러 (F-2, F-3) (18:51 KST)
  - 🐛 #80 closed: [Bug] 어드민 인기도 재계산 API 500 에러 (G-3) (18:50 KST)
- **core-backend** (Jeon Junyeong): 
  - ✅ #227: fix: Java 21 LTS 설정으로 빌드 호환성 확보 (27e5339, 14:29 KST) — Java 25 이슈 해결
  - ✅ #226 closed: [코드품질] Java 25 호환성 이슈로 빌드 실패 (14:29 KST)
- **cm-land, cm-office, proj-game-land**: 변동 없음
- ✅ **태스크 진척**: 
  - **Java 빌드 호환성 이슈 해결** — core-backend Java 21 LTS 설정으로 전환 완료 (#226 #227)
  - **플레이랜드 버그 수정 4건** — 환전 API, 인기도 API, 인증 팝업 이슈 해결

### 2026-03-03 (월) 09:01
- **GitHub 체크 (최근 8시간)**: cm-land + proj-game-land 활동 감지
- **cm-land** (Bab): 
  - ✨ 미니게임 UX 개선 및 사다리 게임 애니메이션 리팩토링 (908ec0a, 02:24 KST)
    - 사다리 게임: 다리 위치 노출 방지, 부드러운 requestAnimationFrame 애니메이션, 보드 분할 리팩토링
    - 전체 게임: 게임 목록 돌아가기 버튼 스타일 통일
    - 룰렛: useRouletteGame stopSpinning 타입 수정
    - 사다리 히스토리: linesBet, bridgeCount 필드 추가
    - 포인트 배팅 게임 목록에서 제거
- **proj-game-land** (Bab): cm-land와 동일 커밋 반영 (908ec0a, 02:24 KST)
- **cm-office**: 
  - 📌 #298 신규 오픈 (2026-03-02 22:24 KST): [Epic] 기업회원 오피스캐시 결제 및 홍보 시스템
  - 🚀 **v1.0.35 릴리즈** (2026-03-02 20:21 KST)
- **core-backend**: 
  - 📌 #228 신규 오픈 (2026-03-02 22:38 KST): [포인트 환전] ms-point-exchanger용 Internal API Key 발급
    - 👉 **포인트 통합 생태계 블로커** — API Key 없이 ms-point-exchanger 통신 불가
- **proj-play-land**: 변동 없음
- ✅ **태스크 진척**: 
  - **게임랜드 미니게임 UX 개선** (Bab) — Feature 개발 진행중
  - **오피스랜드 신규 Epic 시작** (#298) — 오피스캐시 결제/홍보 시스템
- ⚠️ **블로커**: core-backend #228 — 포인트 교환소 백엔드 인증 미구현

### 2026-03-03 (월) 14:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: cm-land/proj-game-land 미니게임 UX 개선 (2026-03-03 02:24 KST — 11시간 전)
- ⚠️ **블로커**: core-backend #228 (포인트 교환소 API Key 미발급) 지속

### 2026-03-04 (수) 14:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: cm-land/proj-game-land 미니게임 UX 개선 (2026-03-03 02:24 KST — 1일 전)
- ⚠️ **블로커**: core-backend #228 (포인트 교환소 API Key 미발급) 지속

### 2026-03-04 (수) 14:01 — 데일리 체크인 수집
- **bon** (U09LF7ZS5GR): ❌ 미응답
- **Garden** (URU4UBX9R): ❌ 미응답
- **Roki** (URSQYUNQJ): ❌ 미응답
- **kyago** (U08P11ZQY04): ❌ 미응답
- **Reus** (U02G8542V9U): ❌ 미응답
- ⚠️ 전원 미응답 → 스레드에 리마인드 발송, 16:00 최종 확인 크론 등록

### 2026-03-04 (수) 16:00 — 데일리 체크인 최종 수집
- **bon** (U09LF7ZS5GR): ❌ 최종 미응답 (단, 채널에서 활동중 — play-land-dev Basic Auth 백엔드 수정 완료 + 프로덕션 태깅, kyago에 배포 요청)
- **Garden** (URU4UBX9R): ❌ 최종 미응답 (단, 3/3에 point-exchanger/authenticator 개발환경 배포 완료)
- **Roki** (URSQYUNQJ): ✅ 리마인드 후 응답 (~16:00 KST) — 스레드 reply 내용 API 제한으로 상세 확인 불가
- **kyago** (U08P11ZQY04): ❌ 최종 미응답
- **Reus** (U02G8542V9U): ❌ 최종 미응답 (단, 3/2~3/3에 ms-point-exchanger 환경변수 작업)
- 📝 **채널 활동 기반 태스크 파악**:
  - bon: play-land-dev `/rest/v1/dm/rooms` Basic Auth 인증창 이슈 해결 (백엔드 SecurityConfig 수정 + 프론트 Authorization 헤더 확인 예정)
  - Garden: point-exchanger.semi-colon.space + authenticator.semi-colon.space 개발환경 배포 완료
  - Reus: ms-point-exchanger Go 마이크로서비스 환경변수 정리 + openapi docs 작성중

### 2026-03-04 (수) 19:04
- **GitHub 체크 (최근 8시간)**: cm-office + core-backend 활동 감지
- **cm-office** (Jeon Junyeong): 
  - ✅ PR #305 머지: 오피스 배너 노출 개수 DB 설정 연동 (프론트엔드) (#302) (17:57 KST)
  - 📌 이슈 #303, #300, #304, #302, #298, #301 업데이트 (오전~오후) — Epic #298 관련 이슈 활발
- **core-backend** (Jeon Junyeong): 
  - ✅ PR #230 머지: 오피스 배너 노출 개수/순서 관리 기능 추가 (백엔드) (#302) (17:53 KST)
- **cm-land, proj-play-land, proj-game-land**: 변동 없음
- ✅ **태스크 진척**:
  - **Epic #298 - Phase 3 완성** (@Reus) — PROMOTED OFFICES 노출 개수/순서 관리 개선 (#302) 백엔드+프론트 완료

### 2026-03-05 (목) 09:02 — 데일리 리포트 발행
- 📊 진행률: 37% (완료 7 / 진행중 5 / 미착수 7)
- ✅ 어제 변동: Epic #298 Phase 3 완료 (PROMOTED OFFICES 노출 개수/순서 관리 개선, PR #305 #230 머지)
- 🔄 진행중: bon play-land-dev Basic Auth 백엔드 완료 + kyago 배포 대기, Reus ms-point-exchanger openapi docs 작성중
- 🔥 오늘 포커스: core-backend #228 API Key 발급 (블로커 해소 최우선), Epic #298 Phase 1/2 착수, play-land-dev Basic Auth 배포, openapi docs 완료
- ⚠️ 블로커: core-backend #228 — ms-point-exchanger용 Internal API Key 미발급 (포인트 교환소 백엔드 통신 불가)
- 📤 보고 완료: #platform-land (C0AEFRMN0E9) + Reus DM (D0AEBL7AK4H)

### 2026-03-05 (목) 14:00 — GitHub 모니터링
- **GitHub 체크 (최근 8시간)**: 🚀 **대규모 활동** — 4개 레포에서 활발한 커밋/PR
- **cm-land & proj-game-land** (Jeon Junyeong): 
  - ✅ **PR #778 머지**: 계정 연동 및 포인트 교환소 구현 (#777) (02:00 KST)
  - 551줄 컴포넌트 → 3개 파일 분리 (AccountLinkTab, PointExchangeTab, ExchangeHistoryTab)
  - Mock API 제거, 환경변수 사용, ReviewClaw 피드백 전면 반영
- **proj-play-land** (Jeon Junyeong/reus): 
  - ✅ **PR #157 머지**: 소셜 플랫폼 이미지 URL 지원 (#156) (23:02 KST)
  - ✅ **PR #155 머지**: 아이돌 상태 변경 UI 추가 (#154) (22:58 KST)
  - 커밋 6건 (타입 안전성 강화, Next.js Image 외부 도메인 설정, 에러 핸들링)
- **core-backend** (장현봉/Jeon Junyeong): 
  - ✅ **PR #236 머지**: V56→V57 마이그레이션 버전 충돌 수정 (02:35 KST)
  - ✅ **PR #235 머지**: OFFICE_CASH 포인트 타입 추가 (#303) (02:34 KST)
    - PointCode 상수 추가, pointCode 유효성 검증, V56 마이그레이션
  - ✅ **PR #234 머지**: 홍보 만료 알림 및 자동 연장 스케줄러 (#304) (02:00 KST)
    - alert_sent 필드, 만료 3일 전 알림, 자동 연장 스케줄러
  - ✅ **PR #231, #233 머지**: 오피스캐시 & 홍보 등록 API (#303), 아이돌 상태 관리 (#232) (23:02 KST)
- **cm-office**: 
  - 📌 신규 이슈 5건 (#306, #304, #303, #302, #300) — Epic #298 관련
- ✅ **태스크 진척**:
  - 🎯 **포인트 교환소 UI 4개 랜드 전부 완성** — cm-land, game-land, play-land, office 전부 (#777/#778 머지)
  - 🎯 **Epic #298 Phase 1/2 백엔드 구현 완료** — OFFICE_CASH 타입, 홍보 등록 API, 만료 알림/자동 연장 스케줄러
  - 🎯 **플레이아이돌 안정화 지속** — 상태 관리, 소셜 이미지 지원

### 2026-03-05 (목) 14:02 — 데일리 체크인 수집
- **bon** (U09LF7ZS5GR): ❌ 미응답
- **Garden** (URU4UBX9R): ❌ 미응답
- **Roki** (URSQYUNQJ): ❌ 미응답
- **kyago** (U08P11ZQY04): ❌ 미응답
- **Reus** (U02G8542V9U): ❌ 미응답
- ⚠️ 전원 미응답 → 16:00 리마인드 예정
- 📝 **GitHub 기반 활동 파악** (오늘 새벽~오전):
  - bon: Epic #298 Phase 1 (#303) OFFICE_CASH 포인트 타입 추가 (PR #235 머지), Phase 2 (#304) 홍보 만료 알림/자동 연장 스케줄러 (PR #234 머지)
  - Reus: cm-land/game-land 포인트 교환소 UI 구현 (PR #778 머지), play-land 아이돌 상태 변경 UI/소셜 이미지 (PR #155 #157 머지)
  - bon: core-backend 마이그레이션 충돌 수정 (PR #236 머지), 오피스캐시 API (PR #231 머지)
  - Garden/Roki/kyago: GitHub 활동 미감지

### 2026-03-05 (목) 19:04
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: core-backend 2026-03-05 09:47 KST (Flyway locations 수정, #243 #244)
- ✅ **오늘 오전 대규모 진척 완료 후 조용**:
  - 포인트 교환소 UI 4개 랜드 전부 완성
  - Epic #298 Phase 1/2 백엔드 구현 완료
  - core-backend 포인트 교환소 API 버그 8건 수정
- 📝 **채널 메시지 스킵** — 변동 없음, 태스크리스트 체크만 수행

### 2026-03-06 (금) 09:01
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: core-backend 2026-03-05 09:47 KST (14시간 전)
- 📝 **채널 메시지 스킵** — 변동 없음, 태스크리스트 체크만 수행

### 2026-03-06 (금) 09:02 — 데일리 리포트 발행
- 📊 진행률: 47% (완료 10 / 진행중 9 / 미착수 2)
- ✅ 어제 변동: 포인트 교환소 UI 4개 랜드 전부 완성, Epic #298 Phase 1/2 백엔드 완료, core-backend API 안정화 8건, 플레이아이돌 기능점검 완료
- 🔥 오늘 포커스: core-backend #228 API Key 발급 (블로커), Epic #298 프론트엔드, openapi docs 완료, Basic Auth 배포, 통합 테스트
- ⚠️ 블로커: core-backend #228 — ms-point-exchanger용 Internal API Key 미발급
- 📤 보고 완료: #platform-land (C0AEFRMN0E9) + Reus DM (D0AEBL7AK4H)

### 2026-03-06 (금) 14:04 — 데일리 체크인 수집
- **bon** (U09LF7ZS5GR): ❌ 미응답
- **Garden** (URU4UBX9R): ❌ 미응답
- **Roki** (URSQYUNQJ): ❌ 미응답
- **kyago** (U08P11ZQY04): ❌ 미응답
- **Reus** (U02G8542V9U): ❌ 미응답
- ⚠️ 전원 미응답 → 스레드에 리마인드 발송 완료
- 📝 **GitHub 기반 활동 파악** (오늘):
  - bon: core-backend office_promotions 스키마 개편 (offices→posts 전환), policyId 버그 수정, V58 마이그레이션 수정, 예외 핸들러 추가 — 커밋 9건

### 2026-03-06 (금) 14:02 — GitHub 모니터링
- **GitHub 체크 (최근 8시간)**: core-backend에서만 활동 감지 — 오피스랜드 DB 리팩토링
- **core-backend** (장현봉): office_promotions 스키마 개편 — 커밋 9건
  - ✅ PR #250 머지: office_promotions에서 post 데이터 포함, office_id → post_id 전체 리네임 (04:42 KST)
  - ✅ PR #249 머지: office_promotions에서 offices 테이블 의존 제거, posts 테이블로 교체 (03:59 KST)
  - 🐛 policyId 고정값 버그 수정 — pointCode로 정책 자동 조회 (04:38)
  - 🐛 V58 마이그레이션 site_info 테이블 미존재 오류 수정 (#248, 01:36)
  - 🐛 오피스 도메인 예외 핸들러 추가 — 500 오류 수정 (#247, 00:59)
- **cm-land, cm-office, proj-play-land, proj-game-land**: 변동 없음
- ✅ **태스크 진척**: 
  - **오피스랜드 DB 스키마 안정화** (@bon) — offices → posts 테이블 전환, 정책 조회 로직 개선
  - Epic #298 관련 백엔드 버그 수정 지속

### 2026-03-06 (금) 19:05
- **GitHub 체크 (최근 8시간)**: cm-office + core-backend 활발한 활동 — Epic #298 Phase 1/2 백엔드 추가 작업
- **cm-office** (장현봉): 
  - ✅ PR #310 머지: 게시글 작성 시 status 값 대문자로 변경 (#309) (09:07 KST)
  - ✅ PR #308 머지: 오피스 프로모션 관리 기능 개선 (#303) (07:42 KST)
  - ✨ #303 오피스캐시 충전 및 프로모션 관리 시스템 구현 — 커밋 3건 (05:33~07:42)
  - ✅ 이슈 #309, #303 closed
- **core-backend** (장현봉): office_promotions 스키마 고도화 + 홍보 자동 연장/알림 — 커밋 11건
  - 🐛 #637: 게시글 status 대소문자 구분 없이 처리하도록 수정 (#253 PR 머지, 08:56 KST)
  - ✅ PR #252 머지: 오피스 홍보 만료 3일 전 알림 발송 구현 (#304) (07:37 KST)
  - ✨ 오피스 홍보 자동 연장 스케줄러 구현 (#304) (06:08)
  - ✅ PR #251 머지: 오피스 홍보 기본 비용 5만원 → 10만원으로 변경 + 수동 연장 API 추가 (05:59 KST)
  - ✨ POST /rest/v1/office-promotions/{id}/renew API 추가 (05:55)
  - ✅ PR #250 머지: GET 홍보 조회 시 post 데이터 포함, office_id → post_id 전체 리네임 (04:42 KST)
  - ♻️ office_promotions에서 offices 테이블 의존 제거, posts 테이블로 교체 (#249, 03:49~03:59)
- **cm-land, proj-play-land, proj-game-land**: 변동 없음
- ✅ **태스크 진척**:
  - **Epic #298 Phase 1/2 백엔드 추가 고도화** (@bon) — 프로모션 관리 기능, 자동 연장, 알림 발송, 수동 연장 API, 기본 비용 조정
  - **게시글 status 대소문자 버그 수정** (cm-office #309, core-backend #637)

### 2026-03-07 (금) 09:00
- **GitHub 체크 (최근 8시간)**: 5개 레포 모두 커밋/PR/이슈/릴리즈 활동 없음
- **cm-land, cm-office, proj-play-land, proj-game-land, core-backend**: 변동 없음
- 마지막 활동: cm-office/core-backend 2026-03-06 09:07 KST (Epic #298 백엔드 작업)
- 📝 **채널 메시지 스킵** — 변동 없음, 태스크리스트 체크만 수행
