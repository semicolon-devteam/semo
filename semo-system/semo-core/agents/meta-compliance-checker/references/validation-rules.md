# Compliance Validation Rules

> 상세 검증 규칙 및 판단 기준

## 1. semo-core 준수 검증

### 1.1 SEMO 메시지 포맷

**규칙**: `[SEMO] {Type}: {name} {action}`

| 요소 | 필수 | 유효값 |
|------|-----|--------|
| `[SEMO]` | O | 정확히 `[SEMO]` |
| `Type` | O | `Agent`, `Skill`, `Reference`, `Orchestrator` |
| `name` | O | Agent/Skill/참조 대상 이름 |
| `action` | O | 동작 (호출, 사용, 참조, 위임 등) |
| `(사유: {reason})` | △ | 선택적 설명 |

**검증 방법**:
```regex
^\[SAX\] (Agent|Skill|Reference|Orchestrator): .+ (호출|사용|참조|위임|실행)
```

**위반 예시**:
- `[sax] Agent: ...` - 대소문자 오류
- `[SEMO] agent-manager 호출` - Type 누락
- `SEMO Agent: ...` - 대괄호 누락

### 1.2 Orchestrator-First Policy

**규칙**: 모든 요청은 Orchestrator를 먼저 거쳐야 함

**검증 항목**:

| 항목 | 기준 | 위반 조건 |
|------|------|----------|
| 첫 SEMO 메시지 | `[SEMO] Orchestrator:` | 다른 Type이 먼저 출력 |
| 의도 분석 | 의도 분석 완료 메시지 존재 | 메시지 없이 Agent 위임 |
| 라우팅 결정 | Agent 위임 또는 Skill 호출 | 직접 작업 수행 |

**예외 사항**:
- 단순 질문 ("이게 뭐야?", "설명해줘")
- 일반 대화 (인사, 감사)
- 명시적 직접 요청 ("Orchestrator 없이 바로 해줘")

### 1.3 Routing-Only Policy

**규칙**: Orchestrator는 라우팅만 담당, 직접 작업 금지

**허용 동작**:
- 의도 분석
- Agent 선택
- Agent 위임
- Skill 호출
- 워크플로우 안내 (간단한 정보 제공)

**금지 동작**:
- 직접 코드 작성
- 직접 파일 생성/수정
- 직접 명세 작성
- 직접 구현

**검증 방법**:
1. Orchestrator 응답 후 파일 변경 감지
2. Orchestrator가 직접 Edit/Write 도구 사용 여부

### 1.4 버저닝 규칙

**규칙**: 변경 시 반드시 버전 업데이트

| 변경 유형 | 버전 타입 | 필수 파일 |
|----------|----------|----------|
| Agent/Skill/Command 추가 | MINOR | VERSION, CHANGELOG |
| Agent/Skill/Command 수정 | MINOR | VERSION, CHANGELOG |
| Agent/Skill/Command 삭제 | MINOR | VERSION, CHANGELOG |
| CLAUDE.md 변경 | MINOR | VERSION, CHANGELOG |
| 버그/오타 수정 | PATCH | VERSION, CHANGELOG |
| Breaking Change | MAJOR | VERSION, CHANGELOG |

**검증 방법**:
1. 작업 전후 VERSION 파일 비교
2. CHANGELOG 파일 존재 확인
3. 커밋 메시지에 버전 태그 포함 확인

## 2. Agent/Skill 사용 적절성

### 2.1 의도-라우팅 매칭

**검증 절차**:

1. 사용자 요청에서 **의도 키워드** 추출
2. `routing-map.md`에서 **예상 Agent/Skill** 조회
3. 실제 사용된 Agent/Skill과 **비교**

**키워드 추출 규칙**:

