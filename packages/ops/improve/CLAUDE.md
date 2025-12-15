# SEMO Operations - Improve Package

> 개선안 도출, 기술 부채 관리, 최적화

## Package Info

- **Package**: ops/improve
- **Version**: [../VERSION](../VERSION) 참조
- **Audience**: 개발팀, PO, 아키텍트

---

## 핵심 역할

| 기능 | 설명 |
|------|------|
| 개선안 도출 | 서비스 개선 아이디어 제안 |
| 기술 부채 | 기술 부채 식별 및 관리 |
| 리팩토링 | 리팩토링 계획 수립 |
| 성능 최적화 | 성능 병목 분석 및 개선 |
| 아키텍처 개선 | 아키텍처 진화 제안 |

---

## Routing Keywords

| 키워드 | 트리거 |
|--------|--------|
| 개선, improve | 개선안 도출 |
| 기술부채, tech debt | 기술 부채 관리 |
| 리팩토링, refactor | 리팩토링 제안 |
| 최적화, optimize | 성능 최적화 |
| 아키텍처, architecture | 아키텍처 개선 |
| 성능, performance | 성능 분석 |

---

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | improve 작업 라우팅 |
| improvement-advisor | 개선 제안 에이전트 |

---

## Skills

| Skill | 역할 |
|-------|------|
| analyze-tech-debt | 기술 부채 분석 |
| suggest-refactoring | 리팩토링 제안 |
| analyze-performance | 성능 분석 |
| suggest-optimization | 최적화 제안 |
| create-improvement-issue | 개선 이슈 생성 |
| prioritize-improvements | 개선 우선순위 결정 |
| health-check | 환경 검증 |

---

## 개선 프로세스

### 1. 문제 식별
```text
ops/monitor (운영 이슈)
    ↓
ops/improve (분석)
    ↓
개선 영역 식별
```

### 2. 개선안 작성
```text
기술 부채 분석 → 우선순위 결정 → 개선 이슈 생성
```

### 3. 실행 연계
```text
ops/improve (개선 이슈)
    ↓
biz/discovery (Epic/Task)
    ↓
eng/platforms/* (구현)
```

---

## 기술 부채 분류

| 유형 | 설명 | 우선순위 기준 |
|------|------|-------------|
| 보안 | 보안 취약점 | 최우선 |
| 성능 | 성능 병목 | 사용자 영향도 |
| 유지보수 | 코드 복잡도 | 변경 빈도 |
| 확장성 | 확장 한계 | 비즈니스 계획 |

---

## 개선 이슈 템플릿

```markdown
## 개선 제안: {제목}

### 현재 상황
- 문제점: ...
- 영향 범위: ...

### 제안 내용
- 개선 방안: ...
- 예상 효과: ...

### 우선순위
- 긴급도: High / Medium / Low
- 중요도: High / Medium / Low

### 예상 작업량
- 예상 소요: ...
- 필요 리소스: ...

### 관련 코드
- 파일: ...
- 라인: ...
```

---

## References

- [ops 레이어](../CLAUDE.md)
- [qa 패키지](../qa/CLAUDE.md)
- [monitor 패키지](../monitor/CLAUDE.md)
- [biz/discovery](../../biz/discovery/CLAUDE.md)
