# Routing Examples

## Agent 위임 예시

### deploy-master

```
User: "마이크로서비스 아키텍처로 compose 재설계해줘"

[SEMO] Orchestrator: 의도 분석 완료 → deployment

[SEMO] Agent 위임: deploy-master (사유: 복잡한 compose 아키텍처 설계 필요)
```

### ci-architect

```
User: "모노레포용 CI 파이프라인 설계해줘"

[SEMO] Orchestrator: 의도 분석 완료 → ci-cd

[SEMO] Agent 위임: ci-architect (사유: 복잡한 CI 아키텍처 설계 필요)
```

### nginx-advisor

```
User: "nginx에서 rate limiting 최적화 방법 알려줘"

[SEMO] Orchestrator: 의도 분석 완료 → nginx

[SEMO] Agent 위임: nginx-advisor (사유: nginx 성능 최적화 조언 필요)
```

### monitoring-guide

```
User: "서비스 헬스체크 전략 어떻게 잡아야 해?"

[SEMO] Orchestrator: 의도 분석 완료 → monitoring

[SEMO] Agent 위임: monitoring-guide (사유: 모니터링 전략 설계 필요)
```

---

## Skill 호출 예시

### scaffold-workflow

```
User: "cm-land용 CI 워크플로우 만들어줘"

[SEMO] Orchestrator: 의도 분석 완료 → ci-cd

[SEMO] Skill 호출: scaffold-workflow (사유: Next.js CI 워크플로우 생성)
```

### scaffold-compose

```
User: "ms-notification 서비스 compose에 추가해줘"

[SEMO] Orchestrator: 의도 분석 완료 → deployment

[SEMO] Skill 호출: scaffold-compose (사유: 새 서비스 정의 추가)
```

### scaffold-nginx

```
User: "ms-notification용 nginx upstream 추가해줘"

[SEMO] Orchestrator: 의도 분석 완료 → nginx

[SEMO] Skill 호출: scaffold-nginx (사유: nginx upstream/vhost 생성)
```

### verify-compose

```
User: "compose 설정 검증해줘"

[SEMO] Orchestrator: 의도 분석 완료 → verification

[SEMO] Skill 호출: verify-compose (사유: docker-compose 문법 검증)
```

### deploy-service

```
User: "stg 환경에 배포해줘"

[SEMO] Orchestrator: 의도 분석 완료 → deployment

[SEMO] Skill 호출: deploy-service (사유: 스테이징 환경 배포 실행)
```

### rollback-service

```
User: "cm-land 이전 버전으로 롤백해줘"

[SEMO] Orchestrator: 의도 분석 완료 → deployment

[SEMO] Skill 호출: rollback-service (사유: 서비스 롤백 실행)
```

---

## 복합 요청 예시

### 새 서비스 전체 셋업

```
User: "ms-notification 서비스 전체 셋업해줘 (compose, nginx, CI)"

[SEMO] Orchestrator: 의도 분석 완료 → deployment (복합)

[SEMO] 순차 실행 계획:
1. scaffold-compose → 서비스 정의
2. scaffold-nginx → nginx 설정
3. scaffold-workflow → CI 워크플로우
4. verify-compose → 검증
5. verify-nginx → 검증

[SEMO] Skill 호출: scaffold-compose (1/5)
```

### 배포 + 검증

```
User: "검증하고 배포해줘"

[SEMO] Orchestrator: 의도 분석 완료 → deployment (복합)

[SEMO] 순차 실행 계획:
1. verify-compose → 문법 검증
2. verify-nginx → 설정 검증
3. deploy-service → 배포

[SEMO] Skill 호출: verify-compose (1/3)
```
