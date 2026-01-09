# Multi-Agent Orchestration - Sync Layer Implementation Plan

## Overview

DB에 저장된 에이전트/스킬 정의를 Claude Code 세션 시작 전에 worktree로 동기화하는 서비스 구현.
Office 생성 시 기본 템플릿 복사 및 정의 CRUD API 포함.

## Technical Approach

### 1. AgentDefinitionSync 클래스 설계

```typescript
class AgentDefinitionSync {
  constructor(private supabase: SupabaseClient) {}

  // 메인 동기화 메서드
  async syncToWorktree(officeId: string, worktreePath: string): Promise<void>

  // 에이전트 정의 파일 생성
  private async syncAgents(officeId: string, agentsDir: string): Promise<AgentDef[]>

  // 스킬 정의 파일 생성
  private async syncSkills(officeId: string, skillsDir: string): Promise<SkillDef[]>

  // CLAUDE.md 생성
  private async generateClaudeMd(
    worktreePath: string,
    agents: AgentDef[],
    skills: SkillDef[]
  ): Promise<void>
}
```

### 2. 동기화 흐름

```
syncToWorktree(officeId, worktreePath)
├── 1. .claude/ 디렉토리 생성
├── 2. DB에서 agent_definitions 조회
├── 3. agents/ 디렉토리에 .md 파일 생성
├── 4. DB에서 skill_definitions 조회
├── 5. skills/ 디렉토리 구조 생성
│   ├── {name}/SKILL.md
│   └── {name}/references/*.md (있는 경우)
└── 6. CLAUDE.md 생성
```

### 3. Office 초기화 흐름

```
initializeOfficeDefinitions(officeId)
├── 1. default_agent_templates 조회
├── 2. agent_definitions에 복사 (office_id 설정)
├── 3. default_skill_templates 조회
└── 4. skill_definitions에 복사 (office_id 설정)
```

### 4. REST API 설계

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/agent-definitions` | 에이전트 정의 목록 |
| GET | `/api/offices/:id/agent-definitions/:name` | 단일 에이전트 정의 |
| PUT | `/api/offices/:id/agent-definitions/:name` | 에이전트 정의 수정 |
| GET | `/api/offices/:id/skill-definitions` | 스킬 정의 목록 |
| PUT | `/api/offices/:id/skill-definitions/:name` | 스킬 정의 수정 |

## Dependencies

### 외부 의존성
- Node.js `fs/promises` (파일 시스템)
- `@supabase/supabase-js` (DB 클라이언트)

### 선행 작업
- Epic 1 완료 (DB 스키마 및 시드 데이터)

## Risk Assessment

### 중간
- **파일 권한 문제**: worktree 디렉토리 쓰기 권한 없을 수 있음
  - 대안: 권한 체크 후 에러 메시지 제공

### 낮음
- **동시 동기화 충돌**: 같은 Office에 대해 동시에 동기화 시도
  - 대안: 파일 단위 쓰기이므로 실질적 충돌 낮음

## File Structure

```
packages/office-server/src/
├── sync/
│   ├── agent-definition-sync.ts   # AgentDefinitionSync 클래스
│   └── office-initializer.ts      # initializeOfficeDefinitions 함수
└── api/
    └── definitions.ts             # CRUD API 핸들러
```
