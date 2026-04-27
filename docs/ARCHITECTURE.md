# SEMO 아키텍처 개요

> 팀 리더 및 아키텍트를 위한 SEMO 기술 아키텍처 문서

> ⚠️ **이 문서는 v3 기준의 레거시 설명입니다.** v4.18+ 의 3-Layer 메타 프레임워크
> 모델은 [`packages/cli/README.md`](../packages/cli/README.md) 와
> [`docs/L2-INVENTORY.md`](./L2-INVENTORY.md) 를 우선 참고하세요. 본 문서는 추후
> L0/L1/L2 + Profile/Tenant 구조로 갱신 예정.

---

## 1. 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Code Session                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    .claude/ (White Box)                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │  CLAUDE.md  │  │  memory/    │  │  settings.json  │   │   │
│  │  │ (진입점)     │  │ (Context    │  │  (MCP 설정)     │   │   │
│  │  │             │  │  Mesh)      │  │                 │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │              semo-system/ (심볼릭 링크)              │ │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │ │   │
│  │  │  │ semo-core   │  │ skills (DB) │  │ Extensions │  │ │   │
│  │  │  │ (Layer 0)   │  │ (Layer 1)   │  │ (선택)     │  │ │   │
│  │  │  └─────────────┘  └─────────────┘  └────────────┘  │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 MCP Server (Black Box)                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │  Slack   │  │  GitHub  │  │ Supabase │  │  Custom  │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 구조

### Layer 0: semo-core (필수)

**역할**: 오케스트레이션, 원칙, 테스트 엔진

```
semo-core/
├── principles/
│   ├── PRINCIPLES.md      # 핵심 원칙
│   └── MESSAGE_RULES.md   # 메시지 규칙
├── agents/
│   └── orchestrator/      # 라우팅 담당
├── templates/
│   ├── CLAUDE.md          # 프로젝트 진입점 템플릿
│   └── gitignore-semo.txt
└── tests/
    └── cases/             # 자동화 테스트 케이스
```

**핵심 원칙**:

- **Orchestrator-First**: 모든 요청은 Orchestrator를 먼저 거침
- **투명성**: 모든 AI 동작에 `[SEMO]` 메시지 출력
- **Routing-Only**: Orchestrator는 라우팅만, 직접 구현 금지

---

### Layer 1: 스킬/커맨드/에이전트 (DB 기반)

**역할**: 기능별 통합 스킬, 슬래시 커맨드, 에이전트 정의

**저장소**: 중앙 DB (`skill_definitions`, `command_definitions`, `agent_definitions` 테이블)

**동기화 흐름**:

```
skill_definitions (DB SoT)
    ↓ semo context sync (SessionStart 자동)
~/.claude/{skills,commands,agents}/  (글로벌 캐시)
    ↓ Claude Code 세션 로드
Claude Code에서 사용
```

**공유 vs 봇 전용**:

- 공유 스킬: `target_agents = '{all}'` → 모든 세션에서 사용
- 봇 전용 스킬: `target_agents = '{botId}'` → 해당 봇만 사용

자세한 내용은 [SKILL_ARCHITECTURE.md](./SKILL_ARCHITECTURE.md) 참조.

---

---

## 3. White Box vs Black Box

### White Box (파일시스템 기반)

**특징**:

- Git으로 버전 관리 가능
- 코드 리뷰 가능
- 오프라인에서도 동작
- 커스터마이징 용이

**구성요소**:

- `CLAUDE.md`: Claude Code가 읽는 진입점
- `memory/`: Context Mesh (장기 기억)
- `agents/`, `skills/`: 에이전트/스킬 정의
- `commands/`: 슬래시 커맨드

### Black Box (MCP 기반)

**특징**:

- 외부 시스템 연동
- 런타임 동적 기능
- 보안 민감 정보 처리

**구성요소**:

- `settings.json`: MCP 서버 설정
- Slack, GitHub, Supabase 연동

```json
// .claude/settings.json
{
  "mcpServers": {
    "semo-integrations": {
      "command": "npx",
      "args": ["-y", "@team-semicolon/semo-mcp"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
        "SUPABASE_URL": "${SUPABASE_URL}"
      }
    }
  }
}
```

---

## 4. Context Mesh

### 구조

Core DB(`semo.knowledge_base`)를 SoT로, 세션 시작/종료 시 자동 동기화됩니다.

```
~/.claude/memory/  (글로벌 — 모든 프로젝트 공유)
├── team.md           ← DB: KB domain='team'        (읽기전용)
├── projects.md       ← DB: KB domain='project'     (읽기전용)
├── decisions.md      ◄► DB: KB domain='decision'   (양방향)
├── infra.md          ← DB: KB domain='infra'       (읽기전용)
├── process.md        ← DB: KB domain='process'     (읽기전용)
├── bots.md           ← DB: bot_status 테이블        (읽기전용)
├── ontology.md       ← DB: ontology 테이블           (읽기전용)
└── kb-digest.md      ← DB: KB 변경 다이제스트         (봇 전용)
```

### 동작 흐름

