# SAX-PO Package Configuration

> PO/기획자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-PO
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: docs repository
- **Audience**: PO, 기획자

---

## 🔴 새 세션 시작 시 초기화 (NON-NEGOTIABLE)

> **⚠️ 새 세션에서 사용자 요청 처리 전, 반드시 아래 2단계를 순서대로 실행합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### Step 1: 버전 체크

```bash
# 로컬 vs 원격 버전 비교
LOCAL=$(cat .claude/sax-po/VERSION 2>/dev/null)
REMOTE=$(gh api repos/semicolon-devteam/sax-po/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)
```

**업데이트 필요 시**: `[SAX] 업데이트 가능: {local} → {remote}. "SAX 업데이트해줘"`

### Step 2: 구조 검증 (필수)

> **⚠️ Step 1 완료 후 반드시 실행**

**스킬 호출** (폴백 체인):

1. `.claude/skills/sax-architecture-checker/SKILL.md` 존재 → 실행
2. 없으면 → `.claude/sax-core/skills/sax-architecture-checker/SKILL.md` 실행

**검증 항목**:

- CLAUDE.md 심링크 유효성
- agents/, skills/, commands/SAX/ 병합 상태
- 깨진 심링크 탐지 및 자동 복구

### 초기화 완료 출력

```markdown
[SAX] 세션 초기화 완료
- 버전: {version} ✅
- 구조: 정상 ✅
```

---

## 🔴 SAX Core 필수 참조 (NON-NEGOTIABLE)

> **모든 응답 전에 반드시 sax-core 문서를 참조합니다.**

### 필수 참조 파일

| 파일 | 용도 | 참조 시점 |
|------|------|----------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 | 모든 작업 전 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 | 모든 응답 시 |

### 공통 컴포넌트 (sax-core)

| 컴포넌트 | 유형 | 역할 |
|----------|------|------|
| `compliance-checker` | Agent | 작업 완료 후 규칙 준수 검증 |
| `version-updater` | Skill | 세션 시작 시 버전 체크 및 업데이트 |
| `notify-slack` | Skill | Slack 알림 전송 |
| `feedback` | Skill | 피드백 수집 및 GitHub 이슈 생성 |
| `sax-help` | Skill | SAX 도움말 및 팀 컨텍스트 응답 |

### 공통 커맨드 (sax-core)

| 커맨드 | 설명 | 호출 스킬 |
|--------|------|-----------|
| `/SAX:help` | SAX 도움말 | sax-help |
| `/SAX:slack` | Slack 메시지 전송 | notify-slack |
| `/SAX:update` | SAX 업데이트 | version-updater |
| `/SAX:feedback` | 피드백 제출 | feedback |

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

## 🔴 Draft Task 생성 규칙 (NON-NEGOTIABLE) - Issue #13 대응

> **Draft Task 관련 요청 시 반드시 draft-task-creator Agent를 호출해야 합니다.**

### 금지 행위

| 행위 | 상태 |
|------|------|
| `gh issue create` 직접 실행 | ❌ **절대 금지** |
| Epic 분석 없이 Task 생성 | ❌ **절대 금지** |
| 레포지토리 임의 결정 | ❌ **절대 금지** |

### 필수 프로세스

```text
"Draft Task 생성해줘" 요청 수신
        ↓
[SAX] Orchestrator: 의도 분석 완료 → Draft Task 생성
        ↓
[SAX] Agent 위임: draft-task-creator
        ↓
draft-task-creator Agent가:
  1. Epic 분석 (대상 레포 확인)
  2. check-backend-duplication Skill 호출 (백엔드 작업 시)
  3. 올바른 레포에 Draft Task 생성
  4. Projects 연결 + Assignee 확인
```

### 레포지토리 라우팅 규칙

| 작업 유형 | 대상 레포지토리 | 결정 권한 |
|----------|----------------|----------|
| Backend (API, 서버, DB) | `semicolon-devteam/core-backend` | **고정** (변경 불가) |
| Frontend (UI, 화면, 컴포넌트) | Epic에 명시된 서비스 레포 | Epic 참조 |
| Design (디자인 필드 체크) | 디자인팀 알림 (Slack) | N/A |

### 검증 트리거

다음 키워드 감지 시 **무조건** draft-task-creator Agent 호출:

- "Draft Task", "draft task", "드래프트 태스크"
- "Task 카드 만들어", "태스크 생성"
- "Epic에서 Task", "에픽에서 태스크"

---

## 개발자 연동

SAX-PO로 생성된 Epic은 개발자(SAX-Next)와 다음과 같이 연동됩니다:

1. **PO**: Epic 생성 → docs 레포에 이슈 생성
2. **PO**: Draft Task 생성 → 서비스 레포/core-backend에 Draft Task Issues 생성
3. **개발자**: 할당된 Draft Task 확인
4. **개발자**: 대상 레포에서 `/speckit.specify` 실행
5. **개발자**: spec.md 보완 후 `/speckit.plan`, `/speckit.tasks`
6. **개발자**: Draft Task Issue 업데이트 (tasks/ 내용 반영, draft 라벨 제거)

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
