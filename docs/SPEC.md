# SEMO v4 스펙

> **버전**: 4.0.0
> **패키지**: `@team-semicolon/semo-cli`
> **설계**: Core DB 중심 CLI-only 동기화 시스템
> **작성일**: 2026-03-15

---

## 목차

1. [개요](#개요)
2. [CLI 커맨드 레퍼런스](#cli-커맨드-레퍼런스)
3. [DB 스키마](#db-스키마)
4. [메모리 파일 매핑](#메모리-파일-매핑)
5. [SessionStart/Stop 훅](#sessionstartstop-훅)
6. [설정 (DATABASE_URL)](#설정-database_url)
7. [봇 상태 관리](#봇-상태-관리)
8. [검증 및 운영](#검증-및-운영)

---

## 개요

SEMO v4는 **Core PostgreSQL DB(`semo` 스키마)를 단일 진실 공급원**으로 삼아
OpenClaw 봇팀(7개 봇)과 로컬 Claude Code 세션 간의 컨텍스트를 동기화하는 CLI 시스템이다.

### 핵심 변경사항 (v3 → v4)

| 항목 | v3 | v4 |
|------|----|----|
| 동기화 방식 | MCP 서버 (semo-remote) | CLI 훅 (semo context sync/push) |
| 패키지 관리 | biz/eng/ops 확장 시스템 | 제거 (미사용) |
| 봇 상태 | 수동 관리 | `semo bots sync` 자동화 |
| 컨텍스트 로딩 | 없음 | SessionStart 훅 → `.claude/memory/` 자동 갱신 |

---

## CLI 커맨드 레퍼런스

### `semo context sync`

Core DB에서 `.claude/memory/` 파일을 생성/갱신한다.

```bash
semo context sync [옵션]

옵션:
  --bot <name>      봇 ID (bot_status 필터)
  --domain <name>   특정 KB 도메인만 동기화
  --no-bots         bot_status 동기화 건너뜀
  --no-ontology     ontology 동기화 건너뜀
```

**동기화 대상:**

| KB 도메인 | 출력 파일 |
|-----------|----------|
| `team` | `.claude/memory/team.md` |
| `project` | `.claude/memory/projects.md` |
| `decision` | `.claude/memory/decisions.md` |
| `infra` | `.claude/memory/infra.md` |
| `process` | `.claude/memory/process.md` |
| `semo.bot_status` | `.claude/memory/bots.md` |
| `semo.ontology` | `.claude/memory/ontology.md` |

---

### `semo context push`

`.claude/memory/decisions.md`의 변경사항을 Core DB에 업로드한다.

```bash
semo context push [옵션]

옵션:
  --domain <name>   push할 도메인 (기본: decision)
  --dry-run         실제 push 없이 미리보기
```

`decisions.md`의 `## 제목` H2 섹션이 각각 KB 항목 하나로 upsert된다.

---

### `semo bots status`

`semo.bot_status` 테이블에서 봇 상태를 조회한다.

```bash
semo bots status [옵션]

옵션:
  --status <filter>   online|offline 필터
  --format <type>     table|json (기본: table)
```

---

### `semo bots sessions`

`semo.bot_sessions` 테이블에서 세션 히스토리를 조회한다.

```bash
semo bots sessions [옵션]

옵션:
  --bot <name>    특정 봇만
  --limit <n>     최대 조회 수 (기본: 20)
  --format <type> table|json (기본: table)
```

---

### `semo bots sync`

`semo-system/bot-workspaces/`를 스캔하여 `semo.bot_status`에 upsert한다.

```bash
semo bots sync [옵션]

옵션:
  --semo-system <path>  semo-system 경로 (기본: ./semo-system)
  --dry-run             실제 upsert 없이 미리보기
```

각 봇 디렉토리의 `IDENTITY.md`에서 name/emoji/role을 파싱하고,
워크스페이스 파일의 mtime에서 `last_active`를 계산한다.

---

### `semo get <resource>`

세션 중 Core DB를 실시간 쿼리한다.

```bash
semo get projects   [--active] [--format table|json|md]
semo get bots       [--status online|offline] [--format table|json]
semo get kb         [--domain <d>] [--key <k>] [--search <text>] [--limit <n>] [--format table|json|md]
semo get ontology   [--domain <d>] [--format table|json]
semo get tasks      [--project <p>] [--status <s>] [--limit <n>] [--format table|json]
semo get sessions   [--bot <n>] [--limit <n>] [--format table|json]
```

---

### `semo skills seed`

`semo-system/semo-skills/`의 SKILL.md 파일을 파싱하여 `semo.skills` 테이블에 초기 데이터를 적재한다.

```bash
semo skills seed [옵션]

옵션:
  --semo-system <path>  semo-system 경로 (기본: ./semo-system)
  --dry-run             실제 upsert 없이 미리보기
```

---

### `semo kb` (기존 유지)

Knowledge Base 관리.

```bash
semo kb pull    — DB → .kb/
semo kb push    — .kb/ → DB
semo kb sync    — 양방향
semo kb status  — 동기화 상태
semo kb list    — 항목 목록
semo kb search  — 하이브리드 검색
semo kb diff    — 차이 비교
semo kb embed   — 임베딩 생성
```

---

### `semo onto` (기존 유지)

온톨로지 관리.

```bash
semo onto list        — 도메인 목록
semo onto show <d>    — 도메인 상세
semo onto validate    — 스키마 검증
```

---

### `semo init`

`.claude/` 구조 설치 및 훅 등록.

```bash
semo init [옵션]

옵션:
  --seed-skills   semo-skills/ → semo.skills DB 시딩 포함
```

실행 시:
1. `.claude/memory/` 디렉토리 생성
2. `SessionStart` / `Stop` 훅을 `.claude/settings.json`에 등록
3. `.gitignore`에서 `.claude/` 제외 항목 정리

---

## DB 스키마

### `semo.knowledge_base`

```sql
domain       TEXT NOT NULL
key          TEXT NOT NULL
content      TEXT NOT NULL
metadata     JSONB DEFAULT '{}'
created_by   TEXT
updated_at   TIMESTAMPTZ DEFAULT NOW()
PRIMARY KEY (domain, key)
```

**도메인 목록**: `team`, `project`, `decision`, `infra`, `process`

---

### `semo.bot_status`

```sql
bot_id         TEXT PRIMARY KEY
name           TEXT
emoji          TEXT
role           TEXT
status         TEXT          -- 'online' | 'offline'
last_active    TIMESTAMPTZ
session_count  INTEGER DEFAULT 0
workspace_path TEXT
synced_at      TIMESTAMPTZ DEFAULT NOW()
```

**봇 목록**: `workclaw`, `reviewclaw`, `planclaw`, `infraclaw`, `semiclaw`, `designclaw`, `growthclaw`

---

### `semo.bot_sessions`

```sql
bot_id          TEXT NOT NULL
session_key     TEXT NOT NULL
label           TEXT
kind            TEXT
chat_type       TEXT
last_activity   TIMESTAMPTZ
message_count   INTEGER DEFAULT 0
synced_at       TIMESTAMPTZ DEFAULT NOW()
PRIMARY KEY (bot_id, session_key)
```

---

### `semo.ontology`

```sql
domain       TEXT PRIMARY KEY
version      INTEGER DEFAULT 1
description  TEXT
schema       JSONB
updated_at   TIMESTAMPTZ DEFAULT NOW()
```

---

### `semo.skills`

```sql
id             SERIAL PRIMARY KEY
name           TEXT UNIQUE NOT NULL
display_name   TEXT
description    TEXT
content        TEXT
category       TEXT
package        TEXT
is_active      BOOLEAN DEFAULT true
is_required    BOOLEAN DEFAULT false
install_order  INTEGER DEFAULT 100
version        TEXT DEFAULT '1.0.0'
metadata       JSONB DEFAULT '{}'
package_id     INTEGER
```

---

### `semo.projects`

```sql
id            TEXT PRIMARY KEY
name          TEXT NOT NULL
display_name  TEXT
status        TEXT         -- 'active' | 'archived'
description   TEXT
updated_at    TIMESTAMPTZ DEFAULT NOW()
```

---

## 메모리 파일 매핑

| 파일 | DB 소스 | 동기화 방향 | 비고 |
|------|---------|------------|------|
| `.claude/memory/team.md` | `kb WHERE domain='team'` | DB → 로컬 | Read-only |
| `.claude/memory/projects.md` | `kb WHERE domain='project'` | DB → 로컬 | Read-only |
| `.claude/memory/decisions.md` | `kb WHERE domain='decision'` | 양방향 | `push`로 DB 반영 가능 |
| `.claude/memory/infra.md` | `kb WHERE domain='infra'` | DB → 로컬 | Read-only |
| `.claude/memory/process.md` | `kb WHERE domain='process'` | DB → 로컬 | Read-only |
| `.claude/memory/bots.md` | `semo.bot_status` | DB → 로컬 | Read-only |
| `.claude/memory/ontology.md` | `semo.ontology` | DB → 로컬 | Read-only |

---

## SessionStart/Stop 훅

`semo init` 실행 시 `.claude/settings.json`에 자동 등록된다.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "semo context sync 2>/dev/null || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "semo context push 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

- `2>/dev/null || true`: DB 연결 실패 시 세션에 영향 없음
- `SessionStart`: 세션 시작마다 DB → memory 파일 갱신
- `Stop`: 세션 종료 시 decisions.md → DB push

---

## 설정 (DATABASE_URL)

CLI는 다음 순서로 DB 접속 정보를 결정한다:

1. **`DATABASE_URL`** 환경변수 (우선)
   `postgres://user:password@host:port/dbname`
2. **`SEMO_DB_*`** 분리 변수 (fallback)
   `SEMO_DB_HOST`, `SEMO_DB_PORT`, `SEMO_DB_USER`, `SEMO_DB_PASSWORD`, `SEMO_DB_NAME`
3. **하드코딩 기본값** (최후 fallback)

### 로컬 개발 (SSH 터널)

```bash
# 1. SSH 터널 개설
ssh -f -N -L 15432:10.0.0.91:5432 -J opc@152.70.244.169 opc@10.0.0.91

# 2. 환경변수 설정 (@와 # 특수문자 URL 인코딩 필요)
export DATABASE_URL="postgres://app:ProductionPassword2024!%40%23@localhost:15432/appdb"

# 3. CLI 실행
semo context sync
```

### 직접 psql 접속 (DB 확인)

```bash
ssh -J opc@152.70.244.169 opc@10.0.0.91 \
  docker exec -i pg16-primary psql -U app -d appdb \
  -c "SELECT * FROM semo.bot_status;"
```

---

## 봇 상태 관리

### 단기: 수동/크론 실행

```bash
# 전체 봇 상태 DB 반영
semo bots sync --semo-system /path/to/semo-system

# 15분마다 크론 실행 (semiclaw 헬스비트)
# semo-system/bot-workspaces/semiclaw/scripts/bot-status-sync.sh
```

### 중기: SemiClaw 헬스비트

`semiclaw/scripts/bot-status-sync.sh`가 15분마다 `semo bots sync`를 호출한다.
라우팅: `~/.config/semicolon/launchagents/bot-status-sync.plist`

### 장기: 봇별 Stop 훅

각 봇의 `settings.json`에:
```json
{
  "hooks": {
    "Stop": [{ "type": "command", "command": "semo bots sync 2>/dev/null || true" }]
  }
}
```

---

## 검증 및 운영

### 빌드 확인

```bash
cd packages/cli
npm run build        # TypeScript 컴파일
npx tsc --noEmit    # 타입 체크만
```

### DB 연결 확인

```bash
semo doctor
```

### 전체 동기화 플로우 검증

```bash
# 1. 봇 상태 DB 반영
semo bots sync

# 2. DB → memory 파일 동기화
semo context sync
cat .claude/memory/bots.md
cat .claude/memory/team.md

# 3. 실시간 쿼리
semo get projects
semo get bots
semo get kb --domain team

# 4. decisions push 검증
echo "## test-decision\n\n테스트 결정 내용" >> .claude/memory/decisions.md
semo context push --dry-run   # 미리보기
semo context push              # 실제 push

# 5. 스킬 DB 시딩
semo skills seed --dry-run    # 30개 스킬 확인
semo skills seed               # 실제 적재
```

### 레포 구조 (CLI 패키지)

```
packages/cli/
├── src/
│   ├── index.ts          # 진입점 + init/update/status/doctor/skills 커맨드
│   ├── database.ts       # PostgreSQL Pool 관리, DATABASE_URL 지원
│   ├── kb.ts             # KB/ontology 쿼리 함수
│   └── commands/
│       ├── context.ts    # semo context sync/push
│       ├── bots.ts       # semo bots status/sessions/sync
│       └── get.ts        # semo get <resource>
├── package.json          # version: 4.0.0
└── tsconfig.json
```
