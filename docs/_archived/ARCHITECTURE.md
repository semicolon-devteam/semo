# SEMO 아키텍처 개요

> 팀 리더 및 아키텍트를 위한 SEMO 기술 아키텍처 문서

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
│  │  │  │ semo-core   │  │ semo-skills │  │ Extensions │  │ │   │
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

### Layer 1: semo-skills (필수)

**역할**: 기능별 통합 스킬 제공

```
semo-skills/
├── coder/           # 코드 작성/수정/검증
├── tester/          # 테스트/QA
├── planner/         # 기획/관리
├── writer/          # 문서/디자인
├── deployer/        # 배포/인프라
├── memory/          # 세션 간 기억
├── notify-slack/    # Slack 알림
├── feedback/        # 피드백 수집
├── version-updater/ # 버전 관리
├── semo-help/       # 도움말
├── circuit-breaker/ # 안전 장치
└── list-bugs/       # 버그 목록
```

**스킬 구조**:
```
{skill}/
├── SKILL.md           # 스킬 정의 (frontmatter + 설명)
├── references/        # 참조 문서
└── platforms/         # 플랫폼별 분기 (선택)
```

---

### Layer 2: Extensions (선택)

**역할**: 역할/플랫폼별 전문화

| Extension | 대상 | 주요 기능 |
|-----------|------|----------|
| semo-next | 프론트엔드 | DDD, API 연동, 컴포넌트 |
| semo-backend | 백엔드 | WebFlux, CQRS, Reactive |
| semo-po | PO | Epic, Task, 중복 검사 |
| semo-design | 디자이너 | 목업, 핸드오프 |
| semo-qa | QA | 테스트 케이스, 버그 리포트 |
| semo-pm | PM | 스프린트, 진행도 |
| semo-infra | 인프라 | Docker, Nginx, 배포 |
| semo-ms | MSA | 서비스 설계, 이벤트 |
| semo-mvp | MVP | 빠른 프로토타이핑 |
| semo-meta | 프레임워크 개발 | SEMO 자체 개발용 |

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

```
.claude/memory/
├── context.md       # 프로젝트 상태, 기술 스택
├── decisions.md     # ADR (아키텍처 결정 기록)
└── rules/           # 프로젝트별 커스텀 규칙
    └── project-specific.md
```

### 동작 흐름

```
[세션 시작]
     ↓
memory/ 로드 (skill:memory sync)
     ↓
컨텍스트 주입
     ↓
[작업 수행]
     ↓
결정 사항 저장 (skill:memory save)
     ↓
[세션 종료]
```

### 활용 사례

| 저장 데이터 | 예시 |
|------------|------|
| 아키텍처 결정 | "API 응답은 JSON Envelope 패턴 사용" |
| 선호도 | "변수명은 camelCase" |
| 프로젝트 맥락 | "Next.js 14 + Supabase 사용" |

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

```
semo-skills/coder/my-skill/
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

| 정보 | 저장 위치 | 접근 방식 |
|------|----------|----------|
| API 키 | 환경변수 | `${VAR_NAME}` |
| 토큰 | `.env` (gitignore) | MCP 서버에서 주입 |
| 비밀번호 | Doppler | 런타임 로드 |

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

| 문서 | 위치 | 설명 |
|------|------|------|
| PRINCIPLES.md | semo-core/principles/ | 핵심 원칙 |
| MESSAGE_RULES.md | semo-core/principles/ | 메시지 규칙 |
| microservice-conventions.md | packages/core/_shared/ | MS 규약 |
| team-context.md | packages/core/_shared/ | 팀 컨텍스트 |

---

## 10. 향후 로드맵

| 단계 | 내용 | 상태 |
|------|------|------|
| v2.0 | 기능 기반 구조 전환 | 완료 |
| v2.1 | Context Mesh DB 연동 | 검토 중 |
| v2.2 | 벡터 검색 기반 Reference | 계획 |
| v3.0 | Multi-Agent 협업 | 계획 |

---

*이 문서는 SEMO v2.0.1 기준으로 작성되었습니다.*
