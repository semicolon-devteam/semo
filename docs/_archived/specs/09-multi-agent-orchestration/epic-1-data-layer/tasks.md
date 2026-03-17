# Multi-Agent Orchestration - Data Layer Tasks

## Task Overview

| ID | Layer | Task | Complexity | Dependencies |
|----|-------|------|------------|--------------|
| T1 | v0.1.x CONFIG | Supabase 마이그레이션 환경 확인 | S | - |
| T2 | v0.3.x DATA | agent_definitions 테이블 생성 | M | T1 |
| T3 | v0.3.x DATA | skill_definitions 테이블 생성 | M | T1 |
| T4 | v0.3.x DATA | default_agent/skill_templates 테이블 생성 | S | T1 |
| T5 | v0.3.x DATA | user_questions 테이블 생성 | M | T1 |
| T6 | v0.3.x DATA | agent_results 테이블 생성 | M | T1 |
| T7 | v0.3.x DATA | agent_invocations 테이블 생성 | M | T1 |
| T8 | v0.3.x DATA | workflow_instances/step_executions 테이블 생성 | M | T1 |
| T9 | v0.3.x DATA | agent_task_queue 테이블 생성 | S | T1 |
| T10 | v0.3.x DATA | RLS 정책 적용 | M | T2-T9 |
| T11 | v0.3.x DATA | 기본 에이전트 템플릿 시드 | M | T4, T10 |
| T12 | v0.3.x DATA | 기본 스킬 템플릿 시드 | M | T4, T10 |

## Task Details

### T1: [v0.1.x CONFIG] Supabase 마이그레이션 환경 확인
- **Complexity**: S (Small)
- **Dependencies**: -
- **Description**: 기존 마이그레이션 파일 번호 체계 확인, Supabase CLI 연결 테스트
- **Acceptance Criteria**:
  - [ ] `supabase status` 명령 정상 실행
  - [ ] 기존 마이그레이션 파일 목록 확인
  - [ ] 새 마이그레이션 번호 결정 (타임스탬프 또는 순차)

### T2: [v0.3.x DATA] agent_definitions 테이블 생성
- **Complexity**: M (Medium)
- **Dependencies**: T1
- **Description**: 에이전트 정의를 저장하는 테이블 생성
- **Acceptance Criteria**:
  - [ ] `agent_definitions` 테이블 생성
  - [ ] `office_id` FK 설정 (CASCADE DELETE)
  - [ ] `(office_id, name)` UNIQUE 제약 추가
  - [ ] `frontmatter` JSONB 컬럼 추가
  - [ ] `created_at`, `updated_at` 타임스탬프 추가

```sql
CREATE TABLE agent_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  definition_content TEXT NOT NULL,
  frontmatter JSONB,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(office_id, name)
);
```

### T3: [v0.3.x DATA] skill_definitions 테이블 생성
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 스킬 정의를 저장하는 테이블 생성
- **Acceptance Criteria**:
  - [ ] `skill_definitions` 테이블 생성
  - [ ] `references` JSONB 배열 컬럼 추가
  - [ ] `(office_id, name)` UNIQUE 제약 추가

```sql
CREATE TABLE skill_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skill_content TEXT NOT NULL,
  references JSONB,
  frontmatter JSONB,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(office_id, name)
);
```

### T4: [v0.3.x DATA] default_agent/skill_templates 테이블 생성
- **Complexity**: S
- **Dependencies**: T1
- **Description**: 기본 템플릿 테이블 생성 (Office 생성 시 복사용)
- **Acceptance Criteria**:
  - [ ] `default_agent_templates` 테이블 생성
  - [ ] `default_skill_templates` 테이블 생성
  - [ ] `name` UNIQUE 제약 추가

### T5: [v0.3.x DATA] user_questions 테이블 생성
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 에이전트 → 사용자 질문 대기열 테이블
- **Acceptance Criteria**:
  - [ ] `question_type` 컬럼 (text, selection, confirmation)
  - [ ] `options` JSONB 컬럼 (선택지)
  - [ ] `status` 컬럼 (pending, answered, timeout)
  - [ ] `expires_at` 타임스탬프 컬럼

