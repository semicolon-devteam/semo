# Commands

`semo` CLI의 서브커맨드 모듈들.

## 파일 목록

| 파일 | 커맨드 | 역할 |
|------|--------|------|
| `bots.ts` | `semo bots` | 봇 상태 관리 (`status`, `seed`, `sync`) |
| `context.ts` | `semo context` | Core DB ↔ `.claude/memory/` 동기화 (`sync`, `push`) |
| `skill-sync.ts` | _(내부 모듈)_ | 봇 전용 스킬 파일 스캔 + DB 동기화 — 직접 호출하지 않음 |
| `sessions.ts` | `semo sessions` | 봇 세션 추적 |
| `audit.ts` | `semo audit` | Bot workspace 표준 구조 감사 |
| `get.ts` | `semo get` | 세션 중 실시간 DB 쿼리 |
| `db.ts` | `semo db` | 마이그레이션 관리 |

### 관련 모듈 (commands/ 외부)

| 파일 | 역할 |
|------|------|
| `../global-cache.ts` | `syncGlobalCache()` — DB → `~/.claude/{skills,commands,agents}/` 동기화 + 에이전트 정보 주입 |
| `../kb.ts` | KB CRUD + 시맨틱 검색 + `kbDigest()` (변경 다이제스트 생성) |
| `../database.ts` | DB 연결 관리, 스키마 쿼리, `Skill.bot_ids` 추출 |

## 스킬 동기화 흐름

`skill-sync.ts`는 공통 모듈로, 두 곳에서 호출됩니다:

```
semo bots sync   → bots.ts → syncSkillsToDB()
semo context sync → context.ts → syncSkillsToDB()
```

### Flat Skill Naming (v4.2)

스킬 이름은 **flat** (1-depth)로 저장됩니다. Claude Code는 `~/.claude/skills/{skillName}/SKILL.md` 구조만 인식하므로, 봇 프리픽스 없이 스킬명만 사용합니다.

```
[Before]  semiclaw/kb-manager   → ~/.claude/skills/semiclaw/kb-manager/SKILL.md  (2-depth, 인식 불가)
[After]   kb-manager             → ~/.claude/skills/kb-manager/SKILL.md           (1-depth, 정상 로드)
```

봇 매핑은 `skill_definitions.metadata` JSONB의 `bot_ids` 배열로 관리:

```jsonc
// 단일 봇
{ "bot_ids": ["semiclaw"] }

// 동일 스킬이 여러 봇에 존재 → 자동 머지
{ "bot_ids": ["infraclaw", "workclaw"] }
```

스캔 대상:
- **봇 전용 스킬**: `semo-system/bot-workspaces/{봇}/skills/*/SKILL.md` → flat name으로 DB 동기화
- ~~공유 스킬 (`semo-skills/`)~~ — 삭제됨, 더 이상 스캔하지 않음

### 에이전트 정보 주입

`syncGlobalCache()`가 `~/.claude/skills/` 에 파일을 쓸 때, `bot_ids`가 있으면 SKILL.md frontmatter에 에이전트 정보를 주입합니다:

```yaml
---
name: kb-manager
description: KB 문서 관리 및 동기화
  Agents: semiclaw          # ← 자동 주입
category: knowledge
---
```

frontmatter가 없으면 blockquote로 삽입:

```markdown
# Simple Skill
> **Agents:** semiclaw, workclaw
```

## 주요 커맨드 차이

| 커맨드 | 용도 |
|--------|------|
| `semo bots seed` | 봇 7개를 `bot_status`에 초기 등록 (최초 1회) |
| `semo bots sync` | 봇 상태 + 스킬 동기화 (정기 실행) |
| `semo context sync` | Core DB → 로컬 memory 동기화 + 스킬 동기화 (세션 시작 훅) |
| `semo context sync --bot {id} --digest` | 위 + KB 변경 다이제스트 생성 → `kb-digest.md` (봇 훅 전용) |

## 봇 스킬 라우팅

`skill_definitions.metadata->'bot_ids'` JSONB 배열로 매핑:

- `metadata`에 `bot_ids` 키가 없는 스킬 → 모든 봇이 사용 가능
- `metadata.bot_ids`에 봇 ID가 포함된 스킬 → 해당 봇 전용 (우선 정렬)

```sql
-- 특정 봇의 스킬 조회 (전용 스킬 먼저, 공유 스킬 뒤)
WHERE NOT metadata ? 'bot_ids' OR metadata->'bot_ids' ? $botId
ORDER BY CASE WHEN metadata->'bot_ids' ? $botId THEN 0 ELSE 1 END
```
