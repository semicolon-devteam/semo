# Project-Specific Rules

> SEMO 프로젝트에만 적용되는 예외 규칙

---

## 네이밍 규칙

### 접두사 매핑 (하위 호환성)

| 레거시 접두사 | 새 라우팅 | 플랫폼 |
|---------------|----------|--------|
| `[next]` | semo-skills/coder | nextjs |
| `[backend]` | semo-skills/coder | spring |
| `[mvp]` | semo-skills/coder | mvp |
| `[ms]` | semo-skills/coder | microservice |
| `[po]` | semo-skills/planner | - |
| `[pm]` | semo-skills/planner | - |
| `[qa]` | semo-skills/tester | - |
| `[infra]` | semo-skills/deployer | - |
| `[design]` | semo-skills/writer | - |

> **Deprecation 예정**: Phase 5 (6개월 후) 이후 레거시 접두사 제거

---

## 커맨드 매핑

| SAX (레거시) | SEMO (권장) |
|--------------|-------------|
| `/SAX:help` | `/SEMO:help` |
| `/SAX:slack` | `/SEMO:notify` |
| `/SAX:feedback` | `/SEMO:feedback` |
| `/SAX:health` | `/SEMO:health` |
| `/SAX:audit` | `/SEMO:audit` |

---

## Reserved 컴포넌트

다음 컴포넌트는 현재 비활성화 상태이나 삭제 금지:

| 컴포넌트 | 위치 | 활성화 조건 |
|----------|------|-------------|
| LiteLLM | semo-integrations/infra/litellm/ | MCP 서버 직접 LLM 호출 시 |
| LangFuse | semo-integrations/infra/langfuse/ | LiteLLM과 동일 |

---

## 특수 디렉토리

| 디렉토리 | 용도 | 수정 권한 |
|----------|------|----------|
| `.claude/memory/` | Context Mesh | Agent 자동 업데이트 가능 |
| `semo-core/tests/` | Test Engine | 관리자만 |
| `semo-core/principles/` | 핵심 원칙 | 관리자만 |

---

*마지막 업데이트: 2025-12-11*