```
[세션 시작]
     ↓
SessionStart 훅 → semo context sync
     ↓
DB → ~/.claude/memory/*.md (KB + bot_status + ontology)
DB → ~/.claude/skills,commands,agents/ (글로벌 캐시)
     ↓
[작업 수행]
     ↓
decisions.md 수정 (아키텍처 결정 기록)
     ↓
[세션 종료]
     ↓
Stop 훅 → semo context push
     ↓
decisions.md → DB (semo.knowledge_base domain='decision')
```

### 동기화 방향 정리

| 파일         | 로컬 Claude | OpenClaw 봇     | DB 테이블                 |
| ------------ | ----------- | --------------- | ------------------------- |
| team.md      | DB → 로컬   | DB → 봇         | knowledge_base            |
| projects.md  | DB → 로컬   | DB → 봇 / 봇→DB | knowledge_base            |
| decisions.md | DB ◄► 로컬  | DB → 봇         | knowledge_base            |
| bots.md      | DB → 로컬   | DB → 봇         | bot_status                |
| kb-digest.md | (해당없음)  | DB → 봇         | KB + bot_kb_subscriptions |

---

## 5. 데이터 흐름

### 요청 처리 흐름

```
사용자 요청
     │
     ▼
┌─────────────────┐
│  Orchestrator   │  ← 의도 분석, 플랫폼 감지
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Skill 선택    │  ← 라우팅 테이블 참조
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│Layer 1│ │Layer 2│  ← 필요 시 Extension 호출
└───┬───┘ └───┬───┘
    │         │
    ▼         ▼
┌─────────────────┐
│   Reference     │  ← 참조 문서 로드
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MCP Server    │  ← 외부 연동 (선택)
└────────┬────────┘
         │
         ▼
    결과 출력
```

### SEMO 메시지 예시

```
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현 요청

[SEMO] Skill: implement 호출 (platform: nextjs)

[SEMO] Reference: ddd-patterns 참조

## 구현 결과

...
```

---

## 6. 확장 포인트

### 새 Skill 추가

공유 스킬은 중앙 DB(`skill_definitions`)에 등록합니다.
봇 전용 스킬은 `bot-workspaces/{봇}/skills/` 하위에 파일로 생성합니다.

```
{skill}/
├── SKILL.md           # 필수: 스킬 정의
├── references/        # 선택: 참조 문서
└── platforms/         # 선택: 플랫폼별 분기
```

**SKILL.md 구조**:

```markdown
---
name: my-skill
description: |
  스킬 설명. Use when (1) 상황1, (2) 상황2.
tools: [Read, Write, Edit, Bash]
model: inherit
---

# My Skill

## Purpose

...

## Workflow

...
```

### 새 Extension 추가

1. `packages/{extension}/` 디렉토리 생성
2. `CLAUDE.md` 작성
3. `agents/`, `skills/` 구성
4. CLI에 등록

### MCP 도구 추가

`semo-mcp` 서버에 새 도구 정의:

```typescript
// src/tools/my-tool.ts
export const myTool = {
  name: 'my_tool',
  description: '도구 설명',
  inputSchema: { ... },
  handler: async (params) => { ... }
};
```

---

## 7. 보안 고려사항

### 민감 정보 처리

| 정보     | 저장 위치          | 접근 방식         |
| -------- | ------------------ | ----------------- |
| API 키   | 환경변수           | `${VAR_NAME}`     |
| 토큰     | `.env` (gitignore) | MCP 서버에서 주입 |
| 비밀번호 | Doppler            | 런타임 로드       |

### .gitignore 권장

```gitignore
# SEMO
.claude/settings.local.json
.claude/memory/cache/
.env
.env.local
```

---

## 8. 성능 최적화

### 컨텍스트 크기 관리

- Reference 파일은 필요한 부분만 로드
- 대용량 파일은 summary 형태로 캐싱
- 오래된 로그는 주기적 정리

### MCP 연결

- 연결 풀링 사용
- 타임아웃 설정
- 재시도 로직 (지수 백오프)

---

## 9. 참조 문서

| 문서                  | 위치                       | 설명                                   |
| --------------------- | -------------------------- | -------------------------------------- |
| SKILL_ARCHITECTURE.md | docs/                      | 스킬/커맨드/에이전트 DB 구조 및 동기화 |
| FAQ.md                | docs/                      | 자주 묻는 질문                         |
| TESTING.md            | docs/                      | E2E 테스트 케이스                      |
| commands/README.md    | packages/cli/src/commands/ | CLI 커맨드 모듈 설명                   |

---

## 10. 버전 히스토리

| 단계 | 내용                                         | 상태 |
| ---- | -------------------------------------------- | ---- |
| v2.0 | 기능 기반 구조 전환                          | 완료 |
| v3.0 | DB SoT + Context Mesh + Multi-Agent 협업     | 완료 |
| v4.0 | 스킬 통합 (76 → ~30), OpenClaw 봇팀 운영     | 완료 |
| v4.1 | KB 변경 다이제스트, 봇별 구독, 워터마크 추적 | 완료 |

---

_이 문서는 SEMO v4.1 기준으로 최종 업데이트되었습니다._
