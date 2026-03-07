# 랜드 플랫폼

## 레포지토리 구조
- **프론트엔드**: 별도 레포
  - 게임랜드: `proj-game-land`
  - 플레이랜드: `proj-play-land`
  - 오피스랜드: `proj-office-land`
- **백엔드**: 공통 레포 `core-backend` (Modulith 구조)
- **마이크로서비스**:
  - `ms-authenticator` — 계정 연동 (Go)
  - `ms-point-exchanger` — 포인트 교환소 (Go)

## 🚀 백엔드 모듈화 (사이트메이커 MVP 사전작업, 2026-03 kyago)

### 배경
- 기존 사이트메이커 시연 = PoC, 이제 진짜 MVP 개발 시작
- 3주간 인프라 정비 작업 진행
- **통칭: "백엔드 모듈화"** (kyago 명명)

### core-backend 모듈 분리 (3주, ~2026-03-25 예상)
- **저장소**: `semicolon-devteam/spring-backend-modules`
- **현재**: Modular Monolith (모듈 경계는 있지만 한 코드베이스)
- **목표**: 각 모듈 물리적 분리 → 서비스별 모듈 import 방식
- **대상 서비스**: 게임랜드, 플레이아이돌, 오피스랜드
- **기대효과**: 서비스별 독립 배포 가능, 사이트메이커로 새 사이트 생성 시 필요 모듈만 조합

## 개요
- 게임랜드 / 플레이랜드 / 오피스랜드
- 지분 25% ⚠️대외비
- ✅ **인프라 분리 완료** (2026-02-16): 논리적 분리 + 독립 운영 완료
- ⏳ OCI CSP 이관 예정 (별도 진행)

## 게임랜드 - 게임존 (`/game`) (2026-02-15 Roki 작업)

### 아키텍처 패턴
```
Model (타입/상수) → API Route (Next.js Route Handler, 게임 로직 + 포인트 RPC)
→ Service (API 호출 래퍼, baseService 사용) → Hook (React 상태 관리)
→ Components (UI, CSS 애니메이션) → Page (ServerAuthGuard + metadata)
```

### 포인트 시스템
- 베팅: `points_use` RPC로 차감
- 당첨: `points_issue` RPC로 지급
- 잔액: `user_point_wallets` 테이블
- 베팅 범위: 100P ~ 50,000P

### 게임 목록 (5개)
1. **룰렛** (`/game/roulette`) — 신규. 12세그먼트, 배당 0x~10x
2. **가위바위보** (`/game/rps`) — 기존
3. **바카라** (`/game/baccarat`) — 신규. 8벌 덱, 3rd card rule. 플레이어(2x)/뱅커(1.95x)/타이(9x)
4. **사다리** (`/game/ladder`) — 신규. 4줄8행, 좌우(1.95x)+홀짝(1.95x) 이중 베팅
5. **포인트 배팅** (`/game/bet`) — 기존

### SEO 메타데이터
- DB 기반 전환: `site_config_kv` 테이블 `site.metadata` 키
- 하드코딩 제거, 배포 없이 DB에서 직접 수정 가능

### 인프라 (2026-02-17 Garden 업데이트)
- Supabase: `game-supabase-dev.semi-colon.space`
- Spring 백엔드: `game-backend-dev.semi-colon.space`
- Supabase 클라이언트: Lazy Proxy 패턴 적용
- ✅ DB 백업 완료
- ✅ OCI 계정 미발급 → 기존 VM 내 Supabase GameLand 기반 복사로 신규 구축 완료
- ✅ Vector Log 1.3TB 정리 + PgCron 14일 이후 삭제 설정 완료
- ✅ GameLand 구축 Roki 지원 중
- ✅ InfraClaw 툴 세팅 + 기본지식 세팅 진행 중
- ✅ **의사결정 완료 (Reus, 2/17)**: OCI 계정 발급과 별개로 Azure에서 현재 VM 구조 유지하며 분리 진행. 일정 미루기 No.

### 커밋
- `dee5f96` - feat: 게임존 바카라/사다리 게임 추가 및 SEO 최적화 (54 files)
- `91d8338` - refactor: SEO 하드코딩 제거, site_config_kv DB 기반으로 전환 (3 files)

## 오피스랜드 (`cm-office`)

### 기본 아키텍처
- **Supabase 직접**: 인증, 게시글, 댓글, 오피스 관리, 리뷰, 카테고리, 파일, 유저
- **Spring 전환 가능**: `NEXT_PUBLIC_USE_SPRING_BOOT` 플래그 (팩토리 패턴)
- ⚠️ **포인트 기능 미구현** — game-land 참고하여 선행 활성화 필요 (Garden, 2/15)

### 🔥 쿠폰 발행/구매 시스템 (신규, 2026-02-15~)
- **요구사항 정의서**: Garden V2.0
- **결제: 포인트만** (실결제/PG 없음, **1:1 비율** 10,000원 쿠폰 = 10,000P) — Roki/Garden 확인 2/16
- **환불 없음** — Roki 확인 2/16
- **정액 할인만** (정률% 없음) — Roki 확인 2/16
- **3역할**: Admin / 업체(Partner) / 사용자(User)
- **Admin**: 사이트 Config로 정책 관리 (**업체당** 등록 가능 쿠폰 개수 제한 (Roki 확인), 금액 배열 = 정액 할인 프리셋 예: [1000, 5000, 10000] — 정률% 없음), 승인/반려
- **업체**: 마이페이지 쿠폰관리, 금액 Radio 선택+재고 설정 (유효기간 없음 — Garden 확인 2/16), 상태(대기→승인→판매중→소진), 사용처리(UUID/QR Redeem)
- **사용자**: 별도 쿠폰 메뉴(메인 네비), 카드형 UI, 포인트로 구매 (구매 시 "환불 불가" 안내 문구 필수 — Roki 2/16), 마이페이지 쿠폰함(사용가능/완료/만료)
- **기술**: 동시성 처리, UUID 위변조 방지, 알림(승인→업체)
- ⚠️ 유효기간 없으므로 만료 배치 스케줄러 / 만료 알림 불필요

### 🗄️ 쿠폰 테이블 설계 (bon 확인, 2026-02-17)
- **`coupons`** 테이블 — Supabase에 신규 추가
- **`coupon_purchases`** 테이블 — Supabase에 신규 추가
- **쿠폰 설정**: 기존 `site_config_kv` 테이블 활용
  - `coupon.enabled` — 쿠폰 기능 ON/OFF
  - `coupon.max_count_per_company` — 업체당 등록 가능 쿠폰 수
  - `coupon.available_amounts` — 금액 프리셋 배열 (예: [1000, 5000, 10000])
- ⚠️ **크로스 플랫폼 통일**: 게임랜드/플레이랜드에서도 동일한 테이블 구조 + site_config_kv 키 패턴 사용할 것
