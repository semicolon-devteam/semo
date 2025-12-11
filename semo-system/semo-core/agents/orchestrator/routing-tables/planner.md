# Routing Table: Planner

> 기획/관리 관련 요청 라우팅 규칙

---

## 트리거 키워드

| 키워드 | 스킬 | 비고 |
|--------|------|------|
| Epic, 에픽 | epic | |
| Task, 태스크, 분해 | task | |
| 스프린트, Sprint | sprint | |
| 로드맵, Roadmap | roadmap | |
| 기획, 계획 | epic/task | 문맥에 따라 |

---

## 레거시 접두사 매핑

| 접두사 | 라우팅 |
|--------|--------|
| `[po]` | planner |
| `[pm]` | planner |

---

## 예시

### Epic 생성

```
입력: "댓글 기능 Epic 만들어줘"
출력: [SEMO] Skill 위임: planner/epic
```

### Task 분해

```
입력: "이 Epic Task로 나눠줘"
출력: [SEMO] Skill 위임: planner/task
```

### 스프린트 계획

```
입력: "다음 스프린트 계획해줘"
출력: [SEMO] Skill 위임: planner/sprint
```
