# Agent/Skill Routing Map

> 사용자 요청 의도와 적절한 Agent/Skill 매핑 정보

## Agent Routing

### SEMO-Meta Agents

| 의도 키워드 | 대상 Agent | 역할 |
|------------|-----------|------|
| Agent + (생성/수정/삭제/검토) | `agent-manager` | SEMO Agent 라이프사이클 관리 |
| Skill + (생성/수정/삭제/검토) | `skill-manager` | SEMO Skill 라이프사이클 관리 |
| Command + (생성/수정/삭제/검토) | `command-manager` | SEMO Command 라이프사이클 관리 |
| 구조, 설계, 아키텍처 | `semo-architect` | SEMO 패키지 설계 |
| 규칙 검증, 준수 확인 | `compliance-checker` | 작업 후 규칙 검증 |

### SEMO-PO Agents

| 의도 키워드 | 대상 Agent | 역할 |
|------------|-----------|------|
| Epic + (생성/수정/검토) | `epic-master` | Epic 라이프사이클 관리 |
| Spec 초안 | `spec-writer` | 개발자용 명세 초안 작성 |
| Task + (분해/생성) | `task-manager` | Task 분해 및 GitHub Issue 생성 |
| 학습, 설명 | `teacher` | 개념/프로세스 학습 지원 |

### SEMO-Next Agents

| 의도 키워드 | 대상 Agent | 역할 |
|------------|-----------|------|
| 구현, 개발 | `implementer` | 코드 구현 (ADD Phase 4) |
| 검증, 테스트 | `verifier` | 구현 검증 (ADD Phase 5) |
| 학습, 설명 | `teacher` | 개념/패턴 학습 지원 |

## Skill Routing

### SEMO-Meta Skills

| 의도 키워드 | 대상 Skill | 역할 |
|------------|-----------|------|
| 패키지 검증, 구조 확인 | `package-validator` | 패키지 구조 검증 |
| 버전, 릴리스, CHANGELOG | `version-manager` | 버저닝 자동화 |
| 동기화, .claude 동기화 | `package-sync` | 패키지 동기화 |
| 배포, 설치 | `package-deploy` | 외부 프로젝트 배포 |
| 도움말, help | `semo-help` | 사용 가이드 제공 |
| 피드백, 버그 신고 | `feedback` | 피드백 수집 |

### SEMO-PO Skills

| 의도 키워드 | 대상 Skill | 역할 |
|------------|-----------|------|
| 도움말, help | `semo-help` | PO용 사용 가이드 |
| 피드백, 버그 신고 | `feedback` | 피드백 수집 |
| 환경 확인 | `health-check` | 환경 검증 |

### SEMO-Next Skills

| 의도 키워드 | 대상 Skill | 역할 |
|------------|-----------|------|
| 명세, Spec | `spec` | ADD Phase 1-3 명세 작성 |
| 구현 | `implement` | ADD Phase 4 구현 |
| 검증 | `verify` | ADD Phase 5 검증 |
| 진행도, 어디까지 | `task-progress` | 작업 진행도 확인 |
| 도움말, help | `semo-help` | Next.js 개발자용 가이드 |

## 검증 규칙

### 적절성 판단 기준

1. **의도 키워드 매칭**: 사용자 요청에 포함된 키워드가 라우팅 맵과 일치
2. **Agent/Skill 역할 일치**: 실제 사용된 Agent/Skill의 역할이 요청 의도와 부합
3. **패키지 범위 적합**: 요청된 패키지에 해당 Agent/Skill이 존재

### 위반 판단 기준

| 위반 유형 | 설명 | 예시 |
|----------|------|------|
| 잘못된 라우팅 | 의도와 다른 Agent/Skill 사용 | Agent 생성 요청에 skill-manager 사용 |
| 직접 처리 | Orchestrator가 직접 작업 수행 | 라우팅 없이 코드 작성 |
| 존재하지 않는 대상 | 없는 Agent/Skill 호출 | SEMO-PO에서 implementer 호출 |
