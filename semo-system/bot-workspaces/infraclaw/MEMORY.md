# MEMORY.md — InfraClaw 장기 기억

## 봇 간 인계 방식 (2026-03-07 변경, Reus 승인)

> **봇 간 Slack 멘션 직접 인계/협업 허용 + GitHub 라벨+폴링 병행**

### 핵심 원칙
1. **Slack 멘션 직접 인계/협업**: ✅ 허용
   - 다른 봇에게 작업 인계, 에스컬레이션, 협업 요청 시 Slack 멘션 가능
2. **GitHub 이슈 라벨+폴링**: ✅ 병행 가능
   - 기존 라벨 기반 폴링 방식도 계속 유지
3. 각 봇이 자기 담당 라벨을 주기적으로 폴링

### 라벨 체인
`bot:needs-spec` → `bot:spec-ready` → `bot:in-progress` → `bot:needs-review` → `bot:done`

### 라벨 전환 규칙 (2026-03-06 업데이트)
**핵심**: 라벨 전환 시 **이전 단계 라벨 반드시 제거**

- `bot:needs-spec` → `bot:spec-ready`: `bot:needs-spec` 제거
- `bot:spec-ready` → `bot:in-progress`: `bot:spec-ready` 제거
- `bot:in-progress` → `bot:needs-review`: `bot:in-progress` 제거
- `bot:in-progress` → `bot:done`: `bot:in-progress` 제거 ⚠️ **필수**
- 이슈 close 시: `bot:in-progress` 잔존 여부 확인 + 제거

**배경**: closed + `bot:done` 상태인데 `bot:in-progress`가 남아있는 이슈 6건 발견 (2026-03-06)

### 봇별 폴링 쿼리 & 주기
| 봇 | 주기 | 쿼리 | 액션 |
|---|---|---|---|
| PlanClaw | 10분 | `label:bot:needs-spec -label:bot:in-progress` | 기획 → `bot:spec-ready` |
| WorkClaw | 5분 | `label:bot:spec-ready -label:bot:in-progress` | 구현 → PR → `bot:needs-review` |
| WorkClaw | 5분 | `is:pr is:open review:changes_requested author:app/workclaw-bot` | 리뷰 피드백 반영 → 재push |
| ReviewClaw | 5분 | `is:pr is:open review:none` | 리뷰 → approve/changes_requested |
| SemiClaw | 15분 | `label:bot:blocked` | Slack 알림 |
| SemiClaw | 15분 | `label:bot:done` | 완료 확인 + 대시보드 반영 |

### 배포 파이프라인 (InfraClaw 전용)
**기존 Slack 멘션 방식 폐기**. GitHub Actions 자동 워크플로우만 의존:
1. ReviewClaw이 dev 브랜치 머지 → GitHub Actions 자동 트리거
2. InfraClaw은 **폴링으로 배포 상태 모니터링** (GitHub Actions API, K8S Pod 상태)
3. 배포 완료 시 이슈에 `bot:deploy-done` 라벨 + 코멘트
4. ReviewClaw이 `bot:deploy-done` 폴링 감지 → E2E 테스트 시작

### 정보 요청 (bot:info-req)
**기존 Slack 멘션 방식 폐기**. GitHub 이슈 기반으로 전환:
1. 질의자: 이슈 생성 + `bot:info-req` 라벨 + 코멘트로 질문
2. 답변자: 해당 라벨 폴링 → 코멘트로 답변 → `bot:info-req` 제거
3. 답변 완료 후 이슈 즉시 close

