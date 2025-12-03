# SAX-Design Package Configuration

> 디자이너를 위한 AI 어시스턴트 패키지 - Claude Code + Antigravity 통합

## Package Info

- **Package**: SAX-Design
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Audience**: UI/UX 디자이너, 프로덕트 디자이너

---

## 🔴 Orchestrator-First (최우선 규칙)

> **⚠️ 이 규칙은 예외 없이 적용됩니다. 직접 처리 절대 금지.**

### 접두사 감지 시 필수 출력 (MUST)

입력이 다음 키워드를 포함하면 **반드시** SAX 메시지를 출력해야 합니다:

| 키워드 | 트리거 |
|--------|--------|
| 목업, mockup, UI | 디자인 생성 작업 |
| 핸드오프, handoff | 개발 전달 작업 |
| Figma, 피그마 | Figma 연동 작업 |
| 온보딩, onboarding | 디자이너 온보딩 |
| 환경, 설정, health | 환경 검증 |

**키워드 감지 시 첫 출력**:

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

> 🔴 이 메시지 없이 작업 진행 금지

---

## Quick Routing Table

| 의도 | 위임 대상 | 트리거 키워드 |
|------|----------|---------------|
| 목업 생성 | design-master → generate-mockup | "목업", "mockup", "UI 만들어" |
| 핸드오프 | design-master → design-handoff | "핸드오프", "개발 전달", "스펙 문서" |
| Figma 연동 | design-master | "Figma", "피그마", "디자인 가져와" |
| 환경 검증 | health-check Skill | "환경 확인", "설정 확인", "/SAX:health-check" |
| 온보딩 | onboarding-master Agent | "처음이에요", "온보딩", "/SAX:onboarding" |
| 도움말 | sax-help Skill | "도움", "help", "/SAX:help" |

---

## 🔴 SAX Core 필수 참조

> **모든 작업 전 sax-core 문서 및 공통 컴포넌트를 참조합니다.**

| 파일 | 용도 |
|------|------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |

---

## Agents 요약

| Agent | 역할 |
|-------|------|
| [orchestrator](agents/orchestrator/orchestrator.md) | 디자인 작업 라우팅 및 Agent/Skill 위임 |
| [onboarding-master](agents/onboarding-master/onboarding-master.md) | 디자이너 온보딩 6단계 프로세스 |
| [design-master](agents/design-master/design-master.md) | 디자인 작업 총괄 (목업, 핸드오프, Figma) |

---

## Skills 요약

| Skill | 역할 | 트리거 |
|-------|------|--------|
| [health-check](skills/health-check/SKILL.md) | 디자인 환경 검증 | `/SAX:health-check`, "환경 확인" |
| [generate-mockup](skills/generate-mockup/SKILL.md) | AI 목업 생성 | `/SAX:mockup`, "목업 만들어" |
| [design-handoff](skills/design-handoff/SKILL.md) | 핸드오프 문서 생성 | `/SAX:handoff`, "개발 전달" |

---

## Commands 요약

| Command | 설명 | 호출 대상 |
|---------|------|----------|
| `/SAX:onboarding` | 디자이너 온보딩 시작 | onboarding-master Agent |
| `/SAX:health-check` | 환경 검증 | health-check Skill |
| `/SAX:mockup` | 목업 생성 | generate-mockup Skill |
| `/SAX:handoff` | 핸드오프 문서 생성 | design-handoff Skill |

---

## 🔵 Antigravity 연동

> sax-design은 Claude Code와 Antigravity 듀얼 설정을 지원합니다.

### 설정 구조

```
프로젝트/
├── .claude/           # Claude Code 설정
│   └── sax-design/    # SAX-Design 패키지
└── .agent/            # Antigravity 설정
    ├── rules/         # 항상 활성화되는 규칙
    └── workflows/     # /command로 호출되는 워크플로우
```

### Antigravity 활용 시나리오

| 도구 | 역할 |
|------|------|
| **Claude Code** | 로직 작성, 코드 생성, 핸드오프 문서 |
| **Antigravity** | UI 목업 생성, 브라우저 테스트, 이미지 생성 |

### 권장 워크플로우

```text
1. Claude Code에서 디자인 요구사항 정리
   → design-handoff Skill로 스펙 문서 생성

2. Antigravity로 전환
   → /mockup 워크플로우로 UI 목업 생성
   → 브라우저 서브에이전트로 테스트

3. Claude Code로 복귀
   → 생성된 목업 기반 컴포넌트 코드 작성
```

---

## MCP 서버 요구사항

| 서버 | 용도 | 필수 여부 |
|------|------|----------|
| `playwright` | 브라우저 테스트 | 권장 |
| `magic` (21st.dev) | UI 컴포넌트 생성 | 권장 |
| `Framelink` | Figma 연동 | 선택 |
| `context7` | 문서 조회 | 권장 |

---

## Design Handoff 문서 형식

디자인-개발 협업을 위한 표준 핸드오프 문서:

```markdown
# Design Handoff: {컴포넌트명}

## 1. 개요
- 목적: {사용자 문제 해결}
- 대상 사용자: {페르소나}

## 2. 시각 스펙
- 레이아웃: {구조}
- 색상: {컬러 토큰}
- 타이포그래피: {폰트 스펙}
- 스페이싱: {간격 값}

## 3. 인터랙션
- 상태: default, hover, active, disabled
- 애니메이션: {트랜지션}

## 4. 반응형
- Desktop: {breakpoint}
- Tablet: {breakpoint}
- Mobile: {breakpoint}

## 5. 접근성
- ARIA: {라벨}
- 키보드: {탐색}
- 대비: {WCAG 준수}

## 6. 에셋
- Figma: {링크}
- 목업: {이미지 경로}
```

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
- [Antigravity Documentation](https://developers.google.com/ai-studio/agent-ide)
