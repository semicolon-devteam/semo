# Semicolon Microservices Context

> Semicolon 에코시스템의 마이크로서비스 아키텍처 컨텍스트
> 수집일: 2025-12-22

---

## 개요

Semicolon 에코시스템은 14개의 마이크로서비스로 구성되어 있습니다.
각 서비스는 `ms-{service-name}` 패턴으로 명명되며, 독립적으로 배포 및 운영됩니다.

---

## 서비스 목록

| 서비스 | 설명 | 기술 스택 | 포트 | 상태 |
|--------|------|-----------|------|------|
| **ms-media-processor** | 미디어 파일 워터마크 처리 | Node.js, FFmpeg, Sharp | - | Active |
| **ms-crawler** | 웹 스크래핑 | Node.js | - | Minimal |
| **ms-scheduler** | 크론 기반 작업 스케줄링 | Next.js, Prisma | 3003 | Active |
| **ms-notifier** | 다중 채널 알림 허브 | Next.js, PostgreSQL, Pino | 3000 | Active |
| **ms-ledger** | 수입/지출/구독 관리 | Next.js, Prisma, Redis | 3000 | Active |
| **ms-collector** | 범용 외부 데이터 수집 (암호화폐 등) | Node.js, Supabase | 3002 | Active |
| **ms-allocator** | GitHub Projects 할당 추적 | Next.js, GitHub GraphQL | - | Active |
| **ms-gamer** | 사다리 베팅 게임 API | Go 1.21+, PostgreSQL | 8080 | Active |
| **ms-template** | 마이크로서비스 템플릿 | Next.js 14, Prisma | - | Template |
| **ms-observer** | - | - | - | Empty |
| **ms-logger** | - | - | - | Empty |
| **ms-crontab** | - | - | - | Empty |
| **ms-batcher** | - | - | - | Empty |

---

## 서비스 상세

### 1. ms-media-processor

**목적**: 미디어 파일(이미지/비디오)에 워터마크 삽입 및 Supabase 스토리지 저장

**주요 기능**:
- 이미지 워터마크 (JPEG, PNG, WebP) - Sharp
- GIF 애니메이션 워터마크 - FFmpeg
- 비디오 워터마크 (MP4, AVI, MOV, WMV) - FFmpeg
- Supabase 스토리지 자동 업로드
- 자동 Resumable Upload (6MB 이상)
- 백그라운드 비동기 처리

**API 엔드포인트**:
- `POST /api/media/process` - 동기 처리
- `POST /api/media/process-async` - 비동기 처리
- `GET /api/media/status/:jobId` - 상태 확인
- `GET /api/health` - 헬스체크

---

### 2. ms-scheduler (SC)

**목적**: 주기적 실행 작업을 중앙에서 관리하고 실행

**주요 기능**:
- 크론 기반 작업 실행 (초/분/시간/일/주/월)
- 작업 큐 관리 (예약 태스크 등록/수정/삭제)
- 실패 재시도 및 알림
- 다른 서비스 트리거 (Scraper/Collector 등)

**DB 스키마** (Prefix: `sc_`):
- `sc_schedules` - 크론 스케줄 정의
- `sc_executions` - 실행 로그
- `sc_job_queue` - 일회성/지연 작업 큐
- `sc_configs` - 서비스 설정

**API 엔드포인트**:
- `GET/POST /api/schedules` - 스케줄 관리
- `GET/POST /api/jobs` - 작업 큐 관리
- `GET /api/health` - 헬스체크

---

### 3. ms-notifier

**목적**: 마이크로서비스 환경의 중앙 집중식 알림 관리

**주요 기능**:
- 이벤트 기반 아키텍처 (표준화된 이벤트 봉투 형식)
- 다중 채널 지원: Slack, Telegram, KakaoTalk
- PostgreSQL 기반 영구 저장소
- 백그라운드 워커 (비동기 알림 처리)
- 재시도 메커니즘 (지수 백오프)
- 대시보드 UI

**이벤트 봉투 형식**:
```typescript
{
  metadata: { eventId, service, type, severity, occurredAt },
  context: { env, tenantId, traceId, resource },
  data: any,
  notification: { channels, targets, template, policy }
}
```

**지원 서비스**: image-processor, scraper, collector, ledger

**API 엔드포인트**:
- `POST /api/events` - 이벤트 수신
- `GET /api/notifications` - 알림 목록
- `GET /api/health` - 헬스체크
- `GET /api/statistics` - 시스템 통계

---

### 4. ms-ledger (LG)

**목적**: 개인/팀의 수입, 지출, 구독 관리

**DB 스키마** (Prefix: `lg_`):
- `lg_accounts` - 계좌 정보
- `lg_categories` - 수입/지출 카테고리
- `lg_transactions` - 거래 내역
- `lg_subscriptions` - 구독/정기결제
- `lg_audit_logs` - 감사 로그
- `lg_jobs_outbox` - 이벤트 발행

