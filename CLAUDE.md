# SAX-QA Package Configuration

> QA 테스터를 위한 SAX 패키지

## Package Info

- **Package**: SAX-QA
- **Version**: 0.1.0 ([VERSION](./VERSION) 참조)
- **Target**: STG 환경에서 테스트 수행
- **Audience**: QA 담당자, 테스터

---

## 🔴 새 세션 시작 시 초기화 (NON-NEGOTIABLE)

> **⚠️ 새 세션에서 사용자 요청 처리 전, 반드시 아래 2단계를 순서대로 실행합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### Step 1: 버전 체크

```bash
# 로컬 vs 원격 버전 비교
LOCAL=$(cat .claude/sax-qa/VERSION 2>/dev/null)
REMOTE=$(gh api repos/semicolon-devteam/sax-qa/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)
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

## QA Workflow

### 테스트 프로세스

```text
1. 테스트 대기 이슈 확인 (테스트중 상태)
2. 테스트 항목 확인 (AC 기반)
3. STG 환경 검증
4. 테스트 실행 및 결과 기록
5. Pass/Fail 처리 및 상태 변경
```

### GitHub Project 상태 흐름 (QA 관점)

```text
리뷰요청 → [dev 머지] → 테스트중 → [QA Pass] → 병합됨
                            ↓
                       [QA Fail] → 수정요청
```

> **SoT**: 상태 목록은 `이슈관리` Project(번호: 1)에서 직접 조회

```bash
gh api graphql -f query='query { organization(login: "semicolon-devteam") { projectV2(number: 1) { field(name: "Status") { ... on ProjectV2SingleSelectField { options { name color } } } } } }' --jq '.data.organization.projectV2.field.options[]'
```

### Iteration 관리

- **1 Iteration**: dev 머지 → STG 테스트 → Pass/Fail 판정
- **Fail 시**: 수정요청 상태로 변경 + 이슈 코멘트 + Slack 알림
- **Pass 조건**: 1 Iteration 내 모든 AC 항목 통과

---

## PO/개발자 연동

### PO (SAX-PO)

1. Epic 생성 → 테스트 기준 정의
2. Draft Task 생성 → AC(Acceptance Criteria) 포함

### 개발자 (SAX-Next)

1. 구현 완료 → PR 생성 → dev 머지
2. 이슈 상태가 "테스트중"으로 자동 변경

### QA (SAX-QA)

1. "테스트중" 상태 이슈 대기열 확인
2. AC 기반 테스트 수행
3. Pass → "병합됨" 상태 변경 + Production 배포 가능
4. Fail → "수정요청" 상태 변경 + 개발자 알림

---

## Test Case 요청 프로세스

### AC 미비 이슈 감지 시

Task Card에 QA 테스트 케이스가 부족한 경우:

1. **이슈 코멘트 작성**: AC 보완 요청
2. **Slack 알림**: 담당 PO/개발자에게 통지
3. **상태 변경**: "확인요청"으로 변경

```markdown
[SAX] Skill: request-test-cases

⚠️ **테스트 케이스 보완 요청**

이슈: #{issue_number}
현재 AC: {count}개
권장 AC: 최소 3개

보완이 필요한 항목:
- [ ] 정상 동작 시나리오
- [ ] 예외 처리 시나리오
- [ ] Edge case 시나리오
```

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
