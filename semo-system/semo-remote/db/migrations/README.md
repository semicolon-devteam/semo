# Supabase Migrations

## 마이그레이션 실행 방법

### 1. Supabase CLI 사용 (권장)

```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 링크
supabase link --project-ref YOUR_PROJECT_REF

# 마이그레이션 실행
supabase db push
```

### 2. Supabase Dashboard SQL Editor

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택 → SQL Editor
3. 마이그레이션 파일 내용 복사 후 실행

### 3. psql 직접 실행

```bash
psql postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres \
  -f migrations/004_office_tables.sql
```

## 마이그레이션 파일 목록

| 파일 | 설명 | 상태 |
|------|------|------|
| `001_initial.sql` | 초기 스키마 (remote_sessions 등) | 적용됨 |
| `002_memory_tables.sql` | 메모리 시스템 테이블 | 적용됨 |
| `003_feedback_tables.sql` | 피드백 테이블 | 적용됨 |
| `004_office_tables.sql` | **Semo Office 테이블** | **신규** |

## 004_office_tables.sql 상세

### 테이블

| 테이블 | 설명 |
|--------|------|
| `offices` | 가상 오피스 (GitHub 레포 매핑) |
| `agent_personas` | Agent 페르소나 정의 |
| `custom_skills` | 오피스별 커스텀 스킬 |
| `worktrees` | Git Worktree 상태 |
| `office_agents` | Agent 인스턴스 |
| `job_queue` | 작업 큐 (의존성 관리) |
| `agent_messages` | Agent 간 메시지 |

### 기본 페르소나 (7개)

마이그레이션 실행 시 다음 페르소나가 자동 생성됩니다:

- PO (박기획)
- PM (김매니저)
- Architect (이설계)
- FE (김프론트)
- BE (이백엔드)
- QA (최큐에이)
- DevOps (정데봅스)

### RLS 정책

모든 테이블에 Row Level Security가 활성화됩니다.
실제 운영 시 적절한 정책을 추가해야 합니다.

```sql
-- 예: 인증된 사용자만 접근 허용
CREATE POLICY "Allow authenticated users"
ON offices FOR ALL
TO authenticated
USING (true);
```

## 롤백

```sql
-- Office 테이블 전체 삭제 (주의!)
DROP TABLE IF EXISTS agent_messages CASCADE;
DROP TABLE IF EXISTS job_queue CASCADE;
DROP TABLE IF EXISTS office_agents CASCADE;
DROP TABLE IF EXISTS worktrees CASCADE;
DROP TABLE IF EXISTS custom_skills CASCADE;
DROP TABLE IF EXISTS agent_personas CASCADE;
DROP TABLE IF EXISTS offices CASCADE;
```
