# SAX-Meta Package Configuration

> SAX 패키지 자체 관리 및 개발을 위한 메타 패키지

## Package Info

- **Package**: SAX-Meta
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: docs repository (SAX Source of Truth)
- **Audience**: SAX 개발자, SAX 패키지 관리자

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

1. **사용자 요청 수신 시**: 즉시 `agents/orchestrator.md` 읽기
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

## 🔴 SAX 개발 필수 원칙

### 1. 세션 컨텍스트 비의존 원칙

> **SAX는 세션 컨텍스트에 의지하지 않는다.**

- 모든 필수 정보는 **Reference Chain**을 통해 접근 가능해야 함
- 세션 종료 후에도 동일 결과 보장

```text
Agent/Skill → references/ → sax-core/ → docs 레포 문서
```

### 2. 중복 체크 필수 원칙

> **문서 생성/수정 전 반드시 중복 체크**

체크 범위: `.claude/sax-core/`, `agents/`, `skills/`, docs 레포

### 3. 서브모듈 수정 시 로컬 동기화 필수

> **sax-meta 수정 후 반드시 `.claude/sax-meta/` 동기화**

```bash
cd sax-meta && git push origin main && cd ../.claude/sax-meta && git pull origin main
```

### 4. 패키지 접두사 명령 규칙

| 접두사 | 대상 |
|--------|------|
| `[po]` | sax-po만 |
| `[next]` | sax-next만 |
| `[core]` | sax-core만 |
| `[meta]` | sax-meta만 |
| `[po \| next]` | 복수 패키지 |
| `[all]` / (없음) | 모든 패키지 |

### 5. 작업 완료 후 버저닝 필수

| 변경 유형 | 버전 타입 |
|----------|----------|
| Agent/Skill/Command 추가/수정/삭제 | MINOR |
| 버그/오타 수정 | PATCH |
| Breaking Change | MAJOR |

---

## Package Purpose

SAX-Meta는 SAX 패키지 자체를 관리하고 개발하기 위한 **메타 패키지**입니다.

- **대상**: SAX 개발자, 패키지 관리자
- **비대상**: PO(SAX-PO 사용), 개발자(SAX-Next 사용)

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
