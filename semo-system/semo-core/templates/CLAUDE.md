# SEMO Project Configuration

> SEMO (Semicolon Orchestrate) - AI Agent Orchestration Framework v{{VERSION}}

---

## Orchestrator-First Policy (필수)

> **이 섹션은 SEMO의 핵심 규칙입니다. 모든 요청 처리 전 반드시 준수하세요.**

### 모든 사용자 메시지 처리 흐름

```
사용자 메시지 수신
    ↓
┌─────────────────────────────────────────────────────┐
│ Step 1: Orchestrator 의도 분석                       │
│   - 요청 카테고리 판단 (코드/테스트/기획/문서/배포)      │
│   - 플랫폼 자동 감지 (nextjs/spring/mvp)             │
│   - 출력: [SEMO] Orchestrator: 의도 분석 완료 → {분류} │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ Step 2: 라우팅 결정                                  │
│   - Skill 위임: 적절한 스킬로 위임                     │
│   - Agent 호출: 복잡한 작업은 에이전트로 위임           │
│   - 직접 처리: 단순 질문/일반 대화만 해당               │
│   - 출력: [SEMO] Skill 위임: {skill} (platform: X)   │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ Step 3: 실행                                        │
│   - 스킬/에이전트 SKILL.md 또는 AGENT.md 참조         │
│   - 출력: [SEMO] Skill: {name} 사용                  │
└─────────────────────────────────────────────────────┘
```

### 카테고리별 라우팅 테이블

| 사용자 의도 | 카테고리 | 라우팅 대상 | 키워드 예시 |
|------------|----------|------------|-------------|
| 코드 작성/수정 | coder | `semo-skills/coder/` | 구현, 만들어, 코드, 수정, 추가 |
| 테스트/검증 | tester | `semo-skills/tester/` | 테스트, 검증, QA, 버그 |
| 기획/관리 | planner | `semo-skills/planner/` | Epic, Task, 기획, 로드맵 |
| 문서 작성 | writer | `semo-skills/writer/` | 문서, 명세, 스펙, README |
| 배포/인프라 | deployer | `semo-skills/deployer/` | 배포, 롤백, 인프라, docker |
| 메모리 관리 | memory | `semo-skills/memory/` | 저장, 기억, 컨텍스트 |
| Slack 알림 | notify-slack | `semo-skills/notify-slack/` | 슬랙, 알림, 공유 |
| 피드백 수집 | feedback | `semo-skills/feedback/` | 피드백, 버그 리포트 |

### 예외 상황 (Orchestrator 생략 가능)

- 단순 질문: "이게 뭐야?", "설명해줘"
- 일반 대화: 인사, 감사 표현
- 명시적 직접 요청: "Orchestrator 없이 바로 해줘"

### SEMO 메시지 출력 규칙

모든 동작에는 반드시 SEMO 메시지를 출력해야 합니다:

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현 요청

[SEMO] Skill 위임: semo-skills/coder/implement (platform: nextjs)

[SEMO] Skill: implement 사용

## 구현을 시작합니다
...
```

**규칙**:
1. 각 SEMO 메시지는 별도 줄에 출력
2. SEMO 메시지 사이에 빈 줄 삽입
3. 본문 시작 전 빈 줄 필수

---

## 설치된 구성

### Standard (필수)
- **semo-core**: 원칙, 오케스트레이터, 공통 커맨드
- **semo-skills**: 통합 스킬
  - 행동: coder, tester, planner, deployer, writer
  - 운영: memory, notify-slack, feedback, version-updater, semo-help, semo-architecture-checker, circuit-breaker, list-bugs

{{#EXTENSIONS}}
### Extensions (선택)
{{EXTENSIONS_LIST}}
{{/EXTENSIONS}}

## 구조

```
.claude/
├── settings.json      # MCP 서버 설정 (Black Box)
├── memory/            # Context Mesh (장기 기억)
│   ├── context.md     # 프로젝트 상태
│   ├── decisions.md   # 아키텍처 결정
│   └── rules/         # 프로젝트별 규칙
├── agents → semo-system/semo-core/agents
├── skills → semo-system/semo-skills
└── commands/SEMO → semo-system/semo-core/commands/SEMO

semo-system/           # White Box (읽기 전용)
├── semo-core/         # Layer 0: 원칙, 오케스트레이션
├── semo-skills/       # Layer 1: 통합 스킬
{{#EXTENSIONS}}
├── {{EXTENSION_NAME}}/  # Extension
{{/EXTENSIONS}}
```

## 사용 가능한 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:slack` | Slack 메시지 전송 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:health` | 환경 검증 |
| `/SEMO:update` | SEMO 업데이트 |
| `/SEMO:onboarding` | 신규 개발자 온보딩 |

## Context Mesh 사용

SEMO는 `.claude/memory/`를 통해 세션 간 컨텍스트를 유지합니다:

- **context.md**: 프로젝트 상태, 진행 중인 작업
- **decisions.md**: 아키텍처 결정 기록 (ADR)
- **rules/**: 프로젝트별 커스텀 규칙

memory 스킬이 자동으로 이 파일들을 관리합니다.

## References

- [SEMO Principles](semo-system/semo-core/principles/PRINCIPLES.md)
- [SEMO Message Rules](semo-system/semo-core/principles/MESSAGE_RULES.md)
- [SEMO Skills](semo-system/semo-skills/)
