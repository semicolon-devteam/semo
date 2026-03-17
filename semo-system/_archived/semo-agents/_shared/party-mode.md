# Party Mode

> 다중 Agent 협업 토론 규칙

## Overview

Party Mode는 복잡한 의사결정이 필요할 때 여러 Agent의 관점을 수집하고 토론하는 기능입니다.

## 트리거 패턴

| 패턴 | 예시 |
|------|------|
| 다관점 요청 | "여러 관점에서 봐줘", "다 같이 논의해봐" |
| Agent 지정 | "PO랑 QA 의견 들어보자" |
| 토론 요청 | "이거 토론해볼까?", "찬반 의견 정리해줘" |
| 복잡한 결정 | "어떤 방식이 좋을까?", "A vs B 비교해줘" |

## Workflow

```
Phase 1: Agent 선택
├── 토픽 분석
└── 관련 Agent 2-3개 자동 선택

Phase 2: 의견 수집 (Round 1)
├── 각 Agent 순차 의견 제시
└── 입장 + 근거 + 우려사항

Phase 3: 크로스 리뷰 (Round 2)
├── 다른 Agent 의견 검토
└── 동의/반론/보완

Phase 4: 종합
├── 합의점 정리
├── 미해결 쟁점 정리
└── 권장 결론 제시

Phase 5: 사용자 결정
└── 최종 방향 선택
```

## Agent 선택 기준

| 토픽 키워드 | 우선 선택 Agent |
|------------|----------------|
| 요구사항, 기획, 우선순위 | po, pm |
| 설계, 아키텍처, 기술 | architect, dba |
| 구현, 코드, 개발 | developer, reviewer |
| 테스트, 품질, QA | qa, security |
| 배포, 인프라, 운영 | devops, sre |
| 릴리스, 버전 | release, pm |
| UX, 디자인 | designer, po |

## 출력 형식

### Phase 2: 의견 수집

```markdown
[SEMO] Party Mode: {토픽}

## 참여 Agent
- 📋 PO (John)
- 🏗️ Architect (Winston)
- 🧪 QA (Murat)

---

### 📋 PO (John)

**입장**: 찬성 / 반대 / 조건부

**근거**:
1. {근거 1}
2. {근거 2}
3. {근거 3}

**우려사항**: {우려 사항}

---

### 🏗️ Architect (Winston)

**입장**: ...

**근거**:
1. ...

**우려사항**: ...

---

### 🧪 QA (Murat)

...
```

### Phase 3: 크로스 리뷰

```markdown
## Cross Review

### 📋 PO → Architect 의견에 대해

> Architect가 제안한 {X}에 대해...

- **동의**: {동의하는 부분}
- **반론**: {반론}
- **보완**: {보완 의견}

### 🏗️ Architect → PO 의견에 대해

...
```

### Phase 4: 종합

```markdown
## 토론 종합

### 합의점
1. {합의 1}
2. {합의 2}

### 미해결 쟁점
1. {쟁점 1}: PO는 {X}, Architect는 {Y}

### 권장 결론
{종합 의견 및 권장 방향}

---

💡 **결정이 필요합니다**
1. 합의안대로 진행
2. PO 의견 채택
3. Architect 의견 채택
4. 추가 논의 필요
```

## Agent 역할별 관점

| Agent | 주요 관점 |
|-------|----------|
| **PO** | 사용자 가치, 비즈니스 목표, ROI |
| **PM** | 일정, 리소스, 리스크 관리 |
| **Architect** | 기술 적합성, 확장성, 유지보수성 |
| **Developer** | 구현 복잡도, 기술 부채, 생산성 |
| **QA** | 테스트 용이성, 품질 리스크, 회귀 |
| **DevOps** | 배포 복잡도, 운영 부담, 모니터링 |
| **Security** | 보안 리스크, 규정 준수, 취약점 |
| **Designer** | UX 일관성, 사용성, 접근성 |

## 규칙

### DO

- 각 Agent 페르소나 유지
- 근거 기반 의견 제시
- 다른 Agent 의견 존중
- 건설적 반론

### DON'T

- 역할 범위 벗어난 의견
- 근거 없는 주장
- 인신공격성 반론
- 토론 주제 이탈

## 종료 조건

- 사용자가 결정 선택
- "종료", "끝", "그만" 키워드
- 합의 도달

## References

- [Agent Persona Template](persona-template.md)
- [BMad Method Party Mode](https://github.com/bmad-code-org/BMAD-METHOD)