**API 엔드포인트**:
- `GET/POST/PUT/DELETE /api/v1/accounts` - 계좌 관리
- `GET /api/health` - 헬스체크

---

### 5. ms-collector (AG - Aggregator)

**목적**: 범용 외부 데이터 수집/집계 마이크로서비스

**주요 기능**:
- 7개 거래소 지원 (업비트, 빗썸, 코인원, 코빗, 바이낸스, 코인베이스, 바이빗)
- 실시간 암호화폐 가격 수집
- 김치 프리미엄 계산
- 롱숏 비율 수집 (바이낸스 선물)
- 완전 DB 기반 운영 (동적 거래소/코인 관리)
- 대시보드 UI (localhost:3002)

**데이터 수집 스케줄**:
- 실시간 가격: 10초-10분 간격 (설정 가능)
- 과거 가격 & 프리미엄: 매분
- 롱숏 비율: 5분마다
- 데이터 정리: 매일 오전 2시 (30일 보관)

**Legacy DB** (Supabase):
- `exchanges`, `coins`, `exchange_prices`, `real_time_prices`, `kimchi_premiums`, `long_short_ratios`

**Target DB** (Central - `svc_aggregator` 스키마):
- `ag_data_sources`, `ag_collection_jobs`, `ag_crypto_*`

---

### 6. ms-allocator (AL)

**목적**: GitHub Projects v2 할당 추적 및 리포팅

**주요 기능**:
- GitHub Projects GraphQL API 연동
- 프로젝트 아이템 상태/할당/Estimate 추적
- 일간/주간 메트릭 자동 계산
- 개인/팀별 리포트 생성
- Webhook 실시간 처리

**DB 스키마** (Prefix: `al_`):
- `al_tracked_subjects` - 추적 대상 설정
- `al_project_fields` - 프로젝트 필드 매핑
- `al_snapshots` - 프로젝트 아이템 스냅샷
- `al_aggregates_daily/weekly` - 집계 데이터
- `al_events_log` - Webhook 이벤트 로그

**API 엔드포인트**:
- `POST /api/snapshots` - 스냅샷 수집
- `POST /api/aggregations/daily|weekly` - 집계 실행
- `GET /api/reports/daily|weekly` - 리포트 조회

---

### 7. ms-gamer

**목적**: 사다리(2줄) 베팅 게임 REST API

**기술 스택**: Go 1.21+, PostgreSQL

**게임 규칙**:
- 매 회차 난수 n ∈ [1..28] 생성
- 시작점: 홀수 → 좌(L), 짝수 → 우(R)
- 라인 수: [1..14] → 3줄, [15..28] → 4줄
- 결과: 좌=홀(ODD), 우=짝(EVEN)

**베팅 마켓**: ODD, EVEN, LEFT, RIGHT, L3, L4, 조합 베팅

**라운드 상태**: OPEN → CLOSED → RESOLVED → SETTLED (or CANCELLED)

**DB 테이블**:
- `ladder_pattern`, `ladder_round`, `ladder_market_odds`, `ladder_bet`, `outbox_event`

**API 엔드포인트**:
- `GET /health` - 헬스체크
- `GET /api/ladder/rounds/current` - 현재 라운드
- `POST /api/ladder/bets` - 베팅 신청
- `GET /api/me/ladder/bets` - 내 베팅 내역

---

### 8. ms-template

**목적**: Semicolon 마이크로서비스 개발 템플릿

**기술 스택**:
- Framework: Next.js 14
- Language: TypeScript
- Database: PostgreSQL + Prisma ORM
- Styling: Tailwind CSS
- Validation: Zod

**프로젝트 구조**:
```
.
├── app/              # Next.js App Router
│   ├── api/         # API 엔드포인트
├── lib/             # 공통 유틸리티
│   └── db.ts        # Prisma 클라이언트
├── prisma/          # 데이터베이스 스키마
```

---

## 공통 패턴

### 데이터베이스
- **ORM**: Prisma (대부분의 서비스)
- **DB**: PostgreSQL (Central DB 전환 진행 중)
- **스키마 Prefix**: 서비스 코드 기반 (sc_, lg_, al_, ag_)

### API 설계
- RESTful API
- 헬스체크 엔드포인트: `/api/health`
- Zod 기반 입력 유효성 검사

### 이벤트/메시징
- Outbox 패턴 (이벤트 발행)
- 재시도 메커니즘 (지수 백오프)

### 배포
- Docker / Docker Compose
- AWS Lightsail
- PM2 (프로세스 관리)

---

## 서비스 간 연동

```
ms-scheduler ──trigger──> ms-collector
             ──trigger──> ms-crawler
             ──trigger──> ms-ledger
             ──trigger──> ms-notifier

ms-collector ──event──> ms-notifier
ms-ledger    ──event──> ms-notifier
ms-media-processor ──event──> ms-notifier

ms-gamer ──wallet API──> External Wallet Service
```

---

*마지막 업데이트: 2025-12-22*
