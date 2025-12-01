# SAX-Infra Package Configuration

> 인프라, CI/CD, DevOps 작업을 위한 SAX 패키지

## Package Info

- **Package**: SAX-Infra
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: core-compose, actions-template
- **Audience**: DevOps, 인프라 담당자

---

## 🔴 새 세션 시작 시 버전 체크 (NON-NEGOTIABLE)

> **새 세션에서 첫 작업 전, SAX 패키지 버전을 확인하고 업데이트를 제안합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### 체크 워크플로우

```bash
# 1. 로컬 버전 확인
LOCAL_VERSION=$(cat .claude/sax-infra/VERSION 2>/dev/null)

# 2. 원격 버전 확인
REMOTE_VERSION=$(gh api repos/semicolon-devteam/sax-infra/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)

# 3. 비교
if [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
  echo "UPDATE_AVAILABLE"
fi
```

### 업데이트 가능 시 출력

```markdown
[SAX] version-updater: 업데이트 가능

📦 **SAX 업데이트 알림**

현재 버전: {local_version}
최신 버전: {remote_version}

업데이트하려면: "SAX 업데이트해줘"
```

---

## 🔴 SAX Core 필수 참조 (NON-NEGOTIABLE)

> **모든 응답 전에 반드시 sax-core 문서를 참조합니다.**

### 필수 참조 파일

| 파일 | 용도 | 참조 시점 |
|------|------|----------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 | 모든 작업 전 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 | 모든 응답 시 |
| `sax-core/TEAM_RULES.md` | 팀 규칙 | Git, 품질 관련 작업 |

### 참조 방법

```bash
# 로컬 설치된 경우
.claude/sax-core/PRINCIPLES.md
.claude/sax-core/MESSAGE_RULES.md

# 또는 GitHub API
gh api repos/semicolon-devteam/sax-core/contents/PRINCIPLES.md --jq '.content' | base64 -d
```

---

## 🔴 Orchestrator 위임 필수 (NON-NEGOTIABLE)

> **모든 사용자 요청은 반드시 Orchestrator를 통해 라우팅됩니다.**

### 동작 규칙

1. **사용자 요청 수신 시**: 즉시 `agents/orchestrator/orchestrator.md` 읽기
2. **Orchestrator가 적절한 Agent/Skill 결정**
3. **SAX 메시지 포맷으로 라우팅 결과 출력**

### 메시지 포맷 (sax-core/MESSAGE_RULES.md 준수)

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

---

## 🔴 Target Repositories

| 레포지토리 | 역할 | 주요 파일 |
|------------|------|----------|
| **core-compose** | 배포 매니페스트 | `docker-compose.yml`, `nginx/`, `.env.*` |
| **actions-template** | CI/CD 템플릿 | `Dockerfile-*`, `.github/workflows/*.yml` |

### Repository 접근

```bash
# core-compose
gh api repos/semicolon-devteam/core-compose/contents/{path} --jq '.content' | base64 -d

# actions-template
gh api repos/semicolon-devteam/actions-template/contents/{path} --jq '.content' | base64 -d
```

---

## 🔴 Quality Gates (NON-NEGOTIABLE)

### docker-compose 수정 시

```bash
# 문법 검증
docker-compose --env-file .env.stg config

# 서비스 목록 확인
docker-compose --env-file .env.stg config --services
```

### nginx 수정 시

```bash
# 설정 검증 (컨테이너 내)
docker-compose run --rm webserver nginx -t
```

### workflow 수정 시

```bash
# dry-run (act 사용 시)
act -n -W .github/workflows/{workflow}.yml

# 또는 GitHub CLI 검증
gh workflow view {workflow}.yml
```

---

## 🔴 금지 사항 (NON-NEGOTIABLE)

| 항목 | 사유 | 대안 |
|------|------|------|
| 프로덕션 직접 배포 | 위험 | staging 먼저, 검증 후 배포 |
| 인증정보 커밋 | 보안 | GitHub Secrets 사용 |
| `.env` 직접 수정 | 환경 분리 | `.env.{env}` 템플릿 사용 |
| force push (main) | 히스토리 손상 | PR 기반 작업 |
| `--no-verify` 커밋 | Hook 우회 | 에러 수정 후 커밋 |

---

## Workflow

### 새 서비스 추가

```text
1. actions-template: Dockerfile 추가
   └── Dockerfile-{service}

2. actions-template: CI workflow 추가
   └── .github/workflows/ci-{service}.yml

3. core-compose: docker-compose 서비스 추가
   └── docker-compose.yml → services.{service}

4. core-compose: nginx upstream/vhost 추가
   └── nginx/{env}/conf.d/{service}.conf

5. core-compose: .env 템플릿 업데이트
   └── .env.dev, .env.stg
```

### 배포

```text
1. skill:verify-compose → 문법 검증
2. skill:verify-nginx → 설정 검증
3. skill:deploy-service → SSH 배포 실행
4. 헬스체크 확인
```

### 롤백

```text
1. 이전 이미지 태그 확인
2. skill:rollback-service → 롤백 실행
3. 서비스 상태 확인
```

---

## Architecture

### Docker Compose 구조

```yaml
services:
  {service-name}:
    image: semicolonmanager/{image}:${TAG:-latest}
    restart: unless-stopped
    networks:
      - application-network
    env_file:
      - .env.{service}
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### Nginx 구조

```text
nginx/{env}/
├── nginx.conf              # 글로벌 설정
├── conf.d/
│   ├── cloudflare-realip.conf
│   ├── rate-limiting.conf
│   ├── security-headers.conf
│   ├── upstream-health.conf
│   └── {service}.conf      # 서비스별 vhost
└── temp/
```

### CI/CD Workflow 구조

```yaml
name: {Service} CI

on:
  workflow_call:
    inputs:
      source_repository:
        required: true
        type: string
      ref:
        required: true
        type: string
      environment:
        required: true
        type: string
    secrets:
      ACTION_TOKEN:
        required: true
      DOCKERHUB_USERNAME:
        required: true
      DOCKERHUB_TOKEN:
        required: true
      # ... service-specific secrets
```

---

## Environment Management

### 환경 구분

| 환경 | 파일 | 용도 |
|------|------|------|
| dev | `.env.dev` | 개발 환경 |
| stg | `.env.stg` | 스테이징 환경 |
| prod | `.env.prod` | 프로덕션 환경 (별도 관리) |

### 이미지 태그 관리

```bash
# 환경별 태그 변수
CM_LAND_TAG=latest
CM_OFFICE_TAG=v1.2.3
CORE_BACKEND_TAG=stg-abc1234
```

---

## External References

### core-compose

```bash
# docker-compose.yml
gh api repos/semicolon-devteam/core-compose/contents/docker-compose.yml \
  --jq '.content' | base64 -d

# nginx 설정
gh api repos/semicolon-devteam/core-compose/contents/nginx/stg/conf.d \
  --jq '.[].name'
```

### actions-template

```bash
# Dockerfile 목록
gh api repos/semicolon-devteam/actions-template/contents \
  --jq '.[] | select(.name | startswith("Dockerfile")) | .name'

# Workflow 목록
gh api repos/semicolon-devteam/actions-template/contents/.github/workflows \
  --jq '.[].name'
```

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
- [SAX Core - Team Rules](https://github.com/semicolon-devteam/sax-core/blob/main/TEAM_RULES.md)
- [core-compose Repository](https://github.com/semicolon-devteam/core-compose)
- [actions-template Repository](https://github.com/semicolon-devteam/actions-template)