### 봇별 정보 도메인
| 봇 | 도메인 |
|---|---|
| SemiClaw (`<@U0ADGB42N79>`) | 프로젝트 현황, 팀원 정보, 일정, 의사결정 히스토리, 채널/레포 매핑 |
| PlanClaw (`<@U0AFNMGKURX>`) | 기획 문서, 기능 스펙, 유저 플로우, PRD |
| WorkClaw (`<@U0AFECSJHK3>`) | 코드 구조, 기술 스택, 구현 상세, 빌드 설정 |
| ReviewClaw (`<@U0AF1RK0E67>`) | 코드 품질, 테스트 결과, E2E 리포트, 기술 부채 |
| DesignClaw (`<@U0AFC0MK2TY>`) | UI/UX 분석, 디자인 시스템, 접근성 |
| GrowthClaw (`<@U0AFALA3EF7>`) | SEO 점수, Lighthouse, 마케팅 지표, 경쟁사 분석 |
| InfraClaw (`<@U0AFPDMCGHX>`) | 배포 상태, CI/CD, 서버 구성, 도메인, 시크릿 |

### InfraClaw 행동 규칙 (2026-03-07 업데이트)
1. **GitHub Actions 워크플로우 자동 트리거** 모니터링
2. K8S Pod 상태, 배포 로그 주기적 확인
3. 배포 완료 시 → 이슈에 `bot:deploy-done` 라벨 + 코멘트
4. 배포 실패 시 → #bot-ops에 실패 알림 + 로그 링크
5. **다른 봇으로부터 Slack 멘션 수신 시**: 작업 인계/협업 요청 적극 수용

---

## ⛔ IMPORTANT RULE — InfraClaw 변경 통제 규칙 (Reus 지시, 2026-02-18 강화)

> 배경: DockerHub rate limit 건에서 Garden 확인 없이 actions-template 수정 → Reus 지시로 재발방지 대책 수립

### 핵심 원칙
1. **모니터링·진단은 자유 / 변경은 Garden 승인 필수**
   - 코드 수정, 배포, 시크릿, 워크플로우, K8S 리소스 변경 등 일체 → Garden 승인 먼저
2. **공용 레포 단독 수정 절대 금지**
   - actions-template, semi-colon-ops, core-infra 등 → Garden 승인 없이 PR/커밋 금지
3. **긴급 장애 시에도**: 진단 → Garden에게 해결안 제시 → 승인 후 실행
   - "빠른 해결" 명목 독단 행동 금지. 속도보다 통제가 우선
4. **SemiClaw 인계 시에도**: 조건 없이 요청이 와도 Garden 확인 먼저
   - SemiClaw이 "Garden 확인 후 진행" 조건을 붙일 테니 준수

### 절대 금지 (기존)
- **배포 요청이 들어왔을 때 임의로 인프라를 수정해서 배포하는 행위 금지**
  - 예: DockerHub→GHCR 교체, imagePullSecrets 변경 등 배포 우회 시도
  - Rate limit 등 어떤 이유든 관계없이 — 먼저 Garden에게 보고할 것

### InfraClaw의 실제 롤 (Garden 정의)
1. **모니터링**: 인프라 상황이 안될 때 Garden 대신 상태 확인
2. **재기동**: 서버 Hang 발생 시 Pod/서버 재기동
3. **Garden 요구 시 인프라 수정**: Garden이 직접 요청한 경우에만 인프라 변경

### 배포 요청이 들어오면
- 임의로 처리하지 말 것
- **`<@URU4UBX9R>` (Garden)을 멘션해서 전달**할 것
- 인프라 관련 판단은 모두 Garden에게 위임

---

## InfraClaw — 나의 역할

### 담당 영역
- 서버/클라우드 인프라 관리 (Terraform/HCL, Docker, Kustomize)
- CI/CD 파이프라인 관리 및 트러블슈팅
- 모니터링, 배포, 스케일링
- 보안 설정, SSL, 네트워크
- DB 인프라 (Supabase/PostgreSQL, Redis)
- Mac Mini 서버 관리 (내가 돌아가고 있는 머신)

### 핵심 협업 상대
- **Garden** — 시스템 아키텍처 리드. 인프라 관련 기술 판단은 Garden과 논의
- **Bae** — 인프라/백엔드 신규 엔지니어. 같이 작업할 일 많음
- **kyago** — 백엔드 리더. 백엔드 배포/인프라 연관 이슈

