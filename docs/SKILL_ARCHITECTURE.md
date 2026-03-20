# 스킬 아키텍처

> 스킬/커맨드/에이전트의 저장, 동기화, 배포 구조

---

## 1. 흐름도

```
skill_definitions (DB — Single Source of Truth)
command_definitions
agent_definitions
         │
         │  semo context sync (SessionStart 훅 자동 실행)
         ▼
~/.claude/skills/         ← 글로벌 캐시 (full replace)
~/.claude/commands/
~/.claude/agents/
         │
         │  Claude Code 세션 시작 시 자동 로드
         ▼
Claude Code 세션에서 사용
```

**봇 전용 스킬** (역방향):
```
semo-system/bot-workspaces/{봇}/skills/*/SKILL.md
         │
         │  semo context sync → syncSkillsToDB()
         ▼
skill_definitions (target_agents = '{봇ID}')
```

---

## 2. DB 테이블 구조

### skill_definitions

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `name` | TEXT | 스킬 이름 (PK with office_id) |
| `prompt` | TEXT | SKILL.md 전문 (frontmatter + 본문) |
| `package` | TEXT | 소속 패키지 (`semo-core`, `openclaw` 등) |
| `target_agents` | TEXT[] | 대상 (`{all}` = 공유, `{botId}` = 봇 전용) |
| `is_active` | BOOLEAN | 활성 여부 |
| `metadata` | JSONB | 추가 메타데이터 |
| `office_id` | UUID | 사무실 ID (NULL = 글로벌) |

### command_definitions

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `name` | TEXT | 커맨드 이름 |
| `folder` | TEXT | 슬래시 커맨드 폴더 (예: `SEMO`) |
| `content` | TEXT | 커맨드 본문 |
| `is_active` | BOOLEAN | 활성 여부 |

### agent_definitions

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `name` | TEXT | 에이전트 이름 |
| `content` | TEXT | 에이전트 정의 본문 |
| `package` | TEXT | 소속 패키지 |
| `is_active` | BOOLEAN | 활성 여부 |

---

## 3. 공유 vs 봇 전용

| 구분 | target_agents | 저장소 | 동기화 방향 |
|------|---------------|--------|-------------|
| 공유 스킬 | `{all}` | DB만 | DB → 파일 (SessionStart) |
| 봇 전용 스킬 | `{botId}` | 파일 + DB | 파일 → DB (`syncSkillsToDB`) |

- 공유 스킬은 DB에서만 관리하며, `semo-system/semo-skills/` 디렉토리는 삭제됨
- 봇 전용 스킬은 `bot-workspaces/` 파일시스템에서 관리하되, DB에도 동기화

---

## 4. 동기화 흐름

### SessionStart (DB → 파일)

`semo context sync` 실행 시:

1. KB domains → `~/.claude/memory/*.md`
2. bot_status → `~/.claude/memory/bots.md`
3. ontology → `~/.claude/memory/ontology.md`
4. 봇 스킬 파일 → `skill_definitions` (파일→DB)
5. **`skill/command/agent_definitions` → `~/.claude/{skills,commands,agents}/`** (DB→파일)
6. **KB 변경 다이제스트 → `kb-digest.md`** (`--bot` + `--digest` 조합 시에만)

Step 5는 `syncGlobalCache()` (`packages/cli/src/global-cache.ts`)가 처리:
- `Promise.all()`로 3개 테이블 병렬 조회
- 기존 디렉토리 삭제 → 재생성 → 파일 쓰기 (full replace)
- `--no-global-cache` 옵션으로 스킵 가능

Step 6는 `kbDigest()` (`packages/cli/src/kb.ts`)가 처리:
- `bot_kb_subscriptions` 테이블에서 구독 도메인 + `last_synced_at` 워터마크 조회
- 도메인별 `knowledge_base WHERE updated_at > last_synced_at` 변경분 쿼리
- 워터마크 갱신 (`last_synced_at = NOW()`)
- 봇 훅에서만 사용 (로컬 Claude Code 세션에서는 `--bot` 없으므로 실행 안 됨)

### Onboarding (1회성)

`semo onboarding` 실행 시에도 동일한 `syncGlobalCache()`를 호출.

---

## 5. Fallback 정책

| 실패 시나리오 | 동작 |
|---------------|------|
| DB 연결 실패 | 기존 캐시 파일 유지 (삭제하지 않음) |
| 개별 테이블 조회 실패 | 에러 로그 출력, 다른 테이블은 정상 진행 |
| 파일 쓰기 실패 | 에러 로그 출력, 비치명적 |

`syncGlobalCache()`는 DB 조회 성공 후에만 기존 디렉토리를 삭제하므로, DB 실패 시 기존 파일이 보존된다.

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `packages/cli/src/global-cache.ts` | `syncGlobalCache()` — 핵심 동기화 로직 |
| `packages/cli/src/commands/context.ts` | `semo context sync` — SessionStart 훅 |
| `packages/cli/src/index.ts` | `setupStandardGlobal()` — onboarding 설치 |
| `packages/cli/src/commands/skill-sync.ts` | `syncSkillsToDB()` — 봇 스킬 파일→DB |
| `packages/cli/src/kb.ts` | `kbDigest()` — 봇별 KB 변경 다이제스트 생성 |
| `packages/cli/src/database.ts` | DB 연결 관리, 스키마 쿼리 |
