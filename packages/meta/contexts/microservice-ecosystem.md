# 세미콜론 마이크로서비스 생태계 컨텍스트

> sax-ms 패키지 생성을 위한 조사 자료 (2024-12-05)

## 1. 레포지토리 현황

### 1.1 핵심 인프라 (core-*)

| 레포지토리 | 역할 | 기술 스택 |
|------------|------|-----------|
| **core-supabase** | 중앙 PostgreSQL DB + Auth + Storage + Realtime | Supabase, PostgreSQL 17.4, MinIO |
| **core-compose** | Docker 오케스트레이션 + Nginx 리버스 프록시 | Docker Compose, Nginx |
| **core-webhook** | GitHub Projects 상태 변경 → 자동화 트리거 | Vercel Serverless |
| **core-backend** | Next.js 백엔드 (용정 커뮤니티) | Next.js, TypeScript |
| **core-interface** | 공통 타입/인터페이스 정의 | TypeScript |

### 1.2 마이크로서비스 (ms-*)

| 서비스 | 서비스 코드 | 포트 | 테이블 Prefix | 역할 |
|--------|-------------|------|---------------|------|
| **ms-notifier** | NF | 3000 | nf_ | 중앙 알림 허브 (Slack, Telegram, KakaoTalk) |
| **ms-scheduler** | SC | 3003 | sc_ | 크론 기반 작업 스케줄링 |
| **ms-ledger** | LG | 3000 | lg_ | 수입/지출/구독 관리 |
| **ms-media-processor** | MP | 3001 | - | 이미지/비디오 워터마크 처리 |
| **ms-crawler** | CR | 3333 | - | 웹 스크래핑 |

---

## 2. 아키텍처 패턴

### 2.1 네트워크 구조 (core-compose)

```text
인터넷 → Nginx (80/443)
    ├── cm-land (Next.js) - Port 3000
    ├── ms-polisher (미디어) - Port 3001
    ├── ms-gamer (게임) - Port 8080
    ├── node-scrapper - Port 3333
    ├── coin-data-collector - Port 3002
    └── Supabase - host.docker.internal:8000
```

### 2.2 데이터베이스 연결 패턴

```text
ms-* 서비스 → PostgreSQL 스키마 분리
    ├── scheduler → scheduler 스키마 (sc_* 테이블)
    ├── ledger → ledger 스키마 (lg_* 테이블)
    ├── notifier → notifier 스키마 (nf_* 테이블)
    └── core-supabase → public 스키마 (users, posts, etc.)
```

### 2.3 이벤트 기반 통신 (표준 이벤트 봉투)

```typescript
interface EventEnvelope {
  metadata: {
    eventId: string;
    service: string;       // 발신 서비스명
    type: string;          // 이벤트 유형
    severity: 'info' | 'warning' | 'error' | 'critical';
    occurredAt: string;    // ISO 8601
  };
  context: {
    env: 'development' | 'staging' | 'production';
    tenantId?: string;
    traceId?: string;
    resource?: { type: string; id: string };
  };
  data: any;               // 서비스별 페이로드
  notification: {
    channels: string[];    // ['slack', 'telegram', 'kakao']
    targets: string[];     // 수신 대상
    template?: string;
    policy?: {
      throttle?: { maxPerHour: number; maxPerDay: number };
      retry?: { maxAttempts: number; backoffMs: number };
    };
  };
}
```

---

## 3. 기술 스택

| 영역 | 기술 |
|------|------|
| **언어** | TypeScript, Node.js |
| **프레임워크** | Next.js (App Router) |
| **ORM** | Prisma |
| **DB** | PostgreSQL (Supabase 호스팅) |
| **큐/워커** | PostgreSQL 기반 작업 큐 |
| **컨테이너** | Docker, Docker Compose |
| **배포** | Vercel (Serverless), Self-hosted |
| **미디어 처리** | Sharp (이미지), FFmpeg (비디오/GIF) |

---

## 4. 서비스별 상세

### 4.1 ms-notifier (알림 서비스)

**아키텍처**:
```text
외부 서비스 → POST /api/events → 알림 서비스 → PostgreSQL → 백그라운드 워커 → 채널 어댑터 → 외부 API
```

**핵심 기능**:
- 이벤트 봉투 기반 표준화된 수신
- 다중 채널 지원 (Slack, Telegram, KakaoTalk)
- 백그라운드 워커 + 재시도 (지수 백오프)
- 대시보드 (실시간 모니터링)

