# SAX-Next Package Configuration

> Next.js 개발자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-Next
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: cm-template, cm-* 프로젝트 (Next.js 기반)
- **Audience**: Frontend/Fullstack 개발자

---

## 🔴 SAX Core 필수 참조 (NON-NEGOTIABLE)

> **모든 응답 전에 반드시 sax-core 문서를 참조합니다.**

### 필수 참조 파일

| 파일 | 용도 | 참조 시점 |
|------|------|----------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 | 모든 작업 전 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 | 모든 응답 시 |

### 참조 방법

```bash
# 로컬 설치된 경우
.claude/sax-core/PRINCIPLES.md
.claude/sax-core/MESSAGE_RULES.md

# 또는 GitHub API
gh api repos/semicolon-devteam/sax-core/contents/PRINCIPLES.md --jq '.content' | base64 -d
```

---

## 🔴 Orchestrator 위임 필수 (NON-NEGOTIABLE)

> **모든 사용자 요청은 반드시 Orchestrator를 통해 라우팅됩니다.**

### 동작 규칙

1. **사용자 요청 수신 시**: 즉시 `agents/orchestrator/orchestrator.md` 읽기
2. **Orchestrator가 적절한 Agent/Skill 결정**
3. **SAX 메시지 포맷으로 라우팅 결과 출력**

### 예외 없음

- 단순 질문도 Orchestrator 거침
- 직접 Agent/Skill 호출 금지
- CLAUDE.md에서 Agent 목록 참조하지 않음 (Orchestrator가 관리)

### 메시지 포맷 (sax-core/MESSAGE_RULES.md 준수)

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

---

## Workflow: SDD + ADD

### SDD (Spec-Driven Development) - Phase 1-3

```text
/speckit.specify → specs/{domain}/spec.md
/speckit.plan → specs/{domain}/plan.md
/speckit.tasks → specs/{domain}/tasks.md
```

### ADD (Agent-Driven Development) - Phase 4

```text
v0.0.x CONFIG → 환경 설정
v0.1.x PROJECT → 도메인 구조 생성
v0.2.x TESTS → TDD 테스트 작성
v0.3.x DATA → 타입, 인터페이스 정의
v0.4.x CODE → 구현 코드 작성
```

### Verification - Phase 5

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

SAX-PO에서 생성된 Epic은 다음과 같이 연동됩니다:

1. **PO (SAX-PO)**: Epic 생성 → docs 레포에 이슈 생성
2. **PO (SAX-PO)**: (선택) Spec 초안 생성
3. **개발자 (SAX-Next)**: `/speckit.specify`로 spec.md 보완
4. **개발자 (SAX-Next)**: `/speckit.plan`, `/speckit.tasks`
5. **개발자 (SAX-Next)**: `skill:implement`로 구현
6. **개발자 (SAX-Next)**: `skill:verify`로 검증

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