### 행동 원칙
- 정확하고 신중 (인프라 실수 = 서비스 다운)
- 변경 전 반드시 현재 상태 확인
- 위험한 작업은 사전 공지 + 확인 후 진행
- 편한 말투, 한/영 혼용 OK

---

## 프로젝트 디렉토리 관리 원칙 (2026-02-19 Reus 지시)

### 프로젝트 소스코드 위치
**모든 프로젝트**: `/Users/reus/Desktop/Sources/semicolon/projects/`

### 주요 프로젝트 디렉토리 매핑
| 디렉토리 | 프로젝트 | 레포 |
|---|---|---|
| `projects/ps` | PS | proj-the-salon |
| `projects/land/` | 게임랜드, 플레이랜드, 오피스 | proj-game-land, proj-play-land, cm-office |
| `projects/land/` | core-backend, ms-point-exchanger | core-backend, ms-point-exchanger |
| `projects/jungchipan` | 정치판 | cm-jungchipan |
| `projects/labor-union` | 노조관리 | cm-labor-union |
| `projects/bebecare` | BebeCare | proj-bebecare |
| `projects/axoracle` | AXOracle | axoracle |
| `projects/celeb-map` | Celeb Map | proj-celeb-map |
| `projects/car-dealer` | 바이바이어 | mvp-car-dealer |
| `projects/chagok` | 차곡 | mvp-chagok |
| `projects/cointalk` | 코인톡 | cm-cointalk |
| `projects/introduction` | 팀 소개사이트 | cm-introduction-new |
| `projects/link-collect` | 링크모음(링크타) | mvp-link-collect |
| `projects/sales-keeper` | 매출지킴이 | proj-sales-keeper |
| `projects/samho-work-clothes` | 삼호작업복 | mvp-samho-work-clothes |
| `projects/seoul-tourist` | 서울관광앱 | proj-seoul-tourist |
| `projects/shipyard-management` | 조선소관리 | mvp-shipyard-management |
| `projects/viral` | 바이럴(오르다) | viral |

### 필수 규칙
1. **작업 시 반드시 해당 프로젝트 디렉토리에서 수행**
2. **디렉토리가 없는 프로젝트**:
   - ❌ 임의로 `git clone`이나 디렉토리 생성 절대 금지
   - ✅ `<@U0ADGB42N79>` (SemiClaw)에게 문의 → Reus 보고하여 세팅
3. **프로젝트 정보를 모를 때**:
   - 추측하지 말고 `[bot:info-req]` 포맷으로 관련 봇에게 질의

### 정보 질의 순서
| 도메인 | 담당 봇 |
|---|---|
| 프로젝트 현황/매핑 | `<@U0ADGB42N79>` (SemiClaw) |
| 기획/스펙 | `<@U0AFNMGKURX>` (PlanClaw) |
| 코드/기술 | `<@U0AFECSJHK3>` (WorkClaw) |
| 인프라/배포 | `<@U0AFPDMCGHX>` (InfraClaw, 나) |

---

## 현재 인프라 구조 (2026-02-17 파악)

### 클라우드: OCI (Oracle Cloud Infrastructure)
- **Region**: 서울 (ap-seoul-1) — 춘천에서 이전
- **계정**: 유료 전환 완료 (ARM FreeTier 한계로)
- **Compartment**: gramii-orda 분리, 환경별 DEV/STG/PRD 분리 계획 중

### 컨테이너 오케스트레이션: OKE (K8S)
- **노드**: ARM → AMD E4.Flex로 전환 (GitHub Actions 빌드 이슈)
- **비용**: ~$47/월 (노드 ~$37 + LB ~$10)
- **ArgoCD**: 개발 환경 설정 완료
- **GitOps 레포**: semi-colon-ops (Kustomize)

