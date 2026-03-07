# 랜드 플랫폼 & 플레이랜드 개발 가이드

## 0. 도메인 정보 (2026-02-15 갱신)

### Dev 환경
| 서비스 | 도메인 |
|--------|--------|
| 플레이랜드 (FE) | `https://land-dev.semi-colon.space` |
| 게임랜드 (FE) | `https://gamer-dev.semi-colon.space` |
| 백엔드 API | `https://land-backend-dev.semi-colon.space` |
| Supabase | `https://land-supabase-dev.semi-colon.space` |

### Staging 환경
| 서비스 | 도메인 |
|--------|--------|
| 플레이랜드 (FE) | `https://land-staging.semi-colon.space` |
| 게임랜드 (FE) | `https://gamer-staging.semi-colon.space` |
| 백엔드 API | `https://land-backend-staging.semi-colon.space` |
| Supabase | `https://land-supabase-staging.semi-colon.space` |

> ⚠️ Staging/Production 도메인은 semi-colon-ops 레포에서 확인 필요. 위 staging은 네이밍 컨벤션 기반 추정.

### Production 환경
| 서비스 | 도메인 |
|--------|--------|
| 플레이랜드 (FE) | `https://land.semi-colon.space` (추정) |
| 게임랜드 (FE) | `https://gamer.semi-colon.space` (추정) |
| 백엔드 API | `https://land-backend.semi-colon.space` (추정) |
| Supabase | `https://land-supabase.semi-colon.space` (추정) |

> Production 도메인은 semi-colon-ops GitOps 레포 확인 필요.

### 로컬 개발
| 서비스 | URL |
|--------|-----|
| FE (play-land) | `http://localhost:3001` (3000 점유) |
| FE (game-land) | `http://localhost:3000` |
| Spring 백엔드 | `http://localhost:8080` |
| 로컬 PostgreSQL | `localhost:6432` (Docker) |

### 환경변수 매핑
| 환경변수 | 용도 |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API (인증/DB/스토리지) |
| `NEXT_PUBLIC_SPRING_API_BASE_URL` | Spring Boot 백엔드 API |
| `NEXT_PUBLIC_DOMAIN` | 플레이랜드 도메인 (이미지 프로세싱 등) |
| `NEXT_PUBLIC_GAME_URL` | 게임랜드 도메인 |
| `NEXT_PUBLIC_STORAGE_URL` | Supabase Storage |
| `NEXT_PUBLIC_IMAGE_PROCESS_URL` | 이미지 처리 URL |

### 인프라
- **클라우드**: OCI (Oracle Cloud Infrastructure)
- **오케스트레이션**: OKE (Oracle Kubernetes Engine)
- **컨테이너 레지스트리**: DockerHub (`semicolonmanager/<repo>`)
- **GitOps**: `semi-colon-ops` 레포 (Kustomize)
- **도메인**: `*.semi-colon.space`

---

## 1. 랜드 에코시스템 개요

### 서비스 구성
| 서비스 | 레포 | 설명 |
|--------|------|------|
| **플레이랜드** | `proj-play-land` | 커뮤니티 + 플레이아이돌 + 포인트샵 |
| **게임랜드** | `proj-game-land` | 인앱 게임 (포인트 획득/소모) |
| **오피스랜드** | `cm-office` → `proj-office-land` | 쿠폰 발행/구매 시스템 |

### 공통 백엔드
- **`core-backend`** — 모든 랜드 서비스가 공유하는 단일 Spring Boot 백엔드
- 1개 이미지 → K8s에서 `land-backend` + `office-backend` 2개 서비스로 배포
- GitHub org: `semicolon-devteam`

### 공통 기능 (계획 중)
- **계정연동** — 형제 사이트 간 Supabase Auth 연동 (넥슨ID식)
- **포인트 교환소** — 사이트 간 포인트 교환

---

## 2. 기술 스택

### 프론트엔드 (Next.js)
- **프레임워크**: Next.js 15.x + React 19 + TypeScript
- **스타일**: TailwindCSS
- **상태관리**: React Query (TanStack Query)
- **API 클라이언트**: Swagger Codegen → `__generated__/` + React Query 훅 (`apis/`)
- **인증**: Supabase Auth (JWT)
- **파일 업로드**: Supabase Storage (`public-bucket`), 경로 `{auth_user_id}/{uuid}.{ext}`
- **구조**: DDD 4-Layer + Atomic Design (cm-template 기반)

