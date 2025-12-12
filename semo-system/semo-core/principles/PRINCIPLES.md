# SEMO Core Principles

> **SEMO (Semicolon Orchestrate)**: AI 에이전트 오케스트레이션 프레임워크
>
> 이전 명칭: SAX (Semicolon AI Transformation)

---

## 1. 핵심 원칙

### 1.1 투명성 (Transparency)

모든 AI 에이전트 동작은 사용자에게 **명시적으로 노출**되어야 합니다.

- Agent 활성화 시 SEMO 메시지 출력
- Skill 사용 시 SEMO 메시지 출력
- 외부 참조 시 SEMO 메시지 출력

### 1.2 일관성 (Consistency)

모든 SEMO 패키지는 **동일한 메시지 포맷**을 사용합니다.

```markdown
[SEMO] {Type}: {name} {action}
```

### 1.3 기능 기반 모듈성 (Function-Based Modularity)

> **Gemini 리뷰 반영**: 역할 기반에서 기능 기반으로 전환

SEMO는 **기능/레이어 기반**으로 구성됩니다:

| Layer | 패키지 | 역할 |
|-------|--------|------|
| **Layer 0** | semo-core | 오케스트레이션, 원칙, 테스트 엔진 |
| **Layer 1** | semo-skills | 기능 (coder, tester, planner, writer, deployer) |
| **Layer 2** | semo-integrations | 외부 연동 (github, slack, supabase, infra) |

### 1.4 계층성 (Hierarchy)

```text
semo-core (Layer 0)
    │
    ├── semo-skills (Layer 1)
    │   ├── coder/     - 코드 작성/수정/검증
    │   ├── tester/    - 테스트/QA
    │   ├── planner/   - 기획/관리
    │   ├── writer/    - 문서/디자인
    │   └── deployer/  - 배포/인프라
    │
    └── semo-integrations (Layer 2)
        ├── github/    - GitHub 연동
        ├── slack/     - Slack 연동
        ├── supabase/  - Supabase 연동
        └── infra/     - 내부 인프라 (Doppler, LiteLLM 등)
```

---

## 2. SEMO 메시지 규칙

### 2.1 필수 메시지 타입

| Type | 설명 | 예시 |
|------|------|------|
| `Agent` | 에이전트 활성화 | `[SEMO] Agent: coder 호출` |
| `Skill` | 스킬 사용 | `[SEMO] Skill: implement 사용` |
| `Reference` | 외부 참조 | `[SEMO] Reference: supabase-schema 참조` |
| `Orchestrator` | 라우팅 결정 | `[SEMO] Orchestrator: 의도 분석 완료` |

### 2.2 메시지 포맷

```markdown
[SEMO] {Type}: {name} {action} (사유: {reason})
```

**필수 요소**:
- `[SEMO]` 접두사
- `Type`: Agent, Skill, Reference, Orchestrator 중 하나
- `name`: 에이전트/스킬/참조 대상 이름
- `action`: 동작 (호출, 사용, 참조, 위임 등)

**선택 요소**:
- `(사유: {reason})`: 왜 이 동작을 하는지 설명

### 2.3 메시지 출력 규칙

1. **각 SEMO 메시지는 별도의 줄에 출력**
2. **SEMO 메시지들 사이에 빈 줄 삽입**
3. **SEMO 메시지 출력 후 일반 텍스트 시작 전에도 빈 줄 필수**

**예시**:
```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현 요청

[SEMO] Skill: implement 호출 (platform: nextjs)

## 구현을 시작합니다

...
```

---

## 3. Orchestrator 원칙

### 3.0 Orchestrator-First Policy (필수)

> ⚠️ **핵심 규칙**: SEMO가 설치된 환경에서는 **모든 요청이 Orchestrator를 먼저 거쳐야 합니다.**

**동작 방식**:

1. **모든 사용자 요청** → Orchestrator가 먼저 의도 분석
2. **SEMO 메시지 출력**: `[SEMO] Orchestrator: 의도 분석 완료 → {category}`
3. **라우팅 결정**: 적절한 Skill/Agent 위임 또는 직접 응답

**플랫폼 자동 감지**:

Orchestrator는 `detect-context.sh`를 사용하여 플랫폼을 자동 감지합니다:

```bash
platform=$(semo-core/shared/detect-context.sh .)
# 결과: nextjs | spring | microservice | mvp
```

**예외 사항** (Orchestrator 생략 가능):

- 단순 질문: "이게 뭐야?", "설명해줘"
- 일반 대화: 인사, 감사 표현
- 명시적 직접 요청: "Orchestrator 없이 바로 해줘"

### 3.1 Routing-Only Policy

