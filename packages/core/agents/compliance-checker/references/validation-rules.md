# Core Validation Rules

> 모든 SAX 패키지에 적용되는 공통 검증 규칙

## 1. SAX 메시지 포맷 검증

### 1.1 기본 포맷

**규칙**: `[SAX] {Type}: {name} {action}`

**검증 방법**:
```regex
^\[SAX\] (Agent|Skill|Reference|Orchestrator): .+ (호출|사용|참조|위임|실행)
```

**위반 예시**:
- `[sax] Agent: ...` - 대소문자 오류
- `[SAX] agent-manager 호출` - Type 누락
- `SAX Agent: ...` - 대괄호 누락

### 1.2 Orchestrator 메시지

**필수 포맷**:
```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

## 2. Orchestrator-First Policy 검증

### 2.1 검증 항목

| 항목 | 기준 | 위반 조건 |
|------|------|----------|
| 첫 SAX 메시지 | `[SAX] Orchestrator:` | 다른 Type이 먼저 출력 |
| 의도 분석 | 의도 분석 완료 메시지 존재 | 메시지 없이 Agent 위임 |
| 라우팅 결정 | Agent 위임 또는 Skill 호출 | 직접 작업 수행 |

### 2.2 예외 사항

- 단순 질문 ("이게 뭐야?", "설명해줘")
- 일반 대화 (인사, 감사)
- 명시적 직접 요청 ("Orchestrator 없이 바로 해줘")

## 3. Routing-Only Policy 검증

### 3.1 허용 동작

- 의도 분석
- Agent 선택
- Agent 위임
- Skill 호출
- 워크플로우 안내 (간단한 정보 제공)

### 3.2 금지 동작

- 직접 코드 작성
- 직접 파일 생성/수정
- 직접 명세 작성
- 직접 구현

## 4. SoT (Single Source of Truth) 검증

### 4.1 SoT 위치 정의

| 정보 유형 | SoT 위치 | 참조 방식 |
|----------|---------|----------|
| SAX 핵심 원칙 | `sax-core/PRINCIPLES.md` | 링크 참조 |
| 메시지 규칙 | `sax-core/MESSAGE_RULES.md` | 링크 참조 |
| 팀 규칙 | `sax-core/TEAM_RULES.md` | 링크 참조 |
| 패키지 버전 | 각 패키지 `VERSION` 파일 | 직접 읽기 |

### 4.2 위반 예시

- CLAUDE.md에 PRINCIPLES.md 내용 복사
- Agent 문서에 MESSAGE_RULES.md 내용 복사
- 여러 Skill에 동일한 규칙 정의

## 5. 버저닝 완료 검증

### 5.1 검증 조건

Agent/Skill/Command 파일 변경이 감지되면 다음을 확인:

| 검증 항목 | 확인 방법 | 위반 조건 |
|----------|----------|----------|
| VERSION 파일 변경 | `git diff --name-only` | 변경 없음 |
| CHANGELOG 생성 | `ls CHANGELOG/v{version}.md` | 파일 없음 |

### 5.2 변경 파일 패턴

다음 경로의 파일 변경 시 버저닝 필수:

```text
{package}/agents/**/*.md
{package}/skills/**/*.md
{package}/commands/**/*.md
{package}/CLAUDE.md
```

### 5.3 위반 시 경고

```markdown
[SAX] Compliance Warning: 버저닝 미완료

⚠️ Agent/Skill/Command 변경이 감지되었으나 버저닝이 완료되지 않았습니다.

**변경된 파일**:
- {file_list}

**필요한 작업**:
1. `version-manager` 호출로 버전 업데이트
2. CHANGELOG 생성

버저닝 없이 커밋을 진행하시겠습니까? (권장하지 않음)
```

### 5.4 TodoWrite 자동 추가

버저닝이 필요한 변경 감지 시:

```json
{
  "content": "버저닝 처리 (version-manager 호출)",
  "status": "pending",
  "activeForm": "버저닝 처리 중"
}
```

> **🔴 이 항목이 완료되기 전까지 작업 완료로 간주하지 않음**

## 6. 세션 시작 시 version-updater 검증

### 6.1 검증 조건

새 세션 시작 시 version-updater 호출 여부 확인:

| 조건 | 필수 동작 |
|------|----------|
| 새 세션 + SAX 설치됨 | version-updater 호출 필수 |
| 기존 세션 계속 | 검증 불필요 |

### 6.2 위반 시 경고

```markdown
[SAX] Compliance Warning: 세션 시작 시 버전 체크 누락

⚠️ 새 세션에서 version-updater가 호출되지 않았습니다.

**필수 조치**: 지금 version-updater를 호출하세요.
```

## 7. 위반 심각도 정의

### ❌ CRITICAL (작업 중단 권장)

- SAX 메시지 포맷 오류
- Orchestrator-First Policy 위반
- SoT 원칙 위반 (명백한 중복)
- 세션 시작 시 version-updater 미호출

### ⚠️ WARNING (수정 권장)

- Routing-Only Policy 경미한 위반
- 기존 문서 확장 권장
- 버저닝 미완료 상태에서 커밋 시도

### 💡 INFO (참고용)

- 코드 스타일 권장사항
- 문서 구조 개선 제안
