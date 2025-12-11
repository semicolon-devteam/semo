# Routing Rules

## 우선순위 규칙

1. **명시적 Skill 요청** → 해당 Skill 직접 호출
2. **생성/수정 요청** → scaffold-* Skill
3. **검증 요청** → verify-* Skill
4. **실행 요청** → deploy/rollback Skill
5. **설계/검토 요청** → 전문 Agent
6. **질문/조언 요청** → 전문 Agent

---

## Agent 라우팅 상세

### deploy-master

**트리거**:
- "서비스 추가", "compose 설계", "배포 전략"
- "멀티 서비스", "오케스트레이션"
- docker-compose 구조 설계 관련

**위임하지 않는 경우**:
- 단순 compose 수정 → `scaffold-compose`
- 단순 배포 실행 → `deploy-service`

### ci-architect

**트리거**:
- "CI 설계", "파이프라인 구조", "워크플로우 아키텍처"
- "빌드 최적화", "Dockerfile 설계"
- 복잡한 CI/CD 요구사항

**위임하지 않는 경우**:
- 단순 워크플로우 생성 → `scaffold-workflow`

### nginx-advisor

**트리거**:
- "nginx 최적화", "로드밸런싱", "캐싱 전략"
- "보안 설정", "rate limiting"
- 복잡한 라우팅 요구사항

**위임하지 않는 경우**:
- 단순 vhost 추가 → `scaffold-nginx`
- 설정 검증만 → `verify-nginx`

### monitoring-guide

**트리거**:
- "모니터링 설정", "알림 구성"
- "로그 수집", "메트릭 설계"
- "헬스체크 전략"

---

## Skill 라우팅 상세

### scaffold-workflow

**트리거**:
- "워크플로우 만들어", "CI 생성"
- "GitHub Actions 추가"

**입력 필요**:
- 서비스 유형 (Next.js, Spring Boot, Go 등)
- 환경 (dev, stg, prod)

### scaffold-compose

**트리거**:
- "compose에 추가", "서비스 정의"
- "docker-compose 수정"

**입력 필요**:
- 서비스명
- 이미지 정보
- 네트워크/볼륨 요구사항

### scaffold-nginx

**트리거**:
- "nginx 설정 추가", "upstream 생성"
- "vhost 만들어"

**입력 필요**:
- 서비스명
- 포트
- 도메인 (선택)

### verify-compose

**트리거**:
- "compose 검증", "config 확인"
- 자동: compose 수정 후

### verify-nginx

**트리거**:
- "nginx 검증", "설정 테스트"
- 자동: nginx 설정 수정 후

### deploy-service

**트리거**:
- "배포해줘", "서비스 올려"
- "/SAX:deploy"

**입력 필요**:
- 환경 (dev, stg)
- 서비스명 (선택, 전체 배포 가능)

### rollback-service

**트리거**:
- "롤백해줘", "되돌려"
- "/SAX:rollback"

**입력 필요**:
- 환경
- 서비스명
- 대상 버전/태그

### sync-env

**트리거**:
- "환경변수 확인", "env 동기화"
- "시크릿 체크"

---

## 복합 요청 처리

여러 작업이 필요한 경우 순차적으로 위임:

```text
"새 서비스 추가하고 배포까지 해줘"
↓
1. scaffold-compose → 서비스 정의
2. scaffold-nginx → nginx 설정
3. verify-compose → 검증
4. verify-nginx → 검증
5. deploy-service → 배포
```
