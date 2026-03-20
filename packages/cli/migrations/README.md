# Migrations

SEMO CLI의 PostgreSQL 마이그레이션 파일들.
`semo db migrate` 명령으로 순차 적용됩니다.

## 마이그레이션 목록

| 파일 | 설명 |
|------|------|
| `001_initial.sql` | 초기 스키마 (skill/agent/command_definitions, bot_status 등) |
| `002_add_indexes.sql` | 조회 성능 인덱스 추가 |
| `003_add_fk.sql` | FK 제약조건 추가 |
| `004_session_count_trigger.sql` | 봇 세션 카운트 트리거 |
| `005_bot_workspace_audits.sql` | Bot workspace 감사 테이블 |
| `006_bot_kb_subscriptions.sql` | 봇별 KB 구독 테이블 |
| `007_flatten_skill_names.sql` | Flat skill naming 마이그레이션 |

## 007: Flat Skill Naming

`skill_definitions` 테이블의 스킬 이름/메타데이터 구조를 변경합니다.

### 배경

Claude Code는 `~/.claude/skills/{skillName}/SKILL.md` (1-depth)만 인식합니다.
기존에는 `{botId}/{skillName}` (예: `semiclaw/kb-manager`)으로 저장하여 2-depth 구조가 되어 로드 불가했습니다.

### 변경 내용

**Step 1: `metadata.bot_id` → `metadata.bot_ids` 배열 변환**

```sql
-- Before: { "bot_id": "semiclaw" }
-- After:  { "bot_ids": ["semiclaw"] }

UPDATE skill_definitions
SET metadata = (metadata - 'bot_id')
  || jsonb_build_object('bot_ids', jsonb_build_array(metadata->>'bot_id'))
WHERE metadata ? 'bot_id';
```

**Step 2: name에서 `botId/` 프리픽스 제거**

```sql
-- Before: 'semiclaw/kb-manager'
-- After:  'kb-manager'

UPDATE skill_definitions
SET name = SUBSTRING(name FROM POSITION('/' IN name) + 1)
WHERE name LIKE '%/%'
  AND office_id IS NULL;
```

### 적용

```bash
semo db migrate
```

### 검증

```bash
# DB 확인: flat name + bot_ids
psql -c "SELECT name, metadata->'bot_ids' FROM skill_definitions WHERE office_id IS NULL;"

# 글로벌 캐시 재생성
semo context sync

# 1-depth 구조 확인
ls ~/.claude/skills/
```

### 롤백

이 마이그레이션은 비파괴적이지만 되돌리려면:

```sql
-- bot_ids → bot_id 복원 (첫 번째 봇만)
UPDATE skill_definitions
SET metadata = (metadata - 'bot_ids')
  || jsonb_build_object('bot_id', metadata->'bot_ids'->>0)
WHERE metadata ? 'bot_ids';

-- name에 botId/ 프리픽스 복원
UPDATE skill_definitions
SET name = (metadata->>'bot_id') || '/' || name
WHERE metadata ? 'bot_id'
  AND office_id IS NULL;
```