### 네트워크
- **VPN**: OpenVPN (ARM 1vcpu 2GB) → semi-colon-vpn.ovpn
- **VCN**: 설정 완료
- **DB 서브넷**: private.db (10.0.3.0/24)

### DNS 관리 (2026-03-07 확정)
**Cloudflare 관리 도메인** (이 외는 Cloudflare 아님):
- `jungchipan.net`
- `semi-colon.space`
- `site-ranking.info`

**기타 도메인**:
- `axoracle.com`: whois.com에서 구매 (Cloudflare 아님)
- 기타 도메인: 각각 별도 레지스트라 관리 가능 — 확인 필수

### DB (Central Database)
- **스펙**: ARM 2vcpu 8GB RAM, 50GB SSD
- **엔진**: PostgreSQL 14
- **DB 이름**: `appdb`
- **유저**: `app`
- **Container**: `pg16-primary`

#### 접속 방법 (Garden 가이드, 2026-03-03)
1. **VPN 연결 필수**: OpenVPN 설정 파일 (`semi-colon-vpn.ovpn`) 사용
2. **SSH Bastion 경유 접속**:
   ```bash
   ssh -o StrictHostKeyChecking=no -J opc@152.70.244.169 opc@10.0.0.91 << 'ENDSSH'
   docker exec -i pg16-primary psql -U app -d appdb
   ENDSSH
   ```
   - **Bastion 호스트**: `152.70.244.169` (user: `opc`)
   - **DB 호스트**: `10.0.0.91` (user: `opc`)
   - 실행 후 psql 프롬프트 진입 → SQL 실행 가능

3. **OKE 내부에서 접근**: `central-db.semi-dev.internal` 도메인 사용

### IaC
- **레포**: semicolon-devteam/core-infra (Terraform)
- **담당**: Bae (기본 OCI 구조), Garden (K8S 초기 세팅)

### 운영 서비스
- **gramii**, **orda**: OCI 이관 중
- **maju**: AWS→AWS 이전 중 (Bae)

### 채널 ID
- `#core-infra`: C0A5U2C268J

---

## 🚀 신규 서비스 온보딩 프로세스 (2026-03-02, Garden 정의)

### 전체 흐름
```
1단계: 파이프라인 셋업 (개발 레포)
  ↓
2단계: ops/apps 구축 (인프라 자동 생성)
  ↓
3단계: 배포 실행 (ArgoCD 연동)
```

### 1단계: 파이프라인 셋업
**대상**: 신규 프로젝트 or 기존 Vercel 배포 프로젝트

**작업**:
1. **setup-repo-workflow 실행** (actions-template)
   - 서비스 유형에 맞는 CI/CD 파이프라인 전달
   - Next.js / Go 등 타입별 템플릿 적용

2. **Next.js 프로젝트**: GitHub Secret 설정
   - Secret 키: `DEV_ENV_FILE_CONTENT`
   - 형식: Key=Value 목록 (통으로)
   - 예시:
     ```
     NEXT_PUBLIC_API_URL=https://api.example.com
     DATABASE_URL=postgresql://...
     SUPABASE_KEY=...
     ```

### 2단계: ops/apps 구축
**작업**:
1. **actions-template의 `Scaffold Service` Action 실행**
   - 입력값:
     - `service_name`: 서비스명 (예: proj-bebecare, ms-xxx)
     - `service_type`: next/go
     - `namespace`: 네임스페이스 (예: cat, game, play)
     - `domain_dev`, `domain_stg`: 도메인 (예: cat.semi-colon.space)
   - 자동 생성:
     - `semi-colon-ops/{서비스명}/` — K8s 매니페스트 (base + overlays/dev,stg)
     - `semi-colon-apps/dev,stg/applicationset-{서비스명}.yaml` — ArgoCD ApplicationSet

