# SAX-Next Package Configuration

> Next.js 개발자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-Next
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: cm-template, cm-* 프로젝트 (Next.js 기반)
- **Audience**: Frontend/Fullstack 개발자

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### 1. 세션 초기화

> 📖 상세: [sax-core/_shared/INIT_SETUP.md](sax-core/_shared/INIT_SETUP.md)

새 세션 시작 시 자동 실행 (4-Phase):
```text
버전 체크 → 구조 검증 → 동기화 검증 → 메모리 복원
```

### 2. SAX Core 참조

> 📖 상세: [sax-core/_shared/SAX_CORE_REFERENCE.md](sax-core/_shared/SAX_CORE_REFERENCE.md)

### 3. Orchestrator 위임

> 📖 상세: [sax-core/_shared/ORCHESTRATOR_RULES.md](sax-core/_shared/ORCHESTRATOR_RULES.md)

모든 요청 → `agents/orchestrator/orchestrator.md` → Agent/Skill 라우팅

---

## Workflow: SDD + ADD

### Spec-First Branching

```text
dev 브랜치
  ├── [SDD Phase 1-3] Spec 작성 → specs/{domain}/*.md
  └── Feature 브랜치 분기 → {issue_number}-{title}
        └── [ADD Phase 4] 코드 구현 → Draft PR → Merge
```

### SDD (Spec-Driven Development)

| Phase | Command | Output |
|-------|---------|--------|
| 1 | `/speckit.specify` | spec.md |
| 2 | `/speckit.plan` | plan.md |
| 3 | `/speckit.tasks` | tasks.md |

### ADD (Agent-Driven Development)

| 버전 | 단계 | 설명 |
|------|------|------|
| v0.0.x | CONFIG | 환경 설정 |
| v0.1.x | PROJECT | 도메인 구조 생성 |
| v0.2.x | TESTS | TDD 테스트 작성 |
| v0.3.x | DATA | 타입, 인터페이스 정의 |
| v0.4.x | CODE | 구현 코드 작성 |

### Verification (Phase 5)

```text
skill:verify → 종합 검증
skill:check-team-codex → 팀 코덱스 준수 확인
skill:validate-architecture → DDD 아키텍처 검증
```

---

## Architecture: DDD 4-Layer

```text
src/app/{domain}/
├── _repositories/     # 서버사이드 데이터 접근 (Layer 1)
├── _api-clients/      # 브라우저 HTTP 통신 (Layer 2)
├── _hooks/            # React 상태 관리 (Layer 3)
├── _components/       # 도메인 전용 UI (Layer 4)
└── page.tsx
```

---

## PO 연동 (SAX-PO)

1. **PO**: Epic 생성 → docs 레포에 이슈 생성
2. **PO**: (선택) Spec 초안 생성
3. **개발자**: `/speckit.specify`로 spec.md 보완
4. **개발자**: `/speckit.plan`, `/speckit.tasks`
5. **개발자**: `skill:implement`로 구현
6. **개발자**: `skill:verify`로 검증

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
