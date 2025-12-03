# SAX-PO Package Configuration

> PO/기획자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-PO
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: docs repository
- **Audience**: PO, 기획자

---

## 🔴 새 세션 시작 시 버전 체크 (NON-NEGOTIABLE)

> **새 세션에서 첫 작업 전, SAX 패키지 버전을 확인하고 업데이트를 제안합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### 체크 워크플로우

```bash
# 1. 로컬 버전 확인
LOCAL_VERSION=$(cat .claude/sax-po/VERSION 2>/dev/null)

# 2. 원격 버전 확인
REMOTE_VERSION=$(gh api repos/semicolon-devteam/sax-po/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)

# 3. 비교
if [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
  echo "UPDATE_AVAILABLE"
fi
```

### 업데이트 가능 시 출력

```markdown
[SAX] version-updater: 업데이트 가능

📦 **SAX 업데이트 알림**

현재 버전: {local_version}
최신 버전: {remote_version}

업데이트하려면: "SAX 업데이트해줘"
```

### 최신 상태 시 출력 (선택)

```markdown
[SAX] version-updater: 최신 버전 확인 ✅

SAX {version}이 설치되어 있습니다.
```

---

## 🔴 세션 시작 시 구조 검증 (NON-NEGOTIABLE)

> **새 세션에서 첫 작업 전, .claude 구조 무결성을 검증합니다.**

### 검증 스킬 호출 (폴백 체인)

1. `.claude/skills/sax-architecture-checker/SKILL.md` 존재 시 → 해당 스킬 실행
2. 없으면 → `.claude/sax-core/skills/sax-architecture-checker/SKILL.md` 실행

### 검증 실행 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### 검증 대상 항목

- CLAUDE.md 심링크 유효성
- agents/, skills/, commands/SAX/ 병합 디렉토리 상태
- 깨진 심링크 탐지 및 자동 복구

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