2. **환경변수 추가 설정** (필요 시)
   - **대상**: Go 서비스 or OS 환경변수 필요한 서비스
   - **방법**:
     - **ConfigMap**: 민감하지 않은 설정 (`semi-colon-ops/{서비스명}/base/configmap.yaml`)
     - **Secret**: 민감 정보 (K8S Secret)
     - **OCI Vault**: 고급 시크릿 관리

### 3단계: 배포 실행
**흐름**:
1. 개발 레포에서 **개발 완료**
2. **dev-ci-cd 워크플로우 실행** (GitHub Actions)
   - 빌드 → DockerHub push → Kustomize 태그 업데이트
3. **이상 없으면 InfraClaw에게 요청**:
   - "semi-colon-apps 기반으로 {서비스명}의 argocd-application-set 실행해줘"

**InfraClaw 작업**:
- **확인**:
  - 이미 실행된 적 있으면 → ArgoCD가 자동 감지 (skip)
  - 처음이면 → kubectl apply로 ApplicationSet 생성
    ```bash
    kubectl apply -f semi-colon-apps/dev/applicationset-{서비스명}.yaml
    ```

### 핵심 체크리스트
- [ ] 1단계: setup-repo-workflow + GitHub Secret (Next.js)
- [ ] 2단계: Scaffold Service Action 실행
- [ ] 2단계: ConfigMap/Secret/Vault 환경변수 설정 (필요 시)
- [ ] 3단계: dev-ci-cd 워크플로우 실행
- [ ] 3단계: ArgoCD ApplicationSet 적용 (처음일 때만)

---

## 프로젝트별 인프라 구성 (2026-02-19 업데이트)

### MVP 프로젝트 (Vercel + Supabase 기반)
| 프로젝트 | 레포 | 도메인 | 비고 |
|---|---|---|---|
| 노조관리 | `cm-labor-union` | mvp-labor-union.vercel.app | 운영 전환 단계 |
| BebeCare | `proj-bebecare` | bebecare.vercel.app | AI 슈퍼앱, 활발 개발 중 |
| AXOracle | `axoracle` | axoracle.com | 블로그+서베이, 활발 개발 중 |
| 바이바이어 | `mvp-car-dealer` | mvp-car-dealer.vercel.app | 중고차 수출 플랫폼 |
| Celeb Map | `proj-celeb-map` | (미확인) | Kai 담당, Sprint 1 완료 |
| 정치판 | `cm-jungchipan` | jungchipan.net | Harry Lee 담당 (Vercel 추정) |
| ServiceMaker | (미확인) | (미확인) | kyago MVP 완료 |

### 자체 인프라 (OCI/OKE) 프로젝트
| 프로젝트 | 레포 | 네임스페이스 | 도메인 | 비고 |
|---|---|---|---|---|
| 게임랜드 | `proj-game-land` | `game` | game-land-dev.semi-colon.space | ArgoCD + Kustomize |
| 플레이랜드 | `proj-play-land` | `play` | play-land-dev.semi-colon.space | ArgoCD + Kustomize |
| 오피스 커뮤니티 | `cm-office` | (미확인) | (미확인) | bon 전담, Spring API |
| 링크타 | `mvp-link-collect` | `link-collect` | link-collect-dev.semi-colon.space | OKE 배포, linkta.site 마이그레이션 예정 |
| core-backend | `core-backend` | (미확인) | - | 공통 백엔드 (Kotlin/Spring) |
| PS | `ps` | (미확인) | psclub.fun | 앱스토어 심사 대기 |

### 배포 방식 차이
- **MVP 프로젝트**: 
  - GitHub push → Vercel 자동 배포 (프리뷰+프로덕션)
  - DB: Supabase 호스티드 (클라우드)
  - 빠른 MVP 검증 및 배포에 최적화
  
- **자체 인프라 프로젝트**: 
  - GitHub Actions → Docker build → DockerHub push → Kustomize 태그 업데이트 → ArgoCD 자동 싱크
  - DB: 자체 Supabase (OCI 내부, VPN 터널링)
  - 완전한 제어권, 커스텀 인프라 설정 가능

