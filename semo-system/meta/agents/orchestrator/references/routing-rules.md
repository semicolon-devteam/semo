# Routing Rules

> Orchestrator 키워드 매칭 및 라우팅 규칙

## 키워드 유사어 그룹 (Synonym Groups)

라우팅 매칭 시 아래 유사어들은 **동일하게 취급**합니다 (대소문자 무시):

| 그룹 ID | 유사어 |
|---------|--------|
| `@AGENT` | agent, Agent, AGENT, 에이전트 |
| `@SKILL` | skill, Skill, SKILL, 스킬 |
| `@COMMAND` | command, Command, COMMAND, 커맨드, 명령어, 슬래시 커맨드 |
| `@CREATE` | 만들어, 추가, 생성, 새, create, add, new |
| `@UPDATE` | 수정, 변경, 업데이트, 고쳐, update, modify, change |
| `@DELETE` | 삭제, 제거, 없애, delete, remove |
| `@REVIEW` | 검토, 분석, 확인, 체크, 리뷰, 리스트업, review, analyze, check, audit |

## 복합 의도 매칭 규칙

**매칭 우선순위**: 복합 키워드 조합 > 단일 키워드

| 복합 패턴 | Route To | 예시 입력 |
|-----------|----------|-----------|
| `@AGENT` + `@CREATE` | `agent-manager` | "에이전트 만들어줘" |
| `@AGENT` + `@UPDATE` | `agent-manager` | "Agent 수정해줘" |
| `@AGENT` + `@DELETE` | `agent-manager` | "에이전트 삭제" |
| `@AGENT` + `@REVIEW` | `agent-manager` | "agent 검토해봐" |
| `@SKILL` + `@CREATE` | `skill-manager` | "스킬 추가해줘" |
| `@SKILL` + `@UPDATE` | `skill-manager` | "skill 수정" |
| `@SKILL` + `@DELETE` | `skill-manager` | "스킬 삭제해줘" |
| `@SKILL` + `@REVIEW` | `skill-manager` | "Skill 검토해봐" |
| `@COMMAND` + `@CREATE` | `command-manager` | "커맨드 만들어" |
| `@COMMAND` + `@UPDATE` | `command-manager` | "명령어 수정" |
| `@COMMAND` + `@DELETE` | `command-manager` | "Command 삭제" |
| `@COMMAND` + `@REVIEW` | `command-manager` | "command 검토해봐" |

## Routing Decision Table

| User Intent | Route To | Detection Keywords |
|-------------|----------|-------------------|
| SEMO init 커밋 | `sax-init` 프로세스 | "SEMO init", "SEMO 설치 커밋" |
| Agent 관리 | `agent-manager` | `@AGENT` + CRUD |
| Skill 관리 | `skill-manager` | `@SKILL` + CRUD |
| Command 관리 | `command-manager` | `@COMMAND` + CRUD |
| 패키지 검증 | `skill:package-validator` | "검증", "구조 확인", "validate" |
| 버전 관리 | `skill:version-manager` | "버전 올려", "릴리스", "CHANGELOG" |
| 버전 체크 | `skill:version-updater` | "버전 체크", "업데이트 확인", "SEMO 업데이트", "최신 버전" |
| 패키지 동기화 | `skill:package-sync` | "동기화", "sync" |
| 패키지 배포 | `skill:package-deploy` | "배포", "deploy", "설치" |
| 패키지 설계 | `semo-architect` | "구조", "설계", "아키텍처" |
| 도움 요청 | `skill:semo-help` | "/SEMO:help", "도움말", "어떻게 해" |
| 업무 목록 | `skill:list-bugs` | "업무리스트", "버그 목록", "이슈 목록", "할 일" |
| 이슈 생성 | `skill:create-issues` | "이슈 만들어", "이슈 생성", "태스크 만들어" |
| 코드 작성/수정 | `skill:coder` | "구현해줘", "코드 작성", "수정해줘", "버그 수정" |
| 구현 (Phase 4) | `agent:implementation-master` | "구현 시작", "개발 시작", "ADD Phase 4" |

## 🔴 코드 작성/수정 시 스킬 강제 사용 (NON-NEGOTIABLE)

> **⚠️ 직접 Edit/Write 도구로 코드 수정 금지**

### 규칙

1. **스킬 강제**: 코드 작성/수정 요청 감지 시 반드시 `skill:coder` 또는 `agent:implementation-master`로 라우팅
2. **직접 수정 금지**: Edit/Write 도구로 직접 코드 파일 수정 차단
3. **Quality Gate 필수**: 스킬 완료 후 자동으로 Quality Gate 실행

