# SAX-PO Package Configuration

> PO/기획자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-PO
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: docs repository
- **Audience**: PO, 기획자

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

모든 요청 → `agents/orchestrator.md` → Agent/Skill 라우팅

---

## 🔴 Draft Task 생성 규칙 (NON-NEGOTIABLE)

### 금지 행위

| 행위 | 상태 |
|------|------|
| `gh issue create` 직접 실행 | ❌ 절대 금지 |
| Epic 분석 없이 Task 생성 | ❌ 절대 금지 |
| 레포지토리 임의 결정 | ❌ 절대 금지 |

### 필수 프로세스

```text
"Draft Task 생성해줘" → Orchestrator → draft-task-creator Agent
    ↓
1. Epic 분석 (대상 레포 확인)
2. check-backend-duplication Skill 호출 (백엔드 작업 시)
3. 올바른 레포에 Draft Task 생성
4. Projects 연결 + Assignee 확인
```

### 레포지토리 라우팅

| 작업 유형 | 대상 레포지토리 |
|----------|----------------|
| Backend (API, 서버, DB) | `semicolon-devteam/core-backend` (고정) |
| Frontend (UI, 화면) | Epic에 명시된 서비스 레포 |
| Design | 디자인팀 Slack 알림 |

---

## 개발자 연동

1. **PO**: Epic 생성 → docs 레포에 이슈 생성
2. **PO**: Draft Task 생성 → 서비스 레포/core-backend에 Issues 생성
3. **개발자**: 할당된 Draft Task 확인
4. **개발자**: `/speckit.specify` 실행 → spec.md 작성
5. **개발자**: Draft Task Issue 업데이트

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
