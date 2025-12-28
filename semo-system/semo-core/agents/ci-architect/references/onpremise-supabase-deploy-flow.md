# 온프레미스 Supabase 서비스 배포 플로우

> Next.js + 온프레미스 Supabase 환경의 CI/CD 파이프라인

## 개요

온프레미스 Supabase를 사용하는 Next.js 서비스의 전체 배포 플로우입니다.

```text
feature → dev → stg → prd (태깅) → 운영 배포
```

---

## 환경 구성

| 환경 | 브랜치 | 도메인 예시 | 배포 방식 |
|------|--------|-------------|----------|
| **Development** | `dev` | `land-dev.semi-colon.space` | PR 머지 시 자동 배포 |
| **Staging** | `release-{version}` | `land-stg.semi-colon.space` | Milestone 기반 수동 트리거 |
| **Production** | 태그 `v{version}` | `land.semi-colon.space` | infra 레포 수동 배포 |

---

## Phase 1: Development 배포

### 플로우

```text
1. feature/{name} 브랜치에서 작업
2. PR 생성 → dev 브랜치로 머지 요청
3. 코드 리뷰 후 머지
4. GitHub Actions 자동 실행 → dev 서버 배포
```

### 자동화 (이미 구현됨)

- PR이 `dev` 브랜치에 머지되면 자동으로 dev 서버에 배포
- 별도 수동 작업 불필요

---

## Phase 2: Staging 배포

### 사전 조건

- dev 환경 테스트 완료
- 릴리스 준비 상태

### 단계별 절차

#### Step 1: Milestone 생성

서비스 레포지토리에서 Milestone 생성:

```text
GitHub > Issues > Milestones > New milestone

Title: release-{major}.{minor}.{patch}
예시: release-1.0.4

Description: (선택) 릴리스 노트
Due date: (선택) 릴리스 예정일
```

**네이밍 규칙**:
- 형식: `release-{version}`
- 예시: `release-1.0.4`, `release-2.1.0`
- SemVer 준수

#### Step 2: Staging CI/CD 실행

```text
GitHub > Actions > Staging CI/CD > Run workflow

Branch: dev (또는 대상 브랜치)
[Run workflow] 클릭
```

#### Step 3: 결과 확인

성공 시:
- `release-{version}` 브랜치 자동 생성
- 해당 브랜치 기준으로 stg 서버 배포
- 접속 확인: `https://{service}-stg.semi-colon.space/`

```bash
# 브랜치 확인
git fetch origin
git branch -r | grep release

# 배포 확인
curl -s https://{service}-stg.semi-colon.space/api/health
```

---

## Phase 3: Production 태깅

### 사전 조건

- Staging 환경 QA 완료
- 프로덕션 배포 승인

### 단계별 절차

#### Step 1: Production Tagging 실행

```text
GitHub > Actions > Production Tagging > Run workflow

Branch: release-{version} (stg에서 생성된 브랜치)
[Run workflow] 클릭
```

#### Step 2: 결과 확인

성공 시:
- Release 자동 생성 (Milestone 이름 기준)
- 태그 생성: `v{version}`
- Milestone 자동 close

```bash
# 릴리스 확인
gh release list --repo semicolon-devteam/{service}

# 태그 확인
git tag -l "v*"
```

---

## Phase 4: Production 배포

### 사전 조건

- Production Tagging 완료
- Release 버전 확인

### 단계별 절차

#### Step 1: infra 레포 버전 업데이트

**운영 GitHub 계정**으로 `infra` 레포지토리 접속:

```text
https://github.com/{org}/infra
```

`docker-compose.yml` 파일에서 해당 서비스 이미지 버전 수정:

```yaml
# docker-compose.yml

services:
  {service-name}:
    image: semicolonmanager/{service}:{new-version}  # 버전 업데이트
    # ...
```

**예시**:
```yaml
# Before
cm-land:
  image: semicolonmanager/cm-land:v1.0.3

# After
cm-land:
  image: semicolonmanager/cm-land:v1.0.4
```

변경 후 커밋:
```text
chore: update {service} to v{version}
```

#### Step 2: 운영 서버 SSH 접속

```bash
ssh {user}@{production-server}
```

#### Step 3: 배포 실행

```bash
# infra 디렉토리로 이동
cd /path/to/infra

# 최신 변경사항 가져오기
git pull

# 새 이미지 다운로드
docker compose pull

# 서비스 중지
docker compose down

# 서비스 시작
docker compose up -d
```

**원라이너** (주의: 다운타임 발생):
```bash
cd /path/to/infra && git pull && docker compose pull && docker compose down && docker compose up -d
```

#### Step 4: 배포 확인

```bash
# 컨테이너 상태 확인
docker compose ps

# 로그 확인
docker compose logs -f {service-name} --tail 100

# 헬스체크
curl -s https://{service}.semi-colon.space/api/health
```

---

## 전체 플로우 다이어그램

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Development                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  feature branch → PR → merge to dev → Auto Deploy to dev server         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Staging                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Create Milestone (release-x.y.z)                                     │
│  2. Run "Staging CI/CD" Action                                           │
│  3. release-x.y.z branch created → Deploy to stg server                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Production Tagging                               │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Run "Production Tagging" Action                                      │
│  2. Release created (vx.y.z)                                             │
│  3. Milestone auto-closed                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Production Deploy                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Update docker-compose.yml in infra repo (ops account)                │
│  2. SSH to production server                                             │
│  3. git pull → docker compose pull → down → up -d                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 체크리스트

### Staging 배포 전

- [ ] dev 환경 테스트 완료
- [ ] Milestone 생성 (release-x.y.z)
- [ ] 변경사항 문서화

### Production 태깅 전

- [ ] stg 환경 QA 완료
- [ ] 팀 승인 획득
- [ ] 롤백 계획 수립

### Production 배포 전

- [ ] Release 버전 확인
- [ ] infra 레포 docker-compose.yml 업데이트
- [ ] 배포 시간 조율 (저트래픽 시간대 권장)
- [ ] 모니터링 준비

### Production 배포 후

- [ ] 헬스체크 확인
- [ ] 주요 기능 스모크 테스트
- [ ] 로그 이상 여부 확인
- [ ] 팀 공유

---

## 롤백 절차

### Staging 롤백

```bash
# 이전 release 브랜치로 재배포
# Actions > Staging CI/CD > 이전 release 브랜치 선택
```

### Production 롤백

```bash
# 1. infra 레포에서 이전 버전으로 docker-compose.yml 수정
# 2. SSH 접속 후 재배포

cd /path/to/infra
git pull
docker compose pull
docker compose down
docker compose up -d
```

---

## 트러블슈팅

### Staging CI/CD 실패

```bash
# 워크플로우 로그 확인
gh run list --workflow="Staging CI/CD" --repo semicolon-devteam/{service}
gh run view {run-id} --log
```

### Production 배포 후 서비스 불가

```bash
# 컨테이너 상태 확인
docker compose ps

# 로그 확인
docker compose logs {service-name} --tail 200

# 즉시 롤백
# docker-compose.yml에서 이전 버전으로 수정 후 재배포
```

---

## 관련 문서

- [workflow-templates.md](workflow-templates.md) - GitHub Actions 워크플로우 템플릿
- [dockerfile-patterns.md](dockerfile-patterns.md) - Dockerfile 패턴
- [deploy-master Agent](../../deploy-master/deploy-master.md) - 배포 전문 Agent
