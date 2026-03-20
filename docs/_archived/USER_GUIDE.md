# SEMO 사용자 가이드

> 모든 사용자를 위한 SEMO 상세 사용법

---

## 목차

1. [기본 사용법](#1-기본-사용법)
2. [자연어 요청](#2-자연어-요청)
3. [슬래시 커맨드](#3-슬래시-커맨드)
4. [SEMO 메시지 이해하기](#4-semo-메시지-이해하기)
5. [Context Mesh 활용](#5-context-mesh-활용)
6. [역할별 활용 가이드](#6-역할별-활용-가이드)
7. [팁과 요령](#7-팁과-요령)

---

## 1. 기본 사용법

### Claude Code 실행

```bash
# 프로젝트 디렉토리에서 실행
cd your-project
claude
```

### SEMO 확인

SEMO가 설치되어 있으면 Claude Code 시작 시 자동으로 활성화됩니다:

```
[SEMO] Orchestrator: 세션 시작
```

### 도움말 확인

```
/SEMO:help
```

---

## 2. 자연어 요청

SEMO는 자연어 요청을 이해합니다. 특별한 명령어 없이 원하는 것을 말하세요.

### 코드 작성

```
"로그인 페이지 만들어줘"
"User 도메인 생성해줘"
"API 엔드포인트 추가해줘"
```

### 코드 수정

```
"이 코드 리팩토링해줘"
"버그 수정해줘"
"성능 최적화해줘"
```

### 테스트

```
"테스트 코드 작성해줘"
"테스트 실행해줘"
"커버리지 확인해줘"
```

### 문서

```
"README 작성해줘"
"API 문서 만들어줘"
"주석 추가해줘"
```

### Git 작업

```
"커밋해줘"
"PR 만들어줘"
"브랜치 생성해줘"
```

### 기획/관리

```
"Epic 만들어줘"
"Task 정리해줘"
"진행 상황 보여줘"
```

---

## 3. 슬래시 커맨드

### 공통 커맨드

| 커맨드 | 설명 | 예시 |
|--------|------|------|
| `/SEMO:help` | 도움말 표시 | `/SEMO:help` |
| `/SEMO:health` | 환경 검증 | `/SEMO:health` |
| `/SEMO:update` | SEMO 업데이트 | `/SEMO:update` |
| `/SEMO:slack` | Slack 메시지 전송 | `/SEMO:slack #채널 메시지` |
| `/SEMO:feedback` | 피드백 제출 | `/SEMO:feedback 내용` |

### 패키지별 커맨드

각 패키지는 고유한 커맨드를 제공할 수 있습니다:

```bash
# 패키지별 커맨드 확인
/SEMO:help commands
```

---

## 4. SEMO 메시지 이해하기

SEMO는 모든 AI 동작을 투명하게 보여줍니다.

### 메시지 형식

```
[SEMO] {Type}: {name} {action} (사유: {reason})
```

### 메시지 타입

| Type | 의미 | 예시 |
|------|------|------|
| `Orchestrator` | 의도 분석/라우팅 | `[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현` |
| `Agent` | 에이전트 활성화 | `[SEMO] Agent: implementation-master 호출` |
| `Skill` | 스킬 사용 | `[SEMO] Skill: implement 사용` |
| `Reference` | 문서 참조 | `[SEMO] Reference: ddd-patterns 참조` |

### 실제 예시

```
사용자: "로그인 페이지 만들어줘"

[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현 요청

[SEMO] Skill: implement 호출 (platform: nextjs)

[SEMO] Reference: ddd-patterns 참조

## 구현을 시작합니다

### Phase 1: Foundation
...
```

---

## 5. Context Mesh 활용

### Context Mesh란?

SEMO는 세션 간 컨텍스트를 유지합니다. 이를 통해:
- 이전 대화 맥락 유지
- 아키텍처 결정 사항 기억
- 팀 선호도 반영

### 저장 위치

```
.claude/memory/
├── context.md       # 프로젝트 상태
├── decisions.md     # 아키텍처 결정
└── rules/           # 프로젝트별 규칙
```

### 결정 사항 저장

중요한 결정을 했을 때:

```
"이 결정 기억해줘: API 응답은 JSON Envelope 패턴을 사용한다"
```

SEMO가 자동으로 `decisions.md`에 저장합니다.

### 결정 사항 확인

```
"이전에 결정한 API 패턴이 뭐였지?"
```

### 수동 편집

`.claude/memory/decisions.md`를 직접 편집할 수도 있습니다:

```markdown
### ADR-001: API 응답 패턴

**날짜**: 2025-12-10
**상태**: Accepted

#### 결정
모든 API 응답은 JSON Envelope 패턴을 사용한다.

#### 근거
일관된 에러 처리와 메타데이터 포함을 위해.
```

---

## 6. 역할별 활용 가이드

### 프론트엔드 개발자 (semo-next)

**주요 요청**:
```
"로그인 페이지 만들어줘"
"API 연동해줘"
"컴포넌트 리팩토링해줘"
"DDD 구조로 도메인 설계해줘"
```

**유용한 스킬**:
- `implement`: 구현 (Phase-gated)
- `scaffold-domain`: 도메인 구조 생성
- `spring-integration`: 백엔드 API 연동

**팁**:
- Spring 백엔드 API 스펙이 있으면 자동 연동됩니다
- DDD 4-layer 구조를 기본으로 사용합니다

---

### 백엔드 개발자 (semo-backend)

**주요 요청**:
```
"User 도메인 만들어줘"
"CQRS 패턴으로 구현해줘"
"테스트 코드 작성해줘"
"API 스펙 동기화해줘"
```

**유용한 스킬**:
- `scaffold-domain`: 도메인 생성
- `verify-reactive`: Reactive 패턴 검증
- `sync-openapi`: OpenAPI 동기화

**팁**:
- Kotlin + Spring WebFlux 환경에 최적화되어 있습니다
- CQRS 패턴을 기본으로 사용합니다

---

### PO/기획자 (semo-po)

**주요 요청**:
```
"댓글 기능 Epic 만들어줘"
"Task를 GitHub 이슈로 동기화해줘"
"이 기능이 백엔드에 있는지 확인해줘"
"Spec 문서 작성해줘"
```

**유용한 스킬**:
- `create-epic`: Epic 생성
- `sync-tasks`: Task 동기화
- `check-backend-duplication`: 중복 검사

**팁**:
- Epic 템플릿을 따라 일관된 문서를 생성합니다
- 백엔드 중복 검사로 불필요한 개발을 방지합니다

---

### 디자이너 (semo-design)

**주요 요청**:
```
"로그인 화면 목업 만들어줘"
"개발팀에 전달할 핸드오프 문서 만들어줘"
"이 디자인 피드백해줘"
```

**팁**:
- Figma MCP 연동 시 더 강력한 기능을 사용할 수 있습니다
- 핸드오프 문서는 개발팀이 바로 사용할 수 있는 형식으로 생성됩니다

---

### QA (semo-qa)

**주요 요청**:
```
"테스트 대기 목록 보여줘"
"로그인 기능 테스트 케이스 검증해줘"
"버그 리포트 작성해줘"
"프로덕션 배포 검증해줘"
```

**유용한 스킬**:
- `test-queue`: 테스트 대기열
- `validate-test-cases`: 테스트 케이스 검증
- `production-gate`: 프로덕션 게이트

---

### PM (semo-pm)

**주요 요청**:
```
"스프린트 만들어줘"
"팀원별 진행 상황 보여줘"
"블로커 있는지 확인해줘"
"주간 리포트 생성해줘"
```

**유용한 스킬**:
- `create-sprint`: 스프린트 생성
- `detect-blockers`: 블로커 감지
- `generate-member-report`: 팀원 리포트

---

### 인프라 (semo-infra)

**주요 요청**:
```
"Docker Compose 파일 만들어줘"
"Nginx 리버스 프록시 설정해줘"
"서비스 배포해줘"
"롤백해줘"
```

**유용한 스킬**:
- `scaffold-compose`: Docker Compose 생성
- `scaffold-nginx`: Nginx 설정
- `deploy`: 배포
- `rollback`: 롤백

---

## 7. 팁과 요령

### 효과적인 요청 방법

**좋은 예**:
```
"User 도메인을 DDD 구조로 만들어줘.
 CQRS 패턴을 사용하고,
 테스트 코드도 포함해줘."
```

**나쁜 예**:
```
"코드 짜줘"  # 너무 모호함
```

### 컨텍스트 제공

관련 파일이나 이슈 번호를 함께 제공하면 더 정확한 결과를 얻습니다:

```
"#123 이슈 기반으로 로그인 기능 구현해줘"
"src/app/login/page.tsx 파일 리팩토링해줘"
```

### 단계별 요청

복잡한 작업은 단계별로 나누어 요청하세요:

```
1. "User 도메인 구조 설계해줘"
2. "설계 기반으로 구현해줘"
3. "테스트 코드 작성해줘"
```

### 피드백 주기

결과가 마음에 들지 않으면 피드백을 주세요:

```
"이 부분은 다르게 해줘: ..."
"여기에 에러 처리 추가해줘"
```

### Slack 알림 활용

작업 완료 후 팀에게 알리기:

```
/SEMO:slack #_협업 로그인 기능 구현 완료! PR #45 리뷰 부탁드립니다.
```

---

## 문제 해결

### SEMO가 응답하지 않아요

1. `.claude/CLAUDE.md` 파일 존재 확인
2. `/SEMO:health`로 환경 검증
3. Claude Code 재시작

### 원하는 결과가 나오지 않아요

1. 더 구체적으로 요청
2. 관련 파일/이슈 번호 제공
3. 단계별로 나누어 요청

### MCP 연결 실패

1. 환경변수 확인 (`SLACK_BOT_TOKEN` 등)
2. `.claude/settings.json` 확인
3. 네트워크 연결 확인

---

## 추가 리소스

- [QUICKSTART.md](./QUICKSTART.md) - 빠른 시작
- [PACKAGES.md](./PACKAGES.md) - 패키지별 상세
- [FAQ.md](./FAQ.md) - 자주 묻는 질문
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 기술 아키텍처

---

## 피드백

SEMO 사용 중 문제가 있거나 개선 아이디어가 있으면:

```
/SEMO:feedback [내용]
```

또는 Slack `#_협업` 채널에서 문의하세요.
