---
name: workflow-progress
description: |
  워크플로우 진행 상황 조회. Use when (1) 현재 워크플로우 진행도 확인,
  (2) 워크플로우 히스토리 조회, (3) 진행 중인 워크플로우 목록.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: workflow-progress 호출` 메시지를 첫 줄에 출력하세요.

# workflow-progress Skill

> 워크플로우 인스턴스 진행 상황 조회

## Purpose

실행 중인 워크플로우의 진행 상황, 히스토리, 현재 단계를 조회합니다.

## Workflow

```
진행 상황 조회 요청
    ↓
1. 조회 타입 결정 (목록/상세)
2. DB에서 진행 상황 조회
3. 결과 포맷팅
    ↓
완료
```

## Input

```yaml
# 전체 목록 조회 (기본)
mode: "list"

# 특정 인스턴스 상세 조회
mode: "detail"
instance_id: "uuid"  # 또는 instance_name으로 검색
```

## Output

### 목록 조회

```markdown
[SEMO] Skill: workflow-progress 완료

📋 **진행 중인 워크플로우**

| 프로젝트 | 워크플로우 | 현재 단계 | Phase | 상태 |
|----------|-----------|-----------|-------|------|
| 자동차 딜러 앱 | greenfield | I5: Write Code | implementation | active |
| 커머스 MVP | greenfield | S4: Generate Spec | solutioning | active |
| 레거시 개선 | brownfield | P2: Has UI? | planning | paused |

총 3개 워크플로우 진행 중
```

### 상세 조회

```markdown
[SEMO] Skill: workflow-progress 완료

📊 **워크플로우 진행 현황**

**프로젝트**: 자동차 딜러 앱
**워크플로우**: BMad Greenfield Project
**상태**: active
**진행률**: 14/22 노드 (63.6%)

---

### 📈 Phase별 진행

| Phase | 상태 | 노드 |
|-------|------|------|
| Discovery | ✅ 완료 | D0, D1 |
| Planning | ✅ 완료 | P1, P2, P3, P4 |
| Solutioning | ✅ 완료 | S1, S2, S3, S4, S5, S6, S7 |
| Implementation | 🔄 진행중 | I1, I2, I3, I4, **I5** |

---

### 📜 실행 히스토리

| 노드 | 이름 | 상태 | 결과 | 완료 시간 |
|------|------|------|------|-----------|
| D0 | Include Discovery? | ✅ | yes | 10:30 |
| D1 | Ideate | ✅ | - | 10:45 |
| P1 | Create PRD/Epic | ✅ | - | 11:00 |
| ... | ... | ... | ... | ... |
| I5 | Write Code | 🔄 | - | - |
```

## SQL Queries

### 목록 조회

```sql
SELECT
  wi.id,
  wi.instance_name,
  wd.name AS workflow_name,
  wd.command_name,
  wn.node_key,
  wn.name AS current_step,
  wn.phase,
  wi.status,
  wi.created_at
FROM workflow_instances wi
JOIN workflow_definitions wd ON wd.id = wi.workflow_definition_id
LEFT JOIN workflow_nodes wn ON wn.id = wi.current_node_id
WHERE wi.status IN ('active', 'paused')
ORDER BY wi.created_at DESC
LIMIT 20;
```

### 상세 조회 (히스토리)

```sql
SELECT
  wn.node_key,
  wn.name,
  wn.phase,
  wne.status,
  wne.decision_result,
  wne.completed_at
FROM workflow_node_executions wne
JOIN workflow_nodes wn ON wn.id = wne.node_id
WHERE wne.workflow_instance_id = '{instance_id}'
ORDER BY wne.created_at;
```

### 진행률 계산

```sql
SELECT
  (SELECT COUNT(*) FROM workflow_node_executions
   WHERE workflow_instance_id = '{instance_id}'
     AND status = 'completed') AS completed_nodes,
  (SELECT COUNT(*) FROM workflow_nodes
   WHERE workflow_id = '{workflow_id}') AS total_nodes;
```

## View 활용

```sql
-- workflow_instance_status 뷰 사용
SELECT * FROM workflow_instance_status
WHERE status = 'active';
```

## 완료 메시지

```markdown
[SEMO] Skill: workflow-progress 완료

{progress_table}

💡 워크플로우 재개: `skill:workflow-resume {instance_id}`
```

## Related Skills

- `workflow-start` - 워크플로우 시작
- `workflow-resume` - 중단된 워크플로우 재개