### 코드 구현 완료 후 자동 검증

```text
[코드 구현 요청]
    ↓
Orchestrator → skill:coder 또는 agent:implementation-master
    ↓
구현 완료
    ↓
[자동] Quality Gate 실행 (lint, tsc, build)
    ↓
✅ 통과 → 커밋/PR 가능
❌ 실패 → 에러 수정 필요, 커밋 차단
```

### 라우팅 분기

| 요청 | Route To |
|------|----------|
| "구현해줘", "코드 작성해줘" | `skill:coder` |
| "ADD Phase 4", "구현 시작" | `agent:implementation-master` |
| "버그 수정해줘" | `skill:coder` |
| "리팩토링해줘" | `skill:coder` |

### Quality Gate 실패 시 커밋 차단

```markdown
❌ **커밋 차단**: Quality Gate 미통과

Quality Gate가 실패한 상태에서는 커밋할 수 없습니다.
다음 에러를 수정한 후 다시 시도하세요:

{error_list}
```

## 🔴 이슈 생성 시 스킬 강제 사용 (NON-NEGOTIABLE)

> **⚠️ 직접 `gh issue create` 호출 차단**

### 규칙

1. **스킬 강제**: 이슈 생성 요청 감지 시 반드시 `skill:create-issues` 또는 `agent:draft-task-creator`로 라우팅
2. **직접 호출 금지**: `gh issue create` 직접 실행 차단
3. **필수 설정**: 스킬 내부에서 Projects 보드 연결 + Issue Type 설정 자동 수행

### 이슈 생성 후 필수 단계

```bash
# 1. Projects 보드 연결 (이슈관리 #1)
gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) { item { id } }
  }
' -f projectId="PVT_kwDOC01-Rc4AtDz2" -f contentId="$ISSUE_NODE_ID"

# 2. Issue Type 설정 (Task/Bug/Epic)
gh api graphql -f query='
  mutation {
    updateIssue(input: {
      id: "'"$ISSUE_NODE_ID"'"
      issueTypeId: "IT_kwDOC01-Rc4BdOub"  # Task
    }) { issue { id } }
  }
'
```

### Issue Type ID Reference

| Type | ID |
|------|-----|
| Task | `IT_kwDOC01-Rc4BdOub` |
| Bug | `IT_kwDOC01-Rc4BdOuc` |
| Feature | `IT_kwDOC01-Rc4BdOud` |
| Epic | `IT_kwDOC01-Rc4BvVz5` |

### 라우팅 분기

| 요청 | Route To |
|------|----------|
| "이슈 만들어줘" (단일) | `skill:create-issues` |
| "태스크 생성해줘" (Epic 기반) | `agent:draft-task-creator` |
| "버그 등록해줘" | `skill:create-issues` + Issue Type: Bug |

## 🔴 업무 목록 조회 시 현재 레포지토리 우선 (Context-First)

> **적용 대상**: `list-bugs`, `task-progress` 등 업무 관련 스킬

### 규칙

1. **현재 레포 우선**: `git remote` 감지된 레포지토리 이슈만 먼저 조회
2. **추가 확인 제안**: 응답 말미에 "다른 프로젝트 이슈도 확인할까요?" 문구 추가
3. **명시적 요청 시 전체 조회**: "모든 레포", "전체 이슈" 키워드 시 전체 조회

### 컨텍스트 감지 우선순위

```bash
# 1순위: 현재 디렉토리의 git remote
git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/'

# 2순위: 사용자 명시 레포 (예: "cm-land 버그 목록")
# 3순위: 모든 레포 조회 (사용자가 "전체" 요청 시)
```

### 출력 포맷

```markdown
## 🐛 {repo} Open 버그 목록

| # | 제목 | 담당자 | 상태 |
|---|------|--------|------|
| ... | ... | ... | ... |

**총 N건의 Open 버그**

---
💡 다른 프로젝트(cm-office, core-backend 등)의 이슈도 확인할까요?
```

## Routing-Only Policy

### ❌ 직접 처리 금지

Orchestrator는 다음을 **직접 처리하지 않습니다**:

- Agent 생성
- Skill 생성
- Command 생성
- 패키지 구조 검증
- 버전 관리

### ⚠️ 라우팅 실패 시 알림 필수

```markdown
[SEMO] Orchestrator: 라우팅 실패 → 적절한 Agent 없음

⚠️ **직접 처리 필요**

현재 요청에 적합한 전담 Agent가 없습니다.

**요청 유형**: {request_type}
**처리 방법**:
1. 새 Agent 생성 필요
2. 또는 SEMO-Meta 패키지 확장 필요
```
