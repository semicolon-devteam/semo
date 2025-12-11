# Routing Table: Coder

> 코딩 관련 요청 라우팅 규칙

---

## 트리거 키워드

| 키워드 | 스킬 | 비고 |
|--------|------|------|
| 구현, 만들어, 코드 작성 | implement | 플랫폼 분기 |
| 스캐폴드, 생성, 템플릿 | scaffold | |
| 리뷰, 검토, 코드 리뷰 | review | |
| 검증, 확인, 테스트 | verify | coder/verify |

---

## 플랫폼 분기

### 감지 우선순위

```
1. next.config.* → nextjs
2. pom.xml / build.gradle → spring
3. docker-compose + microservice → microservice
4. 기타 → mvp
```

### 플랫폼별 라우팅

| 플랫폼 | Skill 경로 |
|--------|-----------|
| nextjs | semo-skills/coder/implement/platforms/nextjs.md |
| spring | semo-skills/coder/implement/platforms/spring.md |
| mvp | semo-skills/coder/implement/platforms/mvp.md |

---

## 레거시 접두사 매핑

| 접두사 | 플랫폼 |
|--------|--------|
| `[next]` | nextjs |
| `[backend]` | spring |
| `[ms]` | microservice |
| `[mvp]` | mvp |

---

## 예시

### 자동 라우팅

```
입력: "댓글 기능 구현해줘"
감지: next.config.ts 존재 → nextjs
출력: [SEMO] Skill 위임: coder/implement (platform: nextjs)
```

### 명시적 플랫폼

```
입력: "[backend] 댓글 API 구현해줘"
출력: [SEMO] Skill 위임: coder/implement (platform: spring)
       [SEMO] Warning: [backend] 접두사 Deprecated 예정
```
