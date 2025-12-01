# sax-help

> SAX-Infra 도움말 Skill

## 개요

SAX-Infra 패키지 사용법을 안내합니다.

## 트리거

- "도움말"
- "사용법"
- `/SAX:help`

## 출력

```markdown
# SAX-Infra 도움말

## 📦 패키지 정보

- **Package**: SAX-Infra
- **Version**: {version}
- **대상**: core-compose, actions-template

---

## 🤖 Agents

| Agent | 역할 |
|-------|------|
| `orchestrator` | 요청 라우팅 |
| `deploy-master` | 배포 전략 및 Docker Compose |
| `ci-architect` | CI/CD 파이프라인 설계 |
| `nginx-advisor` | Nginx 설정 최적화 |
| `monitoring-guide` | 모니터링 및 로깅 |

---

## 🛠️ Skills

| Skill | 역할 | 트리거 예시 |
|-------|------|------------|
| `scaffold-workflow` | 워크플로우 생성 | "CI 만들어줘" |
| `scaffold-compose` | compose 서비스 추가 | "서비스 추가해줘" |
| `scaffold-nginx` | nginx 설정 생성 | "nginx 설정 추가" |
| `verify-compose` | compose 검증 | "compose 확인" |
| `verify-nginx` | nginx 검증 | "nginx 검증" |
| `deploy-service` | 배포 실행 | "배포해줘" |
| `rollback-service` | 롤백 실행 | "롤백해줘" |
| `sync-env` | 환경변수 검증 | "env 체크" |

---

## 📋 Commands

| Command | 역할 |
|---------|------|
| `/SAX:deploy` | 서비스 배포 |
| `/SAX:rollback` | 서비스 롤백 |
| `/SAX:env-check` | 환경변수 검증 |

---

## 🚀 Quick Start

### 새 서비스 추가
```
"ms-notification 서비스 추가해줘"
→ scaffold-compose → scaffold-nginx → verify
```

### CI/CD 설정
```
"cm-new용 CI 워크플로우 만들어줘"
→ scaffold-workflow
```

### 배포
```
"stg에 배포해줘"
→ verify → deploy-service
```

### 롤백
```
"cm-land v1.2.2로 롤백해줘"
→ rollback-service
```

---

## 📚 참조

- [CLAUDE.md](../../CLAUDE.md) - 패키지 규칙
- [orchestrator](../../agents/orchestrator/orchestrator.md) - 라우팅 규칙
```

## 참조

- [CLAUDE.md](../../CLAUDE.md)
