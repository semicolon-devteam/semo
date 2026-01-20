# SEMO v3.12 워크플로우 테스트 가이드

## 개요

이 문서는 SEMO v3.12에서 추가된 BMad Greenfield Workflow 시스템을 설치부터 테스트하는 방법을 설명합니다.

---

## 1. 설치 준비

### 사전 요구사항

```bash
# Node.js 18+ 확인
node --version  # v18.0.0 이상

# npm 최신 버전
npm --version

# Claude Code 설치 확인
claude --version
```

### Supabase 설정

```bash
# Supabase CLI 설치
npm i -g supabase

# 프로젝트 연결 (또는 로컬 Supabase)
supabase login
supabase link --project-ref <your-project-ref>
```

---

## 2. CLI 설치 및 프로젝트 초기화

### 옵션 A: npm 배포판 설치 (권장)

```bash
# 최신 CLI 설치
npm i -g @team-semicolon/semo-cli@latest

# 버전 확인
semo --version  # 3.12.0

# 새 프로젝트에서 초기화
mkdir test-project && cd test-project
semo init
```

### 옵션 B: 로컬 개발 버전 테스트

```bash
# semo 모노레포 클론
git clone https://github.com/semicolon-devteam/semo.git
cd semo

# CLI 빌드
cd packages/cli
npm install
npm run build

# 로컬 CLI로 초기화 (다른 프로젝트에서)
cd /path/to/test-project
node /path/to/semo/packages/cli/dist/index.js init
```

---

## 3. DB 마이그레이션

### Supabase Cloud

```bash
# 마이그레이션 실행
supabase db push
```

### 또는 SQL 직접 실행

Supabase 대시보드 → SQL Editor에서 실행:

1. `supabase/migrations/20260120000_bmad_workflow_nodes.sql`
2. `supabase/migrations/20260120001_bmad_greenfield_seed.sql`

### 마이그레이션 확인

```sql
-- 워크플로우 정의 확인
SELECT * FROM workflow_definitions WHERE command_name = 'greenfield';

-- 노드 확인 (22개)
SELECT node_key, name, phase, node_type
FROM workflow_nodes
ORDER BY phase, node_key;

-- 에지 확인
SELECT
  sn.node_key AS source,
  tn.node_key AS target,
  e.condition
FROM workflow_edges e
JOIN workflow_nodes sn ON sn.id = e.source_node_id
JOIN workflow_nodes tn ON tn.id = e.target_node_id;
```

---

## 4. 설치 검증

### CLI 검증 명령

```bash
semo verify
```

예상 출력:
```
🔍 설치 검증
  ✓ agents: 6/6
  ✓ skills: 18/18
  ✓ commands/SEMO
```

### 수동 검증

```bash
# 심링크 확인
ls -la .claude/commands/SEMO/
ls -la .claude/commands/SEMO/workflow/  # 중첩 폴더

# 새 스킬 확인
ls .claude/skills/ | grep workflow
# workflow-start
# workflow-progress
# workflow-resume

ls .claude/skills/ | grep design
# design-user-flow
# design-tests
```

---

## 5. 워크플로우 테스트

### 5.1 커맨드 호출 테스트

Claude Code에서:

```
/SEMO:workflow:greenfield
```

예상 동작:
1. `[SEMO] Skill: workflow-start 호출` 메시지 출력
2. 프로젝트 이름 입력 요청
3. DB에 workflow_instances 레코드 생성
4. Phase 1 첫 번째 노드(D0: Include Discovery?)로 이동

### 5.2 진행 상황 조회 테스트

```
skill:workflow-progress
```

예상 출력:
```
[SEMO] Skill: workflow-progress 호출

📊 워크플로우 진행 현황

| 프로젝트 | 현재 단계 | Phase | 진행률 |
|----------|-----------|-------|--------|
| 내 프로젝트 | D0: Include Discovery? | discovery | 0/22 (0%) |
```

### 5.3 워크플로우 재개 테스트

```
skill:workflow-resume
```

### 5.4 UX 설계 스킬 테스트

```
skill:design-user-flow
```

### 5.5 테스트 설계 스킬 테스트

```
skill:design-tests
```

---

## 6. DB 데이터 검증

### 워크플로우 인스턴스 확인

```sql
SELECT
  wi.id,
  wi.instance_name,
  wn.node_key,
  wn.name AS current_step,
  wn.phase,
  wi.status
FROM workflow_instances wi
LEFT JOIN workflow_nodes wn ON wn.id = wi.current_node_id
ORDER BY wi.created_at DESC;
```

### 노드 실행 히스토리 확인

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
WHERE wne.workflow_instance_id = '<instance_id>'
ORDER BY wne.created_at;
```

---

## 7. 트러블슈팅

### 심링크 오류

```bash
# 심링크 재생성
semo update --force
```

### DB 연결 오류

```bash
# 환경 변수 확인
echo $SEMO_SUPABASE_URL
echo $SEMO_SUPABASE_ANON_KEY
```

### 커맨드 인식 안됨

```bash
# Claude Code 재시작 후 다시 시도
claude

# 커맨드 폴더 확인
ls -la .claude/commands/SEMO/workflow/
```

---

## 8. 체크리스트

### 설치 검증
- [ ] `semo init` 성공
- [ ] `.claude/commands/SEMO/workflow/greenfield.md` 존재
- [ ] `.claude/skills/workflow-start/` 존재
- [ ] `.claude/skills/workflow-progress/` 존재
- [ ] `.claude/skills/workflow-resume/` 존재
- [ ] `.claude/skills/design-user-flow/` 존재
- [ ] `.claude/skills/design-tests/` 존재

### DB 검증
- [ ] `workflow_nodes` 테이블 22개 노드
- [ ] `workflow_edges` 테이블 연결 정의
- [ ] `workflow_definitions` command_name = 'greenfield'

### 기능 검증
- [ ] `/SEMO:workflow:greenfield` 커맨드 동작
- [ ] `skill:workflow-progress` 동작
- [ ] `skill:workflow-resume` 동작
- [ ] `skill:design-user-flow` 동작
- [ ] `skill:design-tests` 동작

---

## 관련 문서

- [BMad Greenfield Workflow 설계](../semo-system/semo-core/commands/SEMO/workflow/greenfield.md)
- [워크플로우 스킬 문서](../semo-system/semo-skills/)
- [CHANGELOG](../packages/cli/CHANGELOG/3.12.0.md)
