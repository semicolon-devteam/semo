---
name: workflow-resume
description: |
  중단된 워크플로우 재개. Use when (1) 일시정지된 워크플로우 계속,
  (2) 세션 복구 후 워크플로우 재시작, (3) 이전 진행 상황에서 계속.
tools: [Bash, Read, Write, AskUserQuestion]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: workflow-resume 호출` 메시지를 첫 줄에 출력하세요.

# workflow-resume Skill

> 중단된 워크플로우 인스턴스 재개

## Purpose

일시정지되었거나 세션 종료로 중단된 워크플로우를 마지막 진행 지점부터 재개합니다.

## Workflow

```
워크플로우 재개 요청
    ↓
1. 인스턴스 상태 확인
2. 현재 노드 조회
3. 컨텍스트 복원
4. 노드 실행 재개
    ↓
완료 (노드 실행 계속)
```

## Input

```yaml
instance_id: "uuid"           # 인스턴스 ID (필수)
# 또는
instance_name: "자동차 딜러 앱" # 인스턴스 이름으로 검색
```

## Output

```markdown
[SEMO] Skill: workflow-resume 완료

🔄 **워크플로우 재개**

| 항목 | 값 |
|------|-----|
| 프로젝트 | 자동차 딜러 앱 |
| 워크플로우 | BMad Greenfield Project |
| 재개 노드 | I5: Write Code |
| Phase | implementation |
| 진행률 | 14/22 (63.6%) |

▶️ 현재 노드를 계속 실행합니다...
```

## Execution Steps

### Step 1: 인스턴스 조회

```sql
SELECT
  wi.id,
  wi.instance_name,
  wi.status,
  wi.current_node_id,
  wi.context,
  wd.name AS workflow_name
FROM workflow_instances wi
JOIN workflow_definitions wd ON wd.id = wi.workflow_definition_id
WHERE wi.id = '{instance_id}'
   OR wi.instance_name ILIKE '%{instance_name}%';
```

### Step 2: 상태 확인

| 상태 | 처리 |
|------|------|
| active | 현재 노드 계속 실행 |
| paused | 상태를 active로 변경 후 실행 |
| completed | "이미 완료된 워크플로우입니다" |
| failed | 실패 원인 확인 후 재시도 여부 질문 |
| cancelled | "취소된 워크플로우입니다. 새로 시작하시겠습니까?" |

### Step 3: 현재 노드 정보 조회

```sql
SELECT
  wn.node_key,
  wn.name,
  wn.node_type,
  wn.skill_name,
  wn.decision_config,
  wn.phase,
  wne.status AS execution_status,
  wne.id AS execution_id
FROM workflow_nodes wn
LEFT JOIN workflow_node_executions wne ON wne.node_id = wn.id
  AND wne.workflow_instance_id = '{instance_id}'
  AND wne.status IN ('running', 'pending')
WHERE wn.id = '{current_node_id}';
```

### Step 4: 상태 업데이트 (paused인 경우)

```sql
UPDATE workflow_instances
SET status = 'active',
    started_at = COALESCE(started_at, now())
WHERE id = '{instance_id}'
  AND status = 'paused';
```

### Step 5: 노드 실행 재개

#### 이미 running 상태인 노드

해당 스킬 재실행:
```
skill:{skill_name}
```

#### pending 상태인 노드

새로 실행 시작:
```sql
SELECT start_workflow_node(
  '{instance_id}',
  '{current_node_id}',
  '{context}'::jsonb
);
```

## Context 복원

```sql
-- 이전 노드들의 output_data를 컨텍스트로 수집
SELECT
  wn.node_key,
  wne.output_data
FROM workflow_node_executions wne
JOIN workflow_nodes wn ON wn.id = wne.node_id
WHERE wne.workflow_instance_id = '{instance_id}'
  AND wne.status = 'completed'
ORDER BY wne.completed_at;
```

## 중복 인스턴스 선택

동일 이름의 인스턴스가 여러 개인 경우:

```yaml
questions:
  - question: "재개할 워크플로우를 선택해주세요"
    header: "선택"
    options:
      - label: "자동차 딜러 앱 (I5: Write Code)"
        description: "생성: 2025-01-20 10:00, 진행률: 63%"
      - label: "자동차 딜러 앱 (P1: Create PRD)"
        description: "생성: 2025-01-19 15:00, 진행률: 9%"
```

## 완료 메시지

```markdown
[SEMO] Skill: workflow-resume 완료

✅ **{instance_name}** 워크플로우 재개

| 항목 | 값 |
|------|-----|
| 현재 단계 | {node_key}: {node_name} |
| Phase | {phase} |
| 진행률 | {completed}/{total} ({percentage}%) |

▶️ {node_type == 'decision' ? '선택을 기다리는 중...' : '스킬 실행 중...'}
```

## Error Handling

| 에러 | 처리 |
|------|------|
| 인스턴스 없음 | "워크플로우를 찾을 수 없습니다" |
| 이미 완료됨 | "이미 완료된 워크플로우입니다" |
| 노드 없음 | "현재 노드 정보가 없습니다. 워크플로우를 새로 시작해주세요" |

## Related Skills

- `workflow-start` - 워크플로우 시작
- `workflow-progress` - 진행 상황 조회
