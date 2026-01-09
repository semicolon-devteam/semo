# Multi-Agent Orchestration - Sync Layer Tasks

## Task Overview

| ID | Layer | Task | Complexity | Dependencies |
|----|-------|------|------------|--------------|
| T1 | v0.2.x PROJECT | sync 디렉토리 구조 생성 | S | - |
| T2 | v0.5.x CODE | AgentDefinitionSync 클래스 기본 구조 | M | T1 |
| T3 | v0.5.x CODE | syncAgents() 메서드 구현 | M | T2 |
| T4 | v0.5.x CODE | syncSkills() 메서드 구현 | M | T2 |
| T5 | v0.5.x CODE | generateClaudeMd() 메서드 구현 | S | T2 |
| T6 | v0.5.x CODE | initializeOfficeDefinitions() 구현 | M | T1 |
| T7 | v0.5.x CODE | Office 생성 API에 초기화 통합 | S | T6 |
| T8 | v0.5.x CODE | GET /agent-definitions API | M | T1 |
| T9 | v0.5.x CODE | PUT /agent-definitions/:name API | M | T8 |
| T10 | v0.5.x CODE | GET /skill-definitions API | M | T1 |
| T11 | v0.5.x CODE | PUT /skill-definitions/:name API | M | T10 |
| T12 | v0.4.x TESTS | AgentDefinitionSync 단위 테스트 | M | T2-T5 |

## Task Details

### T1: [v0.2.x PROJECT] sync 디렉토리 구조 생성
- **Complexity**: S
- **Dependencies**: -
- **Description**: office-server 패키지에 sync 디렉토리 및 기본 파일 생성
- **Acceptance Criteria**:
  - [ ] `packages/office-server/src/sync/` 디렉토리 생성
  - [ ] `index.ts` export 파일 생성
  - [ ] TypeScript 타입 정의 파일 생성

### T2: [v0.5.x CODE] AgentDefinitionSync 클래스 기본 구조
- **Complexity**: M
- **Dependencies**: T1
- **Description**: DB-파일 동기화 클래스 기본 골격 구현
- **Acceptance Criteria**:
  - [ ] Supabase 클라이언트 주입
  - [ ] `syncToWorktree(officeId, worktreePath)` 시그니처
  - [ ] 디렉토리 생성 로직 (`.claude/agents/`, `.claude/skills/`)

```typescript
export class AgentDefinitionSync {
  constructor(private supabase: SupabaseClient) {}

  async syncToWorktree(officeId: string, worktreePath: string): Promise<void> {
    const claudeDir = path.join(worktreePath, '.claude');
    await fs.mkdir(path.join(claudeDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(claudeDir, 'skills'), { recursive: true });

    const agents = await this.syncAgents(officeId, path.join(claudeDir, 'agents'));
    const skills = await this.syncSkills(officeId, path.join(claudeDir, 'skills'));
    await this.generateClaudeMd(claudeDir, agents, skills);
  }
}
```

### T3: [v0.5.x CODE] syncAgents() 메서드 구현
- **Complexity**: M
- **Dependencies**: T2
- **Description**: DB에서 에이전트 정의를 조회하여 .md 파일로 저장
- **Acceptance Criteria**:
  - [ ] `agent_definitions` 테이블에서 `is_active=true` 조회
  - [ ] 각 에이전트를 `{name}.md` 파일로 저장
  - [ ] `definition_content` 전체를 파일에 쓰기

```typescript
private async syncAgents(officeId: string, agentsDir: string): Promise<AgentDef[]> {
  const { data: agents } = await this.supabase
    .from('agent_definitions')
    .select('*')
    .eq('office_id', officeId)
    .eq('is_active', true);

  for (const agent of agents || []) {
    await fs.writeFile(
      path.join(agentsDir, `${agent.name}.md`),
      agent.definition_content,
      'utf-8'
    );
  }

  return agents || [];
}
```

### T4: [v0.5.x CODE] syncSkills() 메서드 구현
- **Complexity**: M
- **Dependencies**: T2
- **Description**: DB에서 스킬 정의를 조회하여 디렉토리 구조로 저장
- **Acceptance Criteria**:
  - [ ] 각 스킬을 `{name}/SKILL.md` 구조로 저장
  - [ ] `references` JSONB 배열을 `references/` 디렉토리에 저장
  - [ ] 빈 references 배열 처리

```typescript
private async syncSkills(officeId: string, skillsDir: string): Promise<SkillDef[]> {
  const { data: skills } = await this.supabase
    .from('skill_definitions')
    .select('*')
    .eq('office_id', officeId)
    .eq('is_active', true);

  for (const skill of skills || []) {
    const skillDir = path.join(skillsDir, skill.name);
    await fs.mkdir(skillDir, { recursive: true });

    // SKILL.md 저장
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      skill.skill_content,
      'utf-8'
    );

    // references 저장
    if (skill.references?.length > 0) {
      const refsDir = path.join(skillDir, 'references');
      await fs.mkdir(refsDir, { recursive: true });
      for (const ref of skill.references) {
        await fs.writeFile(
          path.join(refsDir, ref.filename),
          ref.content,
          'utf-8'
        );
      }
    }
  }

  return skills || [];
}
```

