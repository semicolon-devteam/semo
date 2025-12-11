<!-- SEMO Framework -->
> **SEMO** = "Semicolon Orchestrate" - AI 에이전트 오케스트레이션 프레임워크
> (이전 명칭: SEMO - Semicolon AI Transformation)

# SEMO-Design Package Configuration

> 디자이너를 위한 AI 어시스턴트 패키지 - Claude Code + Antigravity 통합

## Package Info

- **Package**: SEMO-Design
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Audience**: UI/UX 디자이너, 프로덕트 디자이너

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### 1. 세션 초기화

> 📖 상세: [_shared/INIT_SETUP.md](../_shared/INIT_SETUP.md)

### 2. SEMO Core 참조

> 📖 상세: [_shared/SEMO_CORE_REFERENCE.md](../_shared/SEMO_CORE_REFERENCE.md)

### 3. Orchestrator 위임

> 📖 상세: [_shared/ORCHESTRATOR_RULES.md](../_shared/ORCHESTRATOR_RULES.md)

| 키워드 | 트리거 |
|--------|--------|
| 목업, mockup, UI | 디자인 생성 작업 |
| 핸드오프, handoff | 개발 전달 작업 |
| Figma, 피그마 | Figma 연동 작업 |
| 온보딩, onboarding | 디자이너 온보딩 |

---

## Quick Routing Table

| 의도 | 위임 대상 |
|------|----------|
| 목업 생성 | design-master → generate-mockup |
| 핸드오프 | design-master → design-handoff |
| Figma 연동 | design-master |
| 환경 검증 | health-check Skill |
| 온보딩 | onboarding-master Agent |

---

## Agents & Skills

### Agents

| Agent | 역할 |
|-------|------|
| orchestrator | 디자인 작업 라우팅 |
| onboarding-master | 디자이너 온보딩 6단계 |
| design-master | 디자인 작업 총괄 |

### Skills

| Skill | 역할 |
|-------|------|
| health-check | 디자인 환경 검증 |
| generate-mockup | AI 목업 생성 |
| design-handoff | 핸드오프 문서 생성 |

---

## Antigravity 연동

| 도구 | 역할 |
|------|------|
| **Claude Code** | 로직 작성, 코드 생성, 핸드오프 문서 |
| **Antigravity** | UI 목업 생성, 브라우저 테스트, 이미지 생성 |

### 권장 워크플로우

```text
1. Claude Code → 디자인 요구사항 정리 → 스펙 문서 생성
2. Antigravity → /mockup 워크플로우 → UI 목업 생성
3. Claude Code → 생성된 목업 기반 컴포넌트 코드 작성
```

---

## Commands

| Command | 설명 |
|---------|------|
| `/SEMO:onboarding` | 디자이너 온보딩 시작 |
| `/SEMO:health-check` | 환경 검증 |
| `/SEMO:mockup` | 목업 생성 |
| `/SEMO:handoff` | 핸드오프 문서 생성 |

---

## References

- [SEMO Core - Principles](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core - Message Rules](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
