# SEMO Project Context

> 세션 간 영속화되는 프로젝트 컨텍스트

---

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **이름** | SEMO (Semicolon Orchestrate) |
| **이전 명칭** | SAX (Semicolon AI Transformation) |
| **버전** | 2.0.0 (Phase 1-4 완료) |
| **구조** | 3-Layer Architecture (core, skills, integrations) |

---

## 현재 작업 상태

### Phase 1: Foundation (✅ 완료)

- [x] semo-core 디렉토리 구조 생성
- [x] Test Engine 이관 (`infra/tests/` → `semo-core/tests/`)
- [x] Context Mesh 구축 (`.claude/memory/`)
- [x] detect-context.sh 구현 (`semo-core/shared/`)
- [x] 원칙 문서 이관 (`semo-core/principles/`)

### Phase 2: Skills Migration (✅ 완료)

- [x] semo-skills/coder/ 구축 (implement, scaffold, review, verify)
- [x] semo-skills/tester/ 구축 (execute, report, validate)
- [x] semo-skills/planner/ 구축 (epic, task, sprint, roadmap)
- [x] semo-skills/writer/ 구축 (spec, docx, handoff)
- [x] semo-skills/deployer/ 구축 (deploy, rollback, compose)
- [x] 통합 Orchestrator 설계 (routing-tables 포함)

### Phase 3: Integrations (✅ 완료)

- [x] semo-integrations/github/ 구축 (issues, pr, actions)
- [x] semo-integrations/slack/ 구축 (notify, feedback)
- [x] semo-integrations/supabase/ 구축 (query, sync)
- [x] semo-integrations/infra/ 구축 (doppler, litellm, langfuse, docker)

### Phase 4: Cleanup (✅ 완료)

- [x] 기존 sax-* Deprecation 경고 추가 (`docs/DEPRECATION_NOTICE.md`)
- [x] 마이그레이션 가이드 작성 (`docs/MIGRATION_GUIDE.md`)
- [x] E2E 테스트 케이스 추가 (`semo-core/tests/cases/`)

---

## 플랫폼 정보

| 플랫폼 | 감지 조건 | 상태 |
|--------|----------|------|
| Next.js | `next.config.js` 존재 | 지원 |
| Spring | `pom.xml` 또는 `build.gradle` | 지원 |
| Microservice | docker-compose + microservice 키워드 | 지원 |
| MVP | 기타 | 기본값 |

---

## 주요 결정 사항

> 상세 내용은 [decisions.md](./decisions.md) 참조

1. **역할 기반 → 기능 기반 전환** (2025-12-11)
2. **Claude Code 중심 아키텍처** (LiteLLM/LangFuse Reserved)
3. **Test Engine vs Tester Skill 분리**

---

---

## 마이그레이션 상태

| 단계 | 상태 | 완료일 |
|------|------|--------|
| Phase 1: Foundation | ✅ 완료 | 2025-12-11 |
| Phase 2: Skills Migration | ✅ 완료 | 2025-12-11 |
| Phase 3: Integrations | ✅ 완료 | 2025-12-11 |
| Phase 4: Cleanup | ✅ 완료 | 2025-12-11 |
| **병행 운영** | 🔄 진행 중 | ~2026-06-11 |
| Phase 5: Legacy 제거 | ⏳ 예정 | 2026-06-11 |

---

*마지막 업데이트: 2025-12-11 (Phase 4 완료)*
