# Orchestrator Routing Table

## Intent → Target Mapping

### Primary Routes (MVP 내부)

| Intent Category | Keywords (KO) | Keywords (EN) | Target | Priority |
|-----------------|---------------|---------------|--------|----------|
| ONBOARDING | 온보딩, 시작, 설정 | onboarding, setup, start | onboarding-master | 1 |
| ARCHITECTURE | 도메인, 구조, 아키텍처 | domain, scaffold, architecture | mvp-architect | 2 |
| IMPLEMENTATION | 구현, 개발, 코드 | implement, develop, code | implementation-master | 3 |
| DATA_SYNC | 타입, 인터페이스, 동기화 | type, interface, sync | skill:sync-interface | 4 |
| DATA_QUERY | supabase, graphql, 쿼리 | supabase, graphql, query | skill:supabase-fallback | 4 |
| VISUAL | 목업, UI, 디자인 | mockup, UI, design | Antigravity | 5 |
| VERIFICATION | 검증, 통합, 머지 | verify, integration, merge | skill:verify-integration | 6 |
| HEALTH | 환경, MCP, 검증 | health, MCP, check | skill:health-check | 7 |

### Cross-Package Routes (MVP 외부)

| Intent Category | Keywords | Target Package | Prefix |
|-----------------|----------|----------------|--------|
| EPIC_CREATION | 에픽, Epic, 요구사항 | sax-po | `[po]` |
| TASK_CREATION | 태스크, Task, 작업 | sax-po | `[po]` |
| BACKEND_API | API, 백엔드, Spring | sax-backend | `[backend]` |
| INFRASTRUCTURE | 배포, 인프라, Docker | sax-infra | `[infra]` |
| QUALITY | QA, 테스트, 검수 | sax-qa | `[qa]` |

---

## Decision Tree

```
요청 수신
    │
    ├─ [mvp] 접두사? ─────────────────────────────────────┐
    │                                                      │
    ├─ MVP 키워드 매칭?                                    │
    │   ├─ 온보딩/시작 → onboarding-master                │
    │   ├─ 도메인/구조 → mvp-architect                    │
    │   ├─ 구현/개발 → implementation-master              │
    │   ├─ 타입/동기화 → skill:sync-interface             │
    │   ├─ supabase/쿼리 → skill:supabase-fallback        │
    │   ├─ 목업/UI → Antigravity 위임                     │
    │   ├─ 검증/통합 → skill:verify-integration           │
    │   └─ 환경/MCP → skill:health-check                  │
    │                                                      │
    └─ Cross-package 키워드 매칭?                          │
        ├─ Epic/Task → sax-po                             │
        ├─ API/백엔드 → sax-backend                       │
        ├─ 배포/인프라 → sax-infra                        │
        └─ QA/테스트 → sax-qa                             │
```

---

## Priority Rules

1. **명시적 접두사 우선**: `[mvp]`, `[po]` 등 접두사가 있으면 해당 패키지로 즉시 라우팅
2. **Task Card 확인**: 구현 요청 시 sax-po Task Card 존재 확인
3. **단일 책임**: 하나의 요청은 하나의 Agent/Skill로만 위임
4. **Cross-package 알림**: MVP 범위 외 요청 시 적절한 패키지 안내