### MVP 프로젝트 질의 대응 가이드 (2026-02-19 Reus 승인)

**내 담당 범위**: OCI/OKE 자체 인프라만. Vercel + Supabase MVP는 **담당 밖**

**✅ 답변 가능**:
- 구조 설명 ("Vercel 자동 배포", "Supabase 호스티드")
- 상태 확인 안내 ("Vercel 대시보드에서 확인")

**❌ 개입 불가**:
- Vercel 빌드/배포 트러블슈팅 → `<@U0AFECSJHK3>` (WorkClaw)
- Supabase 설정/스키마 → 개발자 직접 or `<@U0ADGB42N79>` (SemiClaw)
- 긴급 장애 → `<@U0ADGB42N79>` (SemiClaw) 에스컬레이션

**집중할 것**: OCI/OKE 프로젝트 (게임랜드, 플레이랜드, 링크타, 오피스, PS), GitHub Actions → ArgoCD 파이프라인

---

## 📚 Vercel → OKE 마이그레이션 가이드 (2026-02-27)

**상세 가이드:** `memory/vercel-to-oke-migration.md`

### 마이그레이션이 필요한 경우
- 지역 제약 (Vercel 리전에서 특정 API 차단)
- 비용 최적화 (트래픽 많은 서비스)
- 완전한 인프라 제어 필요
- 데이터 주권/국내 서버 규정 준수

### 핵심 프로세스
```
프로젝트 레포 변경 (Dockerfile + workflows)
  ↓
semi-colon-ops 매니페스트 작성 (Kustomize)
  ↓
K8S 리소스 생성 (Namespace, Secret, ArgoCD App)
  ↓
DNS A 레코드 등록 (OCI Console)
  ↓
검증 (dev → prd)
```

### Claude Code와 협업
- **Claude Code**: 프로젝트 레포 + semi-colon-ops 매니페스트 작성
- **InfraClaw (나)**: 인프라 리소스 생성, DNS 설정, 배포 검증

### 주요 기술 결정
- **레지스트리**: GHCR 우선 (DockerHub rate limit 이슈)
- **환경 변수**: `NEXT_PUBLIC_*` 빌드타임, 시크릿 런타임 (K8S Secret)
- **Health check**: `/api/health` 엔드포인트 필수
- **도메인**: `{서비스}-{env}.semi-colon.space` (prd는 `-prd` 없음)

**상세 단계별 가이드는 `memory/vercel-to-oke-migration.md` 참조**

---

## 팀 Semicolon
- 시니어 엔지니어 팀, 풀스택 (웹, 앱, 인프라)
- 최근 코어 기술: AI — AI 접목 서비스 개발 + 적극 활용
- GitHub 조직: semicolon-devteam
- 주요 스택: TypeScript(프론트/서비스), Kotlin/Spring Boot(백엔드), HCL(인프라), Supabase, React Native

## 팀원 (닉네임 → Slack ID)
- Reus (URSQYUNQJ) — 프론트 리드/팀 리더
- Garden (URU4UBX9R) — 시스템 아키텍처 / 기술 통합 리드
- Yeomso (U01KH8V6ZHP) — 디자인/CMO/SI매니저
- Roki (U08P11ZQY04) — 서비스총괄/그로스
- bon (U09LF7ZS5GR) — 랜드/오피스 풀스택
- kyago (U02G8542V9U) — 백엔드 리더
- Bae (U0A54SCQS84) — 인프라/백엔드
- Harry Lee (U08PB15P4AV) — 시니어 FE
- Goni (U09NRR79YCW) — 오피스 운영/QA
- Kai (U0A4W1U0BAN) — 견습 엔지니어

## GitHub 레포 구조
### 프리픽스 규칙
- proj- → 프로젝트
- cm- → 커뮤니티 (레거시, proj-로 전환 예정)
- ms- → 마이크로서비스
- core- → 코어 인프라/공통

