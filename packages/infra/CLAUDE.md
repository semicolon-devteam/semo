<!-- SEMO Framework -->
> **SEMO** = "Semicolon Orchestrate" - AI 에이전트 오케스트레이션 프레임워크
> (이전 명칭: SEMO - Semicolon AI Transformation)

# SEMO-Infra Package Configuration

> 인프라, CI/CD, DevOps 작업을 위한 SEMO 패키지

## Package Info

- **Package**: SEMO-Infra
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: core-compose, actions-template
- **Audience**: DevOps, 인프라 담당자

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### 1. 세션 초기화

> 📖 상세: [_shared/INIT_SETUP.md](../_shared/INIT_SETUP.md)

### 2. SEMO Core 참조

> 📖 상세: [_shared/SEMO_CORE_REFERENCE.md](../_shared/SEMO_CORE_REFERENCE.md)

### 3. Orchestrator 위임

> 📖 상세: [_shared/ORCHESTRATOR_RULES.md](../_shared/ORCHESTRATOR_RULES.md)

모든 요청 → `agents/orchestrator/orchestrator.md` → Agent/Skill 라우팅

---

## Target Repositories

| 레포지토리 | 역할 | 주요 파일 |
|------------|------|----------|
| **core-compose** | 배포 매니페스트 | `docker-compose.yml`, `nginx/`, `.env.*` |
| **actions-template** | CI/CD 템플릿 | `Dockerfile-*`, `.github/workflows/*.yml` |

---

## 🔴 금지 사항 (NON-NEGOTIABLE)

| 항목 | 사유 | 대안 |
|------|------|------|
| 프로덕션 직접 배포 | 위험 | staging 먼저 |
| 인증정보 커밋 | 보안 | GitHub Secrets |
| `.env` 직접 수정 | 환경 분리 | `.env.{env}` 템플릿 |
| force push (main) | 히스토리 손상 | PR 기반 작업 |

---

## Quality Gates

```bash
# docker-compose 수정 시
docker-compose --env-file .env.stg config

# nginx 수정 시
docker-compose run --rm webserver nginx -t

# workflow 수정 시 (act 사용)
act -n -W .github/workflows/{workflow}.yml
```

---

## Workflow

### 새 서비스 추가

```text
1. actions-template: Dockerfile-{service} 추가
2. actions-template: .github/workflows/ci-{service}.yml 추가
3. core-compose: docker-compose.yml 서비스 추가
4. core-compose: nginx/{env}/conf.d/{service}.conf 추가
5. core-compose: .env.* 템플릿 업데이트
```

### 배포/롤백

```text
배포: skill:verify-compose → skill:verify-nginx → skill:deploy-service
롤백: 이전 이미지 태그 확인 → skill:rollback-service
```

---

## Environment Management

| 환경 | 파일 | 용도 |
|------|------|------|
| dev | `.env.dev` | 개발 환경 |
| stg | `.env.stg` | 스테이징 환경 |
| prod | `.env.prod` | 프로덕션 환경 (별도 관리) |

---

## References

- [SEMO Core - Principles](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core - Message Rules](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- [core-compose Repository](https://github.com/semicolon-devteam/core-compose)
- [actions-template Repository](https://github.com/semicolon-devteam/actions-template)
