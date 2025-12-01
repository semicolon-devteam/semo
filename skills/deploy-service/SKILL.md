# deploy-service

> 서비스 배포 실행 Skill

## 개요

Docker Compose 기반 서비스를 배포합니다.

## 트리거

- "배포해줘"
- "서비스 올려줘"
- `/SAX:deploy`

## 입력 파라미터

| 파라미터 | 필수 | 설명 | 예시 |
|----------|------|------|------|
| environment | ✅ | 배포 환경 | `dev`, `stg` |
| service | ❌ | 특정 서비스 (기본: 전체) | `cm-land` |

## 🔴 사전 조건 (NON-NEGOTIABLE)

1. **검증 완료**: `verify-compose`, `verify-nginx` 통과
2. **staging 먼저**: prod 배포 전 stg 검증 필수
3. **태그 확인**: 배포할 이미지 태그 확인

## 실행 절차

### 1. 사전 검증

```bash
# compose 검증
docker-compose --env-file .env.{env} config

# nginx 검증
docker-compose run --rm webserver nginx -t
```

### 2. 이미지 Pull

```bash
docker-compose --env-file .env.{env} pull {service}
```

### 3. 서비스 재시작

```bash
# 특정 서비스
docker-compose --env-file .env.{env} up -d --no-deps {service}

# 전체 (Zero-downtime)
BACKEND_SERVICES=$(docker-compose --env-file .env.{env} config --services | grep -v "^webserver$" | tr '\n' ' ')
docker-compose --env-file .env.{env} up -d --no-deps $BACKEND_SERVICES
sleep 5
docker-compose --env-file .env.{env} up -d --force-recreate webserver
```

### 4. 상태 확인

```bash
docker-compose --env-file .env.{env} ps
```

### 5. 헬스체크

```bash
curl -f http://localhost:{port}/health
```

## 출력

### 성공

```markdown
[SAX] deploy-service: 배포 완료 ✅

**배포 결과**

환경: `{environment}`
서비스: `{service}` (또는 전체)

### 상태
| 서비스 | 상태 | 헬스 |
|--------|------|------|
| cm-land | running | healthy |
| land-backend | running | healthy |

배포 시간: {timestamp}
```

### 실패

```markdown
[SAX] deploy-service: 배포 실패 ❌

**배포 결과**

환경: `{environment}`

### 오류
```
{error_message}
```

### 롤백 권장
`skill:rollback-service`로 이전 버전 복원
```

## 배포 전략

### Zero-Downtime 배포

```text
1. 이미지 Pull (모든 서비스)
2. Backend 서비스 재시작 (nginx 제외)
3. 헬스체크 대기 (5초)
4. Nginx 재시작 (force-recreate)
5. 최종 상태 확인
```

### 롤링 배포 (수동)

```text
1. 서비스 A 중지 → 업데이트 → 시작
2. 헬스체크 확인
3. 서비스 B 중지 → 업데이트 → 시작
4. 반복
```

## 금지 사항

- 프로덕션 직접 배포 (stg 검증 필수)
- 검증 없는 배포
- 롤백 계획 없는 배포

## 참조

- [deploy-master agent](../../agents/deploy-master/deploy-master.md)
- [zero-downtime-deploy.md](../../agents/deploy-master/references/zero-downtime-deploy.md)