**디렉토리 구조**:
```text
src/
├── app/              # Next.js App Router
│   ├── api/         # API 라우트
│   └── dashboard/   # 대시보드 UI
├── services/        # 비즈니스 로직
├── workers/         # 백그라운드 작업 처리
├── adapters/        # 채널 어댑터
├── repositories/    # 데이터 액세스 레이어
└── types/           # TypeScript 타입
```

### 4.2 ms-scheduler (스케줄러 서비스)

**핵심 테이블**:
- `sc_schedules`: 크론 스케줄 정의
- `sc_executions`: 실행 로그
- `sc_job_queue`: 작업 큐
- `sc_configs`: 서비스 설정

**연동 서비스**:
- Scraper Service: 데이터 스크래핑 트리거
- Collector Service: 데이터 수집 트리거
- Ledger Service: 정산 작업 트리거
- Notifier Service: 알림 발송 트리거

### 4.3 ms-ledger (장부 서비스)

**핵심 테이블**:
- `lg_accounts`: 계좌 정보
- `lg_categories`: 수입/지출 카테고리
- `lg_transactions`: 거래 내역
- `lg_subscriptions`: 구독/정기결제
- `lg_audit_logs`: 감사 로그
- `lg_jobs_outbox`: 이벤트 발행 (Outbox 패턴)

### 4.4 ms-media-processor (미디어 처리)

**핵심 기능**:
- 워터마크 처리: Sharp (이미지) + FFmpeg (비디오/GIF)
- Resumable Upload: 6MB 이상 파일 TUS 프로토콜
- Supabase Storage 연동

---

## 5. 공통 패턴

### 5.1 테이블 네이밍 규칙

```text
{서비스코드}_{도메인}

예시:
- sc_schedules (스케줄러)
- lg_accounts (장부)
- nf_notifications (알림)
```

### 5.2 스키마 분리

각 마이크로서비스는 독립 PostgreSQL 스키마 사용:

```sql
CREATE SCHEMA scheduler;
CREATE SCHEMA ledger;
CREATE SCHEMA notifier;
```

### 5.3 API 엔드포인트 패턴

```text
/api/v1/{domain}           # CRUD 기본
/api/v1/{domain}/:id       # 단일 리소스
/api/health                # 헬스체크
/api/statistics            # 통계
```

### 5.4 백그라운드 워커 패턴

- PostgreSQL 기반 작업 큐 (pg-boss 스타일)
- 폴링 방식 (JOB_POLL_INTERVAL)
- 배치 처리 (JOB_BATCH_SIZE)
- 재시도 로직 (지수 백오프)

---

## 6. sax-ms 패키지 후보 컴포넌트

### 6.1 Agent 후보

| Agent | 역할 |
|-------|------|
| `service-architect` | 새 마이크로서비스 설계 |
| `event-designer` | 이벤트 봉투 설계 및 검증 |
| `worker-architect` | 백그라운드 워커 설계 |

### 6.2 Skill 후보

| Skill | 역할 |
|-------|------|
| `scaffold-service` | 서비스 보일러플레이트 생성 |
| `create-event-schema` | 이벤트 스키마 생성 |
| `setup-prisma` | Prisma 스키마 + 마이그레이션 |
| `create-worker` | 백그라운드 워커 템플릿 |
| `create-adapter` | 채널 어댑터 템플릿 |

### 6.3 Reference Chain

```text
sax-ms/
├── references/
│   ├── core-supabase.md → gh api repos/semicolon-devteam/core-supabase
│   ├── event-envelope.md → 이벤트 봉투 표준
│   └── service-template/ → 서비스 보일러플레이트
```

---

## 7. 참조 문서

| 문서 | 위치 |
|------|------|
| core-supabase README | `gh api repos/semicolon-devteam/core-supabase/contents/README.md` |
| core-compose README | `gh api repos/semicolon-devteam/core-compose/contents/README.md` |
| ms-notifier README | `gh api repos/semicolon-devteam/ms-notifier/contents/README.md` |
| ms-scheduler README | `gh api repos/semicolon-devteam/ms-scheduler/contents/README.md` |
| ms-ledger README | `gh api repos/semicolon-devteam/ms-ledger/contents/README.md` |
| ms-media-processor README | `gh api repos/semicolon-devteam/ms-media-processor/contents/README.md` |