```sql
CREATE TABLE user_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id),
  workflow_instance_id UUID,
  agent_id UUID REFERENCES office_agents(id) NOT NULL,
  question_type TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB,
  context JSONB,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  response TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ
);
```

### T6: [v0.3.x DATA] agent_results 테이블 생성
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 에이전트 간 결과물 전달 테이블
- **Acceptance Criteria**:
  - [ ] `from_agent_id`, `to_agent_id` FK
  - [ ] `result_type` 컬럼 (artifact, message, approval_request)
  - [ ] `content_type` 컬럼 (github_issue, markdown, json, file_path)
  - [ ] `status` 컬럼 (pending, delivered, acknowledged)

### T7: [v0.3.x DATA] agent_invocations 테이블 생성
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 에이전트 호출 기록 테이블
- **Acceptance Criteria**:
  - [ ] `caller_agent_id`, `callee_agent_id` FK
  - [ ] `status` 컬럼 (pending, accepted, in_progress, completed, rejected)
  - [ ] `caller_position_x`, `caller_position_y` 컬럼 (애니메이션용)

### T8: [v0.3.x DATA] workflow_instances/step_executions 테이블 생성
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 워크플로우 실행 인스턴스 및 단계 실행 기록
- **Acceptance Criteria**:
  - [ ] `workflow_instances` 테이블 생성
  - [ ] `workflow_step_executions` 테이블 생성
  - [ ] `instance_id` FK 관계 설정

### T9: [v0.3.x DATA] agent_task_queue 테이블 생성
- **Complexity**: S
- **Dependencies**: T1
- **Description**: 에이전트 작업 대기열 테이블
- **Acceptance Criteria**:
  - [ ] `priority` 컬럼
  - [ ] `status` 컬럼 (queued, processing, completed)

### T10: [v0.3.x DATA] RLS 정책 적용
- **Complexity**: M
- **Dependencies**: T2-T9
- **Description**: 모든 테이블에 Row Level Security 정책 적용
- **Acceptance Criteria**:
  - [ ] `office_id` 기반 SELECT 정책
  - [ ] `office_id` 기반 INSERT/UPDATE/DELETE 정책
  - [ ] service_role은 전체 접근 허용

```sql
ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own office agents"
  ON agent_definitions FOR SELECT
  USING (office_id IN (
    SELECT office_id FROM office_members WHERE user_id = auth.uid()
  ));
```

### T11: [v0.3.x DATA] 기본 에이전트 템플릿 시드
- **Complexity**: M
- **Dependencies**: T4, T10
- **Description**: 6개 기본 에이전트 템플릿 등록
- **Acceptance Criteria**:
  - [ ] Orchestrator 템플릿
  - [ ] PO (Product Owner) 템플릿
  - [ ] PM (Project Manager) 템플릿
  - [ ] FE (Frontend Developer) 템플릿
  - [ ] BE (Backend Developer) 템플릿
  - [ ] QA (Quality Assurance) 템플릿

### T12: [v0.3.x DATA] 기본 스킬 템플릿 시드
- **Complexity**: M
- **Dependencies**: T4, T10
- **Description**: 3개 기본 스킬 템플릿 등록
- **Acceptance Criteria**:
  - [ ] write-code 스킬 템플릿
  - [ ] git-workflow 스킬 템플릿
  - [ ] ask-user 스킬 템플릿

## Test Requirements

### 엔지니어 테스트
- [ ] 마이그레이션 적용 후 모든 테이블 존재 확인
- [ ] FK 제약 조건 테스트 (CASCADE DELETE)
- [ ] UNIQUE 제약 조건 테스트
- [ ] RLS 정책 테스트 (다른 Office 데이터 접근 불가)
- [ ] 시드 데이터 조회 확인

### 검증 명령어
```bash
# 마이그레이션 적용
supabase migration up

# 테이블 목록 확인
psql -c "\dt"

# 시드 데이터 확인
psql -c "SELECT name, role FROM default_agent_templates;"
psql -c "SELECT name FROM default_skill_templates;"
```