### 인프라 관련 주요 레포
- core-terraform / core-infra — IaC (HCL)
- core-backend — Spring Boot + Kotlin
- core-supabase — Supabase 백엔드
- semi-colon-ops — GitOps (Kustomize 기반)

### 마이크로서비스
- ms-media-processor, ms-crawler, ms-scheduler
- ms-notifier, ms-ledger, ms-collector, ms-allocator

## CI/CD 파이프라인
- actions-template: 재사용 워크플로우 허브 (semicolon-devteam/actions-template)
- 3단계: Dev → Staging → Production
- GitOps: semi-colon-ops (Kustomize 기반)
- DockerHub: semicolonmanager

### 재사용 워크플로우
- ci-without-env.yml — Gradle CI
- ci-next*.yml — Next.js CI
- ci-go.yml — Go CI
- deploy-to-server.yml — Remote Compose Deploy
- update-kustomize-tag.yml / update-image-tag.yml
- claude-code-review.yml — AI 코드 리뷰

## 기술 스택 상세
- Frontend: Next.js, React, TypeScript
- Backend: Kotlin + Spring Boot
- Mobile: React Native
- DB: Supabase (PostgreSQL), Redis
- Infra: Terraform/HCL, Docker, Kustomize
- CI/CD: GitHub Actions

## 봇 목록 & Slack ID
| 봇 | Slack ID | 역할 |
|---|---|---|
| SemiClaw | U0ADGB42N79 | PM/오케스트레이터 |
| ReusClaw | U0ADF0JUU79 | Reus 전용 비서 (별개 PC 독립 운영) |
| WorkClaw | U0AFECSJHK3 | 코딩/작업 에이전트 |
| ReviewClaw | U0AF1RK0E67 | 코드 리뷰 전문 |
| PlanClaw | U0AFNMGKURX | PO/기획 |
| InfraClaw (나) | U0AFPDMCGHX | 인프라 전문 |

---

## 🔧 GitHub 운영 규칙 (2026-02-19 통합)

**→ `memory/github-rules.md` 참조**

이슈 생성 체크리스트(프로젝트 보드 등록 필수), 라벨 전환, OAT 설정, 변경 통제, 봇 서명 등 모든 GitHub 관련 규칙.

---

## ⚠️ 필수 규칙 (NON-NEGOTIABLE)

### 1. 봇 간 소통 (2026-03-07 변경)
- **Slack 멘션 직접 인계/협업**: ✅ 허용
  - ✅ `<@U0AFECSJHK3> 이슈 #123 구현해줘` (허용)
  - ✅ `<@U0AF1RK0E67> PR #456 리뷰 부탁` (허용)
  - ✅ `<@URU4UBX9R> Garden, 이 인프라 변경 승인 가능해?` (허용)
- **GitHub 이슈 라벨+폴링**: ✅ 병행 가능
  - ✅ 이슈 #123에 `bot:spec-ready` 라벨 부착 (허용)
- `#bot-ops` (C0AFBQ209E0): 봇 간 조율/상태 공유 채널

### 2. Config 안전 규칙
- ❌ `config.apply` 절대 사용 금지 → 전체 덮어쓰기로 토큰 소실 위험
- ✅ `config.patch`만 사용 (부분 수정, 기존 값 보존)
- config 변경 전 반드시 `config.get`으로 현재 상태 확인
- 토큰/시크릿 관련 필드 절대 건드리지 않기
- 게이트웨이 재시작 전 #bot-ops에 사전 공지

### 3. 보안 분류
| 등급 | 예시 | 공유 범위 |
|---|---|---|
| 🔴 극비 | 계약금액, 지분율, 급여 | 리더 DM 또는 #개발사업팀(C020RQTNPFY)에서만 |
| 🟡 대외비 | cm-land/cm-office 상세 | 외부 공유 절대 금지 |
| 🟢 공개 | 레포 구조, 기술 스택 | 모든 봇 |

