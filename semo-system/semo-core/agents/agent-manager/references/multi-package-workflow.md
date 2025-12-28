# Multi-Package Workflow

> 복수 패키지 접두사 명령 처리 가이드

## 패키지 접두사 시스템

SEMO-Meta는 패키지별 또는 전체 패키지를 대상으로 작업할 수 있는 접두사 시스템을 지원합니다.

### 접두사 형식

| 접두사 | 대상 | 예시 |
|--------|------|------|
| `[po]` | semo-po 패키지만 | `[po] 새 Agent 추가해줘` |
| `[next]` | semo-next 패키지만 | `[next] Agent 수정해줘` |
| `[core]` | semo-core 패키지만 | `[core] 원칙 추가해줘` |
| `[meta]` | semo-meta 패키지만 | `[meta] Agent 삭제해줘` |
| `[po \| next]` | 복수 패키지 지정 | `[po \| next] 새 Agent 추가해줘` |
| `[all]` | 모든 패키지 | `[all] Agent 검토해줘` |
| (없음) | 문맥 기반 판단 | `새 Agent 추가해줘` |

### 복수 패키지 지정 (파이프 구문)

`|` (파이프)를 사용하여 여러 패키지를 동시에 지정할 수 있습니다.

**예시**:

- `[po | next]` → semo-po와 semo-next
- `[core | meta]` → semo-core와 semo-meta
- `[po | next | meta]` → semo-po, semo-next, semo-meta

## Multi-Package 워크플로우

### Step 1: 접두사 파싱

사용자 요청에서 패키지 접두사를 추출합니다.

```text
입력: "[po | next] 새 Agent 추가해줘"
파싱 결과:
  - 대상 패키지: ['semo-po', 'semo-next']
  - 작업: "새 Agent 추가해줘"
```

### Step 2: 패키지별 경로 매핑

| 패키지 | agents/ 경로 |
|--------|-------------|
| semo-po | `semo-po/agents/` |
| semo-next | `semo-next/agents/` |
| semo-meta | `semo-meta/agents/` |
| semo-core | `semo-core/` (agents 없음) |

### Step 3: 순차 실행 (권장)

복수 패키지 대상 작업 시 **순차적으로** 처리합니다.

**이유**:

- 패키지 간 일관성 유지
- 에러 발생 시 개별 롤백 가능
- 진행 상황 명확한 추적

**실행 순서**:

1. 첫 번째 패키지 작업 완료
2. 결과 확인 및 검증
3. 두 번째 패키지 동일 작업 적용
4. 반복...
5. 전체 완료 보고

### Step 4: SEMO 메시지 출력

복수 패키지 작업 시 진행 상황을 명확히 출력합니다.

```markdown
[SEMO] Agent: agent-manager 호출 - Multi-Package Agent 생성

📦 **대상 패키지**: semo-po, semo-next

---

## 1/2: semo-po

[SEMO] Agent: agent-manager 호출 - Agent 생성

✅ semo-po/agents/{agent-name}.md 생성 완료

---

## 2/2: semo-next

[SEMO] Agent: agent-manager 호출 - Agent 생성

✅ semo-next/agents/{agent-name}.md 생성 완료

---

[SEMO] Multi-Package 작업 완료

**결과**:
- semo-po: ✅ 성공
- semo-next: ✅ 성공

**생성된 파일**:
- `semo-po/agents/{agent-name}.md`
- `semo-next/agents/{agent-name}.md`
```

## 에러 처리

### 부분 실패 시

일부 패키지에서 에러 발생 시 중단하고 보고합니다.

```markdown
[SEMO] Multi-Package 작업 중단

⚠️ **부분 실패**

**성공**:
- semo-po: ✅ 완료

**실패**:
- semo-next: ❌ 에러 (이미 동일 이름의 Agent 존재)

**조치 필요**:
1. 에러 원인 확인 후 재시도
2. 또는 성공한 패키지의 변경사항 롤백

어떻게 진행할까요?
```

### 롤백 옵션

```markdown
[SEMO] 롤백 옵션

1. **전체 롤백**: 성공한 패키지의 변경도 취소
2. **부분 유지**: 성공한 패키지는 유지, 실패한 패키지만 재시도
3. **수동 처리**: 사용자가 직접 개별 패키지 처리

선택해주세요.
```

## 패키지별 차이점 처리

동일한 Agent라도 패키지별로 다른 설정이 필요할 수 있습니다.

### 예시: feedback Agent

| 패키지 | 차이점 |
|--------|--------|
| semo-po | `--repo semicolon-devteam/semo-po` |
| semo-next | `--repo semicolon-devteam/semo-next` |
| semo-meta | `--repo semicolon-devteam/semo-meta` |

### 처리 방식

1. **템플릿 기반**: 공통 구조는 템플릿으로, 패키지별 변수만 교체
2. **확인 질문**: 패키지별 다른 설정이 필요한 경우 사용자에게 확인

```markdown
[SEMO] 패키지별 설정 확인 필요

**{agent-name}** Agent의 GitHub 레포지토리 설정:

- semo-po: `semicolon-devteam/semo-po` (기본값)
- semo-next: `semicolon-devteam/semo-next` (기본값)

기본값으로 진행할까요? 또는 개별 설정이 필요하신가요?
```

## Reference

- [CLAUDE.md - 패키지 접두사 명령 규칙](../../../CLAUDE.md#4-패키지-접두사-명령-규칙)
- [workflow-phases.md](workflow-phases.md) - Agent 생성 워크플로우
