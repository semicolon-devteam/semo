# Routing Table: Deployer

> 배포/인프라 관련 요청 라우팅 규칙

---

## 트리거 키워드

| 키워드 | 스킬 | 비고 |
|--------|------|------|
| 배포, Deploy | deploy | |
| 롤백, Rollback | rollback | |
| Docker, 컴포즈 | compose | |
| 인프라, 서버 | deploy | 문맥에 따라 |

---

## 레거시 접두사 매핑

| 접두사 | 라우팅 |
|--------|--------|
| `[infra]` | deployer |

---

## 예시

### 배포

```
입력: "프로덕션 배포해줘"
출력: [SEMO] Skill 위임: deployer/deploy
```

### 롤백

```
입력: "이전 버전으로 롤백해줘"
출력: [SEMO] Skill 위임: deployer/rollback
```

### Docker 설정

```
입력: "Docker Compose 설정해줘"
출력: [SEMO] Skill 위임: deployer/compose
```
