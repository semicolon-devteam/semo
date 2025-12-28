# Zero-Downtime Deployment

## 배포 전략

### Phase 1: 이미지 Pull

```bash
docker compose --env-file="$ENV_FILE" pull
```

모든 서비스 이미지를 미리 다운로드하여 배포 시간 최소화

### Phase 2: 백엔드 서비스 재시작

```bash
# webserver(nginx) 제외한 서비스 추출
BACKEND_SERVICES=$(docker compose --env-file="$ENV_FILE" config --services | grep -v "^webserver$" | tr '\n' ' ')

# 백엔드만 재시작
docker compose --env-file="$ENV_FILE" up -d --no-deps $BACKEND_SERVICES
```

### Phase 3: 헬스체크 대기

```bash
echo "Waiting for backend services to be ready..."
sleep 5

# 또는 헬스체크 확인
docker compose --env-file="$ENV_FILE" ps --format json | jq '.Health'
```

### Phase 4: Nginx 재시작

```bash
docker compose --env-file="$ENV_FILE" up -d --force-recreate webserver
```

`--force-recreate`: 설정 변경 반영을 위해 강제 재생성

### Phase 5: 최종 확인

```bash
docker compose --env-file="$ENV_FILE" ps
```

---

## 롤백 전략

### 이미지 태그 롤백

```bash
# 1. 이전 태그로 환경변수 변경
sed -i 's/SERVICE_TAG=.*/SERVICE_TAG=v1.2.2/' .env.stg

# 2. 서비스 재시작
docker compose --env-file=.env.stg up -d {service}
```

### 전체 롤백

```bash
# git에서 이전 버전 체크아웃
git checkout HEAD~1 -- .env.stg

# 전체 재배포
docker compose --env-file=.env.stg pull
docker compose --env-file=.env.stg up -d
```

---

## 주의사항

1. **프로덕션 직접 배포 금지** - 항상 stg 먼저
2. **검증 필수** - 배포 전 `docker compose config`
3. **모니터링** - 배포 후 로그 및 헬스체크 확인
4. **롤백 준비** - 이전 이미지 태그 항상 보관
