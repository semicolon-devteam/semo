---
name: deploy
description: |
  서비스 배포 (Docker/SSH 직접 배포 및 GitHub Actions 기반 배포).
  Use when:
  (1) ms-* 서비스 Docker/PM2 배포,
  (2) 프로젝트 별칭 + 환경 (예: "랜드 stg 배포"),
  (3) Milestone 기반 릴리즈 관리,
  (4) 배포 상태 조회.
tools: [Read, Bash, mcp__github__*]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: deploy 호출 - {method} {service_name}` 시스템 메시지를 첫 줄에 출력하세요.

# deploy Skill

> 서비스 배포: Docker/SSH 직접 배포 및 GitHub Actions 기반 배포 통합

## 배포 방식 선택 기준

| 조건 | 배포 방식 | 설명 |
|------|----------|------|
| ms-* 마이크로서비스 | **Docker/SSH** | Docker 빌드 → SSH 전송 → PM2 재시작 |
| 프로젝트 별칭 사용 | **GitHub Actions** | Milestone Close → CI/CD 자동 트리거 |
| "Docker 빌드", "PM2" 언급 | **Docker/SSH** | 원격 서버 직접 제어 |
| "Milestone", "릴리즈" 언급 | **GitHub Actions** | CI/CD 워크플로우 |

---

## Method 1: Docker/SSH 직접 배포

> ms-* 마이크로서비스 등 Docker + PM2 방식 배포

### 배포 환경

| 환경 | 대상 | 배포 방식 |
|------|------|----------|
| **development** | 로컬 | Docker Compose |
| **staging** | AWS Lightsail | Docker + PM2 |
| **production** | AWS Lightsail | Docker + PM2 (Blue-Green) |

### Workflow

```
1. 서비스명/환경 확인
2. Dockerfile 확인
3. Docker 이미지 빌드
4. (staging/prod) SSH로 이미지 전송
5. PM2 재시작
6. 헬스체크
```

### 실행 예시

```bash
# 1. Docker 이미지 빌드
cd /path/to/service
docker build -t ms-notifier:latest .

# 2. 이미지 저장 (staging/prod)
docker save ms-notifier:latest | gzip > ms-notifier.tar.gz

# 3. SSH 전송
scp ms-notifier.tar.gz user@server:/tmp/

# 4. 원격에서 이미지 로드 & 컨테이너 재시작
ssh user@server << 'EOF'
  docker load < /tmp/ms-notifier.tar.gz
  docker stop ms-notifier || true
  docker rm ms-notifier || true
  docker run -d --name ms-notifier \
    -p 3001:3001 \
    --env-file /app/.env.staging \
    ms-notifier:latest
EOF

# 5. PM2 등록 (옵션)
ssh user@server "pm2 restart ms-notifier || pm2 start docker-compose.yml --name ms-notifier"
```

### 출력

```markdown
[SEMO] Skill: deploy 완료 (Docker/SSH)

✅ **ms-notifier** staging 배포 완료

**이미지**: ms-notifier:latest
**서버**: 10.0.0.91
**상태**: Running
```

---

## Method 2: GitHub Actions 기반 배포

> Milestone Close → CI/CD 자동 트리거

### Semicolon 브랜치 전략

| 환경 | 브랜치/태그 | 트리거 | 설명 |
|------|-------------|--------|------|
| DEV | `dev` | push | 개발 환경 (기본 브랜치) |
| STG | `release-x.x.x` | Milestone Close | 마일스톤 기반 릴리즈 브랜치 |
| PRD | `vx.x.x` 태그 | Production Tagging | 릴리즈 태그 |

### Workflow

```
1. 프로젝트 별칭 확인 (.claude/memory/projects.md)
2. Milestone 조회
3. Milestone Close → release-x.x.x 브랜치 생성
4. GitHub Actions 자동 트리거
5. 배포 상태 확인
```

### 실행 예시

```bash
# 1. 프로젝트 별칭으로 레포 확인
# .claude/memory/projects.md 참조

# 2. Milestone Close (GitHub CLI)
gh api \
  --method PATCH \
  /repos/semicolon-devteam/{repo}/milestones/{milestone_number} \
  -f state='closed'

# 3. release 브랜치 생성
git checkout -b release-1.2.0
git push origin release-1.2.0

# 4. GitHub Actions 자동 실행
# .github/workflows/deploy-stg.yml 트리거됨

# 5. 배포 상태 조회
gh run list --workflow=deploy-stg.yml --limit=1
```

### 출력

```markdown
[SEMO] Skill: deploy 완료 (GitHub Actions)

✅ **랜드** staging 배포 시작

**Milestone**: v1.2.0
**브랜치**: release-1.2.0
**Actions**: [#123](https://github.com/...)
```

---

## 배포 상태 조회

```bash
# GitHub Actions 최근 배포 확인
gh run list --workflow=deploy-stg.yml --limit=5

# Docker 컨테이너 상태 (SSH)
ssh user@server "docker ps | grep ms-notifier"

# PM2 상태
ssh user@server "pm2 status"
```

---

## Related

- `health-check` - 배포 후 서비스 헬스체크
- `incident` - 배포 실패 시 롤백
- `release` - 릴리즈 버전 관리
