---
name: workflow-start
description: |
  워크플로우 인스턴스 생성 및 시작. Use when (1) /SEMO:workflow:greenfield 커맨드,
  (2) 새 프로젝트 워크플로우 시작, (3) 워크플로우 인스턴스 초기화.
tools: [Bash, Read, Write, AskUserQuestion]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: workflow-start 호출` 메시지를 첫 줄에 출력하세요.

# workflow-start Skill

> 워크플로우 인스턴스 생성 및 첫 번째 노드 실행

## Purpose

DB에 새 워크플로우 인스턴스를 생성하고 첫 번째 노드부터 실행을 시작합니다.

## Workflow

```
워크플로우 시작 요청
    ↓
1. 워크플로우 정의 조회 (command_name으로)
2. 사용자에게 프로젝트 이름 입력 요청
3. workflow_instances에 INSERT
4. 첫 번째 노드 조회 (start_node_id)
5. 노드 실행 시작
    ↓
완료 (노드 실행 대기)
```

## Input

```yaml
workflow_command: "greenfield"    # 워크플로우 command_name
instance_name: "자동차 딜러 앱"   # 사용자 지정 프로젝트 이름 (없으면 질문)
```

## Output

```markdown
[SEMO] Skill: workflow-start 완료

✅ 워크플로우 인스턴스 생성

| 항목 | 값 |
|------|-----|
| 워크플로우 | BMad Greenfield Project |
| 인스턴스 이름 | 자동차 딜러 앱 |
| 시작 노드 | D0 (Include Discovery?) |

🔄 첫 번째 노드를 실행합니다...
```

## Execution Steps

### Step 1: 워크플로우 정의 조회

```sql
-- Supabase RPC 또는 직접 쿼리
SELECT id, name, start_node_id
FROM workflow_definitions
WHERE command_name = '{workflow_command}'
  AND is_active = true;
```

### Step 2: 프로젝트 이름 입력 (AskUserQuestion)

```yaml
questions:
  - question: "프로젝트 이름을 입력해주세요 (예: 자동차 딜러 앱)"
    header: "프로젝트명"
    options:
      - label: "직접 입력"
        description: "프로젝트 이름을 직접 입력합니다"
```

### Step 3: 인스턴스 생성

```sql
INSERT INTO workflow_instances (
  workflow_definition_id,
  instance_name,
  status,
  current_node_id
) VALUES (
  '{workflow_id}',
  '{instance_name}',
  'active',
  '{start_node_id}'
) RETURNING id;
```

### Step 4: 노드 실행 시작

```sql
SELECT start_workflow_node(
  '{instance_id}',
  '{start_node_id}',
  NULL  -- input_data
);
```

### Step 5: 노드 정보 조회 및 실행

```sql
SELECT
  node_key,
  name,
  node_type,
  skill_name,
  decision_config
FROM workflow_nodes
WHERE id = '{start_node_id}';
```

## Node Type 분기 처리

### Task 노드

해당 스킬 호출:
```
skill:{skill_name}
```

### Decision 노드

사용자에게 옵션 제시 (AskUserQuestion):
```yaml
questions:
  - question: "{decision_config.question}"
    header: "선택"
    options: # decision_config.options에서 동적 생성
      - label: "예"
        description: "Yes"
      - label: "아니오"
        description: "No"
```

선택 결과 저장 후 다음 노드로 이동:
```sql
SELECT complete_workflow_node(
  '{execution_id}',
  NULL,
  '{decision_result}'  -- 'yes' 또는 'no'
);
```

### Gateway 노드

즉시 다음 노드로 이동:
```sql
SELECT complete_workflow_node(
  '{execution_id}',
  NULL,
  NULL
);
```

## 완료 메시지

```markdown
[SEMO] Skill: workflow-start 완료

✅ **{instance_name}** 워크플로우 시작

| 항목 | 값 |
|------|-----|
| 워크플로우 | {workflow_name} |
| 인스턴스 ID | {instance_id} |
| 현재 단계 | {node_key}: {node_name} |
| Phase | {phase} |

진행 상황 확인: `skill:workflow-progress`
```

## Error Handling

| 에러 | 처리 |
|------|------|
| 워크플로우 없음 | "'{command_name}' 워크플로우를 찾을 수 없습니다" |
| 이미 실행 중 | "동일한 이름의 워크플로우가 이미 실행 중입니다" |
| 스킬 없음 | "'{skill_name}' 스킬을 찾을 수 없습니다" |

## Related Skills

- `workflow-progress` - 진행 상황 조회
- `workflow-resume` - 중단된 워크플로우 재개