| 그룹 | 키워드 |
|------|--------|
| `@AGENT` | agent, Agent, 에이전트 |
| `@SKILL` | skill, Skill, 스킬 |
| `@COMMAND` | command, Command, 커맨드, 명령어 |
| `@CREATE` | 만들어, 추가, 생성, 새, create, add |
| `@UPDATE` | 수정, 변경, 업데이트, update, modify |
| `@DELETE` | 삭제, 제거, 없애, delete, remove |
| `@REVIEW` | 검토, 분석, 확인, 리뷰, review, analyze |

### 2.2 패키지 범위 검증

**규칙**: 요청된 패키지에 해당 Agent/Skill이 존재해야 함

| 패키지 | 가용 Agent | 가용 Skill |
|--------|-----------|-----------|
| semo-meta | orchestrator, agent-manager, skill-manager, command-manager, semo-architect, compliance-checker | package-validator, version-manager, package-sync, package-deploy, semo-help, feedback |
| semo-po | orchestrator, epic-master, spec-writer, task-manager, teacher | semo-help, feedback, health-check |
| semo-next | orchestrator, implementer, verifier, teacher | spec, implement, verify, task-progress, semo-help, feedback, health-check |

**위반 예시**:
- SEMO-PO에서 `implementer` Agent 호출 시도
- SEMO-Meta에서 `epic-master` Agent 호출 시도

## 3. 문서 중복 검토

### 3.1 규칙 정의 중복

**검증 절차**:

1. 새 문서/수정 내용에서 **규칙 정의** 추출
2. semo-core 문서에서 **동일/유사 규칙** 검색
3. 중복 발견 시 **SoT 원칙** 위반으로 판정

**검색 패턴**:
```bash
# 규칙 키워드 검색
grep -r "규칙|원칙|policy|rule" semo-core/

# 유사 문장 검색
grep -r "{rule_keyword}" semo-core/ agents/ skills/
```

### 3.2 SoT 원칙 검증

**규칙**: 동일 정보는 단 하나의 위치에만 존재

| 정보 유형 | SoT 위치 | 허용 행위 |
|----------|---------|----------|
| SEMO 원칙 | semo-core/PRINCIPLES.md | 링크 참조만 허용 |
| 메시지 규칙 | semo-core/MESSAGE_RULES.md | 링크 참조만 허용 |
| 팀 규칙 | semo-core/TEAM_RULES.md | 링크 참조만 허용 |

**위반 예시**:
- CLAUDE.md에 PRINCIPLES.md 내용 복사
- Agent 문서에 MESSAGE_RULES.md 내용 복사
- 여러 Skill에 동일한 규칙 정의

### 3.3 기존 문서 확장 권장

**검증 절차**:

1. 새 문서 내용과 기존 문서 **유사도 분석**
2. 유사도 70% 이상 시 **기존 문서 확장 권장**
3. 새 문서 생성 이유 **명시 요구**

**권장 메시지**:
```markdown
⚠️ **기존 문서 확장 권장**

새 문서 `{new_doc}`와 기존 문서 `{existing_doc}`의 내용이 유사합니다.

**권장 조치**:
- 기존 문서 `{existing_doc}`에 새 내용을 추가하는 것을 권장합니다.
- 새 문서 생성이 꼭 필요한 경우, 그 이유를 명시해주세요.
```

## 위반 심각도

| 심각도 | 표시 | 조치 |
|-------|------|------|
| ❌ CRITICAL | 위반 | 작업 중단 권장 |
| ⚠️ WARNING | 경고 | 수정 권장, 진행 가능 |
| 💡 INFO | 정보 | 참고용, 진행 가능 |

### 심각도별 위반 유형

**❌ CRITICAL**:
- SEMO 메시지 포맷 오류
- Orchestrator-First Policy 위반
- SoT 원칙 위반 (명백한 중복)
- 버저닝 누락 (MAJOR/MINOR 변경)

**⚠️ WARNING**:
- Routing-Only Policy 경미한 위반
- 기존 문서 확장 권장
- 버저닝 누락 (PATCH 변경)

**💡 INFO**:
- 코드 스타일 권장사항
- 문서 구조 개선 제안