### 백엔드 (Spring Boot — `core-backend`)
- **프레임워크**: Spring Boot 3.5.6 + Kotlin + JDK 21
- **DB 접근**: R2DBC (Reactive) + Kotlin Coroutines
- **API 패턴**: `ApiResult.Success` / `PagedSuccess` / `CursorPagedSuccess`
- **인증**: Supabase JWT 검증, `@PublicApi` / `@RequireRole` 어노테이션
- **도메인 구조**: `domain/{name}/entity|repository|service|web|exception`
- **마이그레이션**: Flyway (V1 ~ V43+)
- **빌드**: Gradle, Multi-stage Docker (gradle:8.5-jdk21 → eclipse-temurin:21-jre-alpine)

### 데이터베이스 (Supabase PostgreSQL)
- **69개 테이블**, 55+ RPC 함수, 90 트리거
- **FK 미사용** — 앱 레벨에서 관계 관리 (writer_id, user_id 등 논리적 FK)
- **포인트 시스템**: `point_codes`, `point_policies`, `point_transactions`, `user_point_wallets`
  - RPC `points_issue` / `points_use` (FIFO 소비)
  - 트리거 기반 자동 지급 (게시글/댓글/리액션)

---

## 3. 아키텍처 & 연동 방식

```
[Next.js FE (proj-play-land 등)]
  ├─ SSR/CSR → Supabase 직접 호출 (RPC + 테이블 쿼리)
  │   └─ 게시글, 유저, 게임, 배너, 공지, 코인, 홈 등
  ├─ CSR → Spring 백엔드 (/rest/v1/*) via Axios + React Query
  │   └─ 댓글, 커서 페이징, 채팅, 랭킹, 알림 등
  └─ 레거시: Next API Routes → Supabase (일부 잔존)

[Spring 백엔드 (core-backend)]
  ├─ Supabase PostgreSQL (R2DBC 직접 연결)
  ├─ Flyway 마이그레이션 관리
  └─ 도메인: auth, banner, challenge, chat, menu, notification, point, posts, ranking, siteconfig, user, idol(신규)

[Supabase]
  ├─ PostgreSQL (메인 DB)
  ├─ Auth (JWT 발급/검증)
  ├─ Storage (파일 업로드)
  └─ Realtime (채팅 구독)
```

### FE → BE 연동 패턴 (Pattern 3)
1. **Swagger/OpenAPI 문서** (`/api-docs`) 기반 코드 생성
2. **`__generated__/{ApiName}/`** — 자동 생성 API 클라이언트
3. **`apis/{domain}/{domain}.query.ts`** — React Query 훅 (useQuery, useMutation)
4. 환경변수: `NEXT_PUBLIC_SPRING_API_BASE_URL`

### 오피스랜드 전환 플래그
- `NEXT_PUBLIC_USE_SPRING_BOOT` — Supabase 직접 → Spring 전환용 플래그 (점진적 마이그레이션)

---

## 4. 개발 프로세스

### 브랜치 전략
```
main (릴리스)
  └─ dev (통합)
       └─ feat-xxx (기능 개발)
```
- `dev` 기준 feature 브랜치 생성 → PR → dev 병합
- **Dev CI/CD**: dev push 시 자동 빌드+배포
- **Staging**: Milestone 패턴, 수동 트리거
- **Production**: Staging 태그 → DockerHub → 수동 배포

### 로컬 개발 환경

#### 프론트엔드 (`proj-play-land`)
```bash
cd /Users/reus/Desktop/Sources/semicolon/land/proj-play-land
git checkout feat-play-idol  # 기능 브랜치
npm install
npm run dev                  # Next.js dev server
```
- `.env.local`에 Supabase URL/Key, Spring API URL 설정 필요