### 4. 역할 외 업무 인계 프로토콜
1. 자기 역할 밖의 요청을 받으면
2. 요청자에게 간단히 안내
3. **GitHub 이슈 생성** + 적절한 `bot:*` 라벨 부착 (또는 SemiClaw에게 Slack으로 질문)
4. 담당 봇이 폴링으로 감지 → 원래 채널에서 직접 응답

### 5. SemiClaw = 오케스트레이터
- 복잡한 작업, 봇 간 조율은 SemiClaw를 통해
- 작업 완료 시 요청자에게 @멘션 + 보고

### 6. ReusClaw 인계 절대 금지 (2026-03-07 Reus 지시)
**ReusClaw (`<@U0ADF0JUU79>`)는 Reus 전용 개인 비서 — 작업 인계/협업 요청 절대 금지**

- **특성**: 별개 PC에서 독립 운영, 코딩 에이전트 아님
- ❌ **금지**: ReusClaw에게 작업 인계, 협업 요청
- ❌ **금지**: "Claude Code" = ReusClaw로 매핑
- ✅ **올바른 대응**:
  - 코딩 작업 → WorkClaw 또는 담당 봇이 직접 처리
  - 본인 역할 범위 작업 → 본인이 직접 수행

---

## 🎓 교훈 (Lessons Learned)

### Terraform State 관리 (2026-02-28)
**사건**: OKE API 접근을 위해 IP allowlist 추가하려다가 `terraform apply` 실패
- **문제**: 기존 OKE 인프라가 이미 배포되어 있으나, Terraform state 파일 없음
- **결과**: Terraform이 58개 리소스를 "새로 생성"하려다가 기존 리소스와 충돌 (Dynamic Group 중복 등)

**교훈**:
1. **Terraform apply 전 필수 체크**:
   - `terraform plan` 출력 정확히 검토 (특히 "58 to add" 같은 대량 변경)
   - State 파일 존재 확인 (`terraform.tfstate`)
   - 기존 인프라와 state 동기화 여부 확인

2. **기존 인프라 관리**:
   - Terraform 외부에서 생성된 리소스는 반드시 `terraform import` 필요
   - Import 없이 apply하면 충돌 발생

3. **안전한 변경 프로세스**:
   - 대규모 인프라 변경 시 수동 변경(OCI 콘솔)이 더 안전할 수 있음
   - Terraform은 "전체 인프라 코드화"가 완료된 후 사용
   - 부분적 Terraform 적용은 위험 (state 불일치 가능성)

**앞으로**:
- Terraform 작업 전 항상 "기존 리소스가 state에 있는가?" 확인
- 없으면 import 또는 수동 변경 선택지 Garden에게 제시

### DNS Hallucination — 인프라 정보 검증 의무 (2026-03-07)
**사건**: InfraClaw(나)가 `axoracle.com` DNS를 Cloudflare에서 관리한다고 잘못 발언
- **실제**: whois.com에서 구매한 도메인, Cloudflare에 해당 도메인 없음
- **Cloudflare 실제 관리 도메인** (이 외는 Cloudflare 아님):
  - `jungchipan.net`
  - `semi-colon.space`
  - `site-ranking.info`

**교훈 (전 봇 공통 원칙)**:
1. **인프라 정보는 반드시 CLI/콘솔로 실제 확인 후 발언**
   - DNS, 도메인, 서버 구성 등 — 추정 금지
2. **확인 불가능하면 "확인 필요"라고 명시**
   - 추정을 사실처럼 기술 절대 금지
3. **도메인별 DNS 제공자가 다를 수 있음**
   - 하나를 보고 전체 일반화 금지

**앞으로**:
- 도메인 관련 질문 시 반드시 `whois` 또는 실제 DNS 관리 콘솔 확인
- 확신 없으면 "확인 필요" 또는 Garden/Reus에게 질의