Orchestrator는 **라우팅만 담당**합니다.

**허용**:
- 의도 분석
- 적절한 Skill 선택
- 플랫폼 감지 및 분기

**금지**:
- 직접 코드 작성
- 직접 파일 생성
- 직접 명세 작성

### 3.2 라우팅 테이블

```
semo-core/agents/orchestrator/routing-tables/
├── coder.md      # 코딩 관련 라우팅
├── tester.md     # 테스트 관련 라우팅
├── planner.md    # 기획 관련 라우팅
└── deployer.md   # 배포 관련 라우팅
```

---

## 4. Skills 원칙

### 4.1 기능 기반 분류

| 카테고리 | 위치 | 스킬 예시 |
|----------|------|----------|
| coder | semo-skills/coder/ | implement, scaffold, review, verify |
| tester | semo-skills/tester/ | execute, report, validate |
| planner | semo-skills/planner/ | epic, task, sprint, roadmap |
| writer | semo-skills/writer/ | spec, docx, handoff |
| deployer | semo-skills/deployer/ | deploy, rollback, compose |

### 4.2 플랫폼 분기 패턴

동일 기능이 여러 플랫폼을 지원할 때:

```
semo-skills/coder/implement/
├── SKILL.md           # 공통 인터페이스
├── platforms/
│   ├── nextjs.md      # Next.js 특화 로직
│   ├── spring.md      # Spring 특화 로직
│   └── mvp.md         # MVP 특화 로직
└── references/
```

### 4.3 SEMO 규칙 준수

모든 Skill은 다음을 준수합니다:

1. 실행 시 SEMO 메시지 출력
2. 다른 Skill 호출 시 SEMO 메시지 출력
3. Reference 참조 시 SEMO 메시지 출력

---

## 5. Integrations 원칙

### 5.1 외부 시스템 연동

| Integration | 위치 | 용도 |
|-------------|------|------|
| github | semo-integrations/github/ | Issues, PR, Actions |
| slack | semo-integrations/slack/ | 알림, 피드백 |
| supabase | semo-integrations/supabase/ | 쿼리, 동기화 |

### 5.2 내부 인프라 (Reserved)

| Integration | 상태 | 활성화 조건 |
|-------------|------|-------------|
| litellm | Reserved | MCP 서버 직접 LLM 호출 시 |
| langfuse | Reserved | LiteLLM과 동일 |
| doppler | Active | 시크릿 관리 |

---

## 6. 하위 호환성

### 6.1 레거시 접두사 지원

| 레거시 | 새 라우팅 | 플랫폼 |
|--------|----------|--------|
| `[next]` | semo-skills/coder | nextjs |
| `[backend]` | semo-skills/coder | spring |
| `[po]` | semo-skills/planner | - |
| `[qa]` | semo-skills/tester | - |

> **Deprecation 예정**: 6개월 후 레거시 접두사 제거

### 6.2 메시지 호환성

| 레거시 | 새 포맷 |
|--------|---------|
| `[SEMO] Agent:` | `[SEMO] Agent:` |
| `[SEMO] Skill:` | `[SEMO] Skill:` |

---

## 7. Context Mesh

### 7.1 세션 간 컨텍스트 영속화

`.claude/memory/` 디렉토리에 컨텍스트 저장:

```
.claude/memory/
├── context.md       # 프로젝트 기본 정보
├── decisions.md     # 아키텍처 결정 기록
└── rules/           # 프로젝트별 규칙
```

### 7.2 세션 시작 시 동작

1. `.claude/memory/context.md` 참조
2. 현재 작업 상태 복원
3. 프로젝트별 규칙 적용

---

## 8. 버전 관리

### 8.1 시맨틱 버저닝

- **Major**: 호환되지 않는 변경
- **Minor**: 하위 호환되는 기능 추가
- **Patch**: 버그 수정

### 8.2 버저닝 필수 상황

| 변경 유형 | 버전 | 설명 |
|----------|------|------|
| Skill 추가/수정/삭제 | MINOR | 기능 변경 |
| 버그 수정 | PATCH | 수정만 |
| Breaking Change | MAJOR | 호환성 깨짐 |

---

## 9. 참조

- **SEMO Message Rules**: [MESSAGE_RULES.md](./MESSAGE_RULES.md)
- **Context Mesh**: [../.claude/memory/](../../.claude/memory/)
- **Architecture Decisions**: [../.claude/memory/decisions.md](../../.claude/memory/decisions.md)

---

*이 문서는 SEMO Core Principles를 SEMO 구조에 맞게 업데이트했습니다.*
*원본: SEMO Core v1.0 → SEMO Core v2.0*