### T5: [v0.5.x CODE] generateClaudeMd() 메서드 구현
- **Complexity**: S
- **Dependencies**: T2
- **Description**: CLAUDE.md 파일 자동 생성
- **Acceptance Criteria**:
  - [ ] Orchestrator 에이전트 찾기
  - [ ] 사용 가능한 에이전트 목록 생성
  - [ ] 사용 가능한 스킬 목록 생성

### T6: [v0.5.x CODE] initializeOfficeDefinitions() 구현
- **Complexity**: M
- **Dependencies**: T1
- **Description**: Office 생성 시 기본 템플릿 복사 함수
- **Acceptance Criteria**:
  - [ ] `default_agent_templates` → `agent_definitions` 복사
  - [ ] `default_skill_templates` → `skill_definitions` 복사
  - [ ] `office_id` 자동 설정

```typescript
export async function initializeOfficeDefinitions(
  supabase: SupabaseClient,
  officeId: string
): Promise<void> {
  // 에이전트 템플릿 복사
  const { data: agentTemplates } = await supabase
    .from('default_agent_templates')
    .select('*');

  for (const template of agentTemplates || []) {
    await supabase.from('agent_definitions').insert({
      office_id: officeId,
      name: template.name,
      role: template.role,
      definition_content: template.definition_content,
      frontmatter: template.frontmatter,
      is_default: true,
    });
  }

  // 스킬 템플릿 복사 (동일 패턴)
}
```

### T7: [v0.5.x CODE] Office 생성 API에 초기화 통합
- **Complexity**: S
- **Dependencies**: T6
- **Description**: 기존 Office 생성 API에 초기화 로직 추가
- **Acceptance Criteria**:
  - [ ] Office INSERT 후 `initializeOfficeDefinitions()` 호출
  - [ ] 트랜잭션 처리 (실패 시 롤백)

### T8: [v0.5.x CODE] GET /agent-definitions API
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 에이전트 정의 목록 및 단일 조회 API
- **Acceptance Criteria**:
  - [ ] `GET /api/offices/:id/agent-definitions` - 목록
  - [ ] `GET /api/offices/:id/agent-definitions/:name` - 단일
  - [ ] 권한 검증 (Office 멤버만)

### T9: [v0.5.x CODE] PUT /agent-definitions/:name API
- **Complexity**: M
- **Dependencies**: T8
- **Description**: 에이전트 정의 수정 API
- **Acceptance Criteria**:
  - [ ] `definition_content` 업데이트
  - [ ] `frontmatter` 자동 파싱/업데이트
  - [ ] `version` 증가
  - [ ] `updated_at` 갱신

### T10: [v0.5.x CODE] GET /skill-definitions API
- **Complexity**: M
- **Dependencies**: T1
- **Description**: 스킬 정의 목록 및 단일 조회 API
- **Acceptance Criteria**:
  - [ ] 목록 조회
  - [ ] 단일 조회 (`references` 포함)

### T11: [v0.5.x CODE] PUT /skill-definitions/:name API
- **Complexity**: M
- **Dependencies**: T10
- **Description**: 스킬 정의 수정 API
- **Acceptance Criteria**:
  - [ ] `skill_content` 업데이트
  - [ ] `references` 배열 업데이트
  - [ ] 버전 관리

### T12: [v0.4.x TESTS] AgentDefinitionSync 단위 테스트
- **Complexity**: M
- **Dependencies**: T2-T5
- **Description**: 동기화 서비스 테스트
- **Acceptance Criteria**:
  - [ ] Mock Supabase 클라이언트 사용
  - [ ] 파일 시스템 mocking (memfs)
  - [ ] 에이전트 동기화 테스트
  - [ ] 스킬 동기화 테스트 (references 포함)
  - [ ] CLAUDE.md 생성 테스트

## Test Requirements

### 엔지니어 테스트
```typescript
// 수동 테스트 스크립트
const sync = new AgentDefinitionSync(supabase);
await sync.syncToWorktree('office-uuid', '/tmp/test-worktree');

// 검증
assert(await fs.exists('/tmp/test-worktree/.claude/agents/orchestrator.md'));
assert(await fs.exists('/tmp/test-worktree/.claude/skills/write-code/SKILL.md'));
assert(await fs.exists('/tmp/test-worktree/.claude/CLAUDE.md'));
```

### API 테스트
```bash
# 목록 조회
curl http://localhost:3000/api/offices/{id}/agent-definitions

# 단일 조회
curl http://localhost:3000/api/offices/{id}/agent-definitions/orchestrator

# 수정
curl -X PUT http://localhost:3000/api/offices/{id}/agent-definitions/orchestrator \
  -H "Content-Type: application/json" \
  -d '{"definition_content": "---\nname: orchestrator\n..."}'
```
