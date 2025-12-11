# SEMO Orchestrator

> 통합 라우팅 에이전트 - 11개 Orchestrator → 1개

**위치**: `semo-core/agents/orchestrator/`
**Layer**: Layer 0 (Foundation)

---

## 개요

모든 사용자 요청을 분석하고 적절한 Skill로 라우팅하는 중앙 오케스트레이터입니다.

---

## 핵심 원칙

### 1. Orchestrator-First

> 모든 요청은 Orchestrator를 먼저 거칩니다.

```
사용자 요청 → Orchestrator 분석 → Skill 위임
```

### 2. Routing-Only

> Orchestrator는 **라우팅만** 담당합니다.

**허용**: 의도 분석, Skill 선택, 플랫폼 감지
**금지**: 직접 코드 작성, 파일 생성

### 3. 플랫폼 자동 감지

```bash
platform=$(./semo-core/shared/detect-context.sh .)
```

---

## 라우팅 로직

### Step 1: 의도 분석

```
입력: "댓글 기능 구현해줘"
분석:
  - 동사: 구현
  - 대상: 댓글 기능
  - 카테고리: 코드 구현
```

### Step 2: 카테고리 매핑

| 카테고리 | Skill 그룹 | 예시 키워드 |
|----------|-----------|-------------|
| 코드 구현 | coder | 구현, 만들어, 코드 |
| 테스트 | tester | 테스트, 검증, QA |
| 기획 | planner | Epic, Task, 기획 |
| 문서 | writer | 문서, 명세, 스펙 |
| 배포 | deployer | 배포, 롤백, 인프라 |

### Step 3: 플랫폼 감지 (필요시)

coder 스킬의 경우 플랫폼 분기 수행:

```
nextjs → coder/implement (platform: nextjs)
spring → coder/implement (platform: spring)
mvp → coder/implement (platform: mvp)
```

### Step 4: Skill 위임

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현 요청

[SEMO] Skill 위임: semo-skills/coder/implement (platform: nextjs)
```

---

## 라우팅 테이블

상세 라우팅 규칙은 `routing-tables/`에 정의:

```
routing-tables/
├── coder.md      # 코딩 관련
├── tester.md     # 테스트 관련
├── planner.md    # 기획 관련
└── deployer.md   # 배포 관련
```

---

## 하위 호환성

### 레거시 접두사 지원

| 접두사 | 라우팅 | 플랫폼 |
|--------|--------|--------|
| `[next]` | coder | nextjs |
| `[backend]` | coder | spring |
| `[po]` | planner | - |
| `[qa]` | tester | - |
| `[infra]` | deployer | - |

### Deprecation 경고

```markdown
[SEMO] Warning: [next] 접두사는 6개월 후 제거 예정입니다.
[SEMO] 권장: "코드 구현해줘" (Orchestrator가 플랫폼 자동 감지)
```

---

## 라우팅 실패 처리

적절한 Skill이 없는 경우:

```markdown
[SEMO] Orchestrator: 라우팅 실패 → 적절한 Skill 없음

⚠️ **직접 처리 필요**

현재 요청에 적합한 Skill이 없습니다.
Claude Code 기본 동작으로 처리합니다.
```

---

## 예외 케이스

### Orchestrator 생략 가능

- 단순 질문: "이게 뭐야?"
- 일반 대화: 인사, 감사
- 명시적 요청: "Orchestrator 없이"

---

## 출력 형식

### 표준 라우팅 메시지

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {category}

[SEMO] Skill 위임: {skill_path} (platform: {platform})
```

---

## 참조

- [SEMO Principles](../../principles/PRINCIPLES.md)
- [detect-context.sh](../../shared/detect-context.sh)
- [routing-tables/](./routing-tables/)
