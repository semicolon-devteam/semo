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
| SAX init 커밋 | `sax-init` 프로세스 | "SAX init", "SAX 설치 커밋" |
| 피드백 | `skill:feedback` | "/SAX:feedback", "피드백", "버그 신고" |
| SAX 동작 오류 | `skill:feedback` | "SAX가 왜", "SAX 동작이" |
| Agent 관리 | `agent-manager` | `@AGENT` + CRUD |
| Skill 관리 | `skill-manager` | `@SKILL` + CRUD |
| Command 관리 | `command-manager` | `@COMMAND` + CRUD |
| 패키지 검증 | `skill:package-validator` | "검증", "구조 확인", "validate" |
| 버전 관리 | `skill:version-manager` | "버전 올려", "릴리스", "CHANGELOG" |
| 버전 체크 | `skill:version-updater` | "버전 체크", "업데이트 확인", "SAX 업데이트", "최신 버전" |
| 패키지 동기화 | `skill:package-sync` | "동기화", "sync" |
| 패키지 배포 | `skill:package-deploy` | "배포", "deploy", "설치" |
| 패키지 설계 | `sax-architect` | "구조", "설계", "아키텍처" |
| 도움 요청 | `skill:sax-help` | "/SAX:help", "도움말", "어떻게 해" |

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
[SAX] Orchestrator: 라우팅 실패 → 적절한 Agent 없음

⚠️ **직접 처리 필요**

현재 요청에 적합한 전담 Agent가 없습니다.

**요청 유형**: {request_type}
**처리 방법**:
1. 새 Agent 생성 필요
2. 또는 SAX-Meta 패키지 확장 필요
```