#### 백엔드 (`core-backend`)
```bash
cd /Users/reus/Desktop/Sources/semicolon/land/core-backend
git checkout feat-play-idol

# 1. 로컬 DB 실행
docker compose up postgres -d  # supabase/postgres:17.4.1.073, 포트 6432

# 2. DB 초기화 후 수동 작업 (supabase_admin으로)
#    - site_config_kv.key 컬럼 VARCHAR 변환
#    - GRANT ALL ON boards/point_codes/point_policies TO postgres

# 3. Spring Boot 실행
DB_HOST=localhost DB_PORT=6432 DB_NAME=postgres \
DB_USERNAME=postgres DB_PASSWORD=postgres \
SUPABASE_URL=http://localhost:8000 \
SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy \
SUPABASE_JWT_SECRET=a48d06bc-919e-41d3-8811-b77c2f621ee7 \
SPRING_PROFILES_ACTIVE=local \
SPRING_FLYWAY_BASELINE_VERSION=42 \
./gradlew bootRun
```

### 코드 작성 규칙

#### 백엔드 도메인 추가 시
```
domain/idol/
  ├─ entity/      (R2DBC @Table 엔티티)
  ├─ repository/  (ReactiveCrudRepository + 커스텀 쿼리)
  ├─ service/     (코루틴 서비스, awaitFirst/awaitFirstOrNull)
  ├─ web/         (RestController, @PublicApi/@RequireRole)
  └─ exception/   (sealed class + ExceptionHandler)
```

#### 프론트엔드 API 연동 시
```
src/
  ├─ __generated__/IdolV1/  (Swagger codegen)
  └─ apis/idol/
       └─ idol.query.ts     (React Query 훅)
```

---

## 5. 배포 파이프라인

### GitHub Actions (actions-template 재사용)

| 레포 | CI 템플릿 | K8s 서비스명 | 비고 |
|------|----------|-------------|------|
| `core-backend` | `ci-without-env.yml` | `land-backend` + `office-backend` | **1이미지 → 2서비스** |
| `proj-play-land` | `ci-next-only-land.yml` | `proj-play-land` | 빌드타임 시크릿 주입 |
| `proj-game-land` | `ci-next-only-land.yml` | `proj-game-land` | play-land와 동일 |
| `cm-office` | `ci-next-only-office.yml` | `cm-office` | 시크릿 최소 |

### GitOps 흐름
```
소스 Push → GitHub Actions 빌드 → DockerHub(semicolonmanager/<repo>)
  → semi-colon-ops (Kustomize) 태그 업데이트 → OKE(K8s) 배포
```

### 핵심 포인트
- `core-backend`는 **모든 랜드 공유** → 변경 시 전체 영향 고려 필요
- 프론트엔드는 **빌드타임에 NEXT_PUBLIC_* 주입** → 환경별 이미지 다름
- Production 배포는 수동 (Kustomize 자동 업데이트 없음)
- 인프라: OCI(Oracle Cloud) + OKE(K8s), 기존 Azure에서 마이그레이션 중

---

## 6. 플레이아이돌 구현 현황

### GitHub 이슈
- **BE**: #142(에픽), #143(DB), #144(프로필/신청), #145(콘텐츠), #146(캐쉬), #147(어드민), #148(채팅)
- **FE**: #1(에픽), #2(페이지), #3(채팅+신청 UI), #4(설정+어드민), #5(API 연동)

### 완료
- V43 Flyway 마이그레이션 (5개 신규 테이블 + 시드 데이터)
- #144 아이돌 프로필/신청/팔로우 도메인 BE 구현 (18파일, 908줄)
- FE 퍼블리싱: 캐러셀, 피드, 상세페이지, 채팅 탭

### 미완료
- #145 콘텐츠/피드 API (posts 재활용, 해금 로직, 인기도+캐쉬 이벤트)
- #146 도네이션/캐쉬 API (ACTIVITY_POINT→IDOL_CASH 변환, 환전)
- #147 어드민 설정 API (site_config_kv CRUD, 배치 인기도)
- #148 채팅 포인트 차감 연동
- FE API 연동 전체

### 설계 핵심 결정
- **캐쉬 = `IDOL_CASH` point_code** — 기존 포인트 시스템 재활용 (별도 테이블 X)
- **아이돌 콘텐츠 = posts** — 전용 board(id=100)에 `point_settings` 전부 0 → 기존 트리거 자동 스킵
- **인기도 = idol_profiles 컬럼** — MV 없음, 실시간 증분 + 일일 배치 보정
- **등급/설정 = site_config_kv** — `idol.tiers`, `idol.popularity_weights` 등 JSON
