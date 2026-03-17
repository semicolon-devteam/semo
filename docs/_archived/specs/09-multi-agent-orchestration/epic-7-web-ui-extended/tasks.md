# Multi-Agent Orchestration - Web UI Extended Tasks

## Task Overview

| ID | Layer | Task | Complexity | Dependencies |
|----|-------|------|------------|--------------|
| T1 | v0.2.x PROJECT | admin 컴포넌트 디렉토리 구조 | S | - |
| T2 | v0.5.x CODE | useWorkflowProgress 훅 | M | Epic 6 |
| T3 | v0.5.x CODE | StepGraph 컴포넌트 | M | T2 |
| T4 | v0.5.x CODE | StepDetail 컴포넌트 | S | T2 |
| T5 | v0.5.x CODE | ArtifactPreview 모달 | M | T2 |
| T6 | v0.5.x CODE | WorkflowProgress 통합 | M | T2-T5 |
| T7 | v0.5.x CODE | Frontmatter 파서/생성기 | M | - |
| T8 | v0.5.x CODE | useAgentDefinitions 훅 | M | Epic 2 |
| T9 | v0.5.x CODE | DefinitionList 컴포넌트 | S | T8 |
| T10 | v0.5.x CODE | Monaco Editor 통합 | M | - |
| T11 | v0.5.x CODE | FrontmatterForm 컴포넌트 | M | T7 |
| T12 | v0.5.x CODE | AgentDefinitionEditor 통합 | L | T7-T11 |
| T13 | v0.5.x CODE | SkillDefinitionEditor 구현 | L | T7-T10 |
| T14 | v0.4.x TESTS | 컴포넌트 단위 테스트 | M | T6, T12, T13 |

## Task Details

### T1: [v0.2.x PROJECT] admin 컴포넌트 디렉토리 구조
- **Complexity**: S
- **Dependencies**: -
- **Description**: 관리자 UI 파일 구조 생성
- **Acceptance Criteria**:
  - [ ] `packages/office-web/src/components/admin/` 디렉토리
  - [ ] `packages/office-web/src/components/WorkflowProgress/` 디렉토리

### T2: [v0.5.x CODE] useWorkflowProgress 훅
- **Complexity**: M
- **Dependencies**: Epic 6
- **Description**: 워크플로우 진행 상황 조회 훅
- **Acceptance Criteria**:
  - [ ] 활성 워크플로우 목록 로드
  - [ ] 단계별 진행 상황 조회
  - [ ] Realtime 구독

```typescript
// packages/office-web/src/hooks/useWorkflowProgress.ts

import { useState, useEffect } from 'react';
import { useSupabase } from './useSupabase';

interface WorkflowProgressData {
  instance: {
    id: string;
    userCommand: string;
    status: string;
    currentStep: string;
    startedAt: Date;
  };
  steps: StepProgress[];
}

interface StepProgress {
  id: string;
  name: string;
  agentName: string;
  status: 'pending' | 'in_progress' | 'waiting_input' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  artifacts?: string[];
}

export function useWorkflowProgress(officeId: string) {
  const supabase = useSupabase();
  const [workflows, setWorkflows] = useState<WorkflowProgressData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadWorkflows() {
      const { data: instances } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          workflow_step_executions(
            *,
            office_agents(name)
          )
        `)
        .eq('office_id', officeId)
        .in('status', ['active', 'paused'])
        .order('started_at', { ascending: false });

      if (instances) {
        setWorkflows(instances.map(mapToProgressData));
        if (!selectedId && instances.length > 0) {
          setSelectedId(instances[0].id);
        }
      }
      setIsLoading(false);
    }

    loadWorkflows();
  }, [officeId]);

  // Realtime 구독
  useEffect(() => {
    const channel = supabase
      .channel(`workflows:${officeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workflow_instances',
        filter: `office_id=eq.${officeId}`,
      }, handleInstanceChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workflow_step_executions',
      }, handleStepChange)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [officeId]);

  return {
    workflows,
    activeWorkflow: workflows.find(w => w.instance.id === selectedId) || null,
    selectWorkflow: setSelectedId,
    isLoading,
  };
}
```

### T3: [v0.5.x CODE] StepGraph 컴포넌트
- **Complexity**: M
- **Dependencies**: T2
- **Description**: 단계 진행 그래프 시각화
- **Acceptance Criteria**:
  - [ ] 단계별 원형 노드
  - [ ] 상태별 스타일 (완료/진행중/대기)
  - [ ] 연결선 표시

```typescript
// packages/office-web/src/components/WorkflowProgress/StepGraph.tsx

interface StepGraphProps {
  steps: StepProgress[];
  currentStepId?: string;
}

export function StepGraph({ steps, currentStepId }: StepGraphProps) {
  return (
    <div className="step-graph">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <StepNode
            step={step}
            isCurrent={step.id === currentStepId}
          />
          {index < steps.length - 1 && (
            <StepConnector
              completed={step.status === 'completed'}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function StepNode({ step, isCurrent }: { step: StepProgress; isCurrent: boolean }) {
  const statusIcon = {
    pending: '○',
    in_progress: '●',
    waiting_input: '⏸',
    completed: '✓',
    failed: '✗',
  };

  return (
    <div className={`step-node ${step.status} ${isCurrent ? 'current' : ''}`}>
      <span className="icon">{statusIcon[step.status]}</span>
      <span className="name">{step.name}</span>
    </div>
  );
}
```

### T4: [v0.5.x CODE] StepDetail 컴포넌트
- **Complexity**: S
- **Dependencies**: T2
- **Description**: 현재 단계 상세 정보 표시
- **Acceptance Criteria**:
  - [ ] 단계 이름, 담당 에이전트
  - [ ] 시작 시간, 소요 시간
  - [ ] 상태 표시

```typescript
// packages/office-web/src/components/WorkflowProgress/StepDetail.tsx

interface StepDetailProps {
  step: StepProgress;
}

export function StepDetail({ step }: StepDetailProps) {
  const elapsedTime = step.startedAt
    ? formatDuration(Date.now() - step.startedAt.getTime())
    : '-';

  return (
    <div className="step-detail">
      <h4>현재 단계: {step.name}</h4>
      <dl>
        <dt>담당</dt>
        <dd>{step.agentName}</dd>
        <dt>시작</dt>
        <dd>{step.startedAt ? formatRelativeTime(step.startedAt) : '대기 중'}</dd>
        <dt>소요 시간</dt>
        <dd>{elapsedTime}</dd>
        <dt>상태</dt>
        <dd className={`status-${step.status}`}>{getStatusLabel(step.status)}</dd>
      </dl>
    </div>
  );
}
```

### T5: [v0.5.x CODE] ArtifactPreview 모달
- **Complexity**: M
- **Dependencies**: T2
- **Description**: 결과물 미리보기 모달
- **Acceptance Criteria**:
  - [ ] GitHub Issue 링크 표시
  - [ ] 마크다운 미리보기
  - [ ] JSON 뷰어
  - [ ] 파일 다운로드 링크

```typescript
// packages/office-web/src/components/WorkflowProgress/ArtifactPreview.tsx

interface ArtifactPreviewProps {
  artifacts: Artifact[];
  onClose: () => void;
}

interface Artifact {
  type: 'github_issue' | 'markdown' | 'json' | 'file_path';
  content: unknown;
}

export function ArtifactPreview({ artifacts, onClose }: ArtifactPreviewProps) {
  return (
    <Modal onClose={onClose} title="결과물">
      <div className="artifact-list">
        {artifacts.map((artifact, idx) => (
          <ArtifactItem key={idx} artifact={artifact} />
        ))}
      </div>
    </Modal>
  );
}

function ArtifactItem({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case 'github_issue':
      return (
        <a href={artifact.content.url} target="_blank" rel="noopener noreferrer">
          📋 {artifact.content.repo}#{artifact.content.number}
        </a>
      );
    case 'markdown':
      return <MarkdownPreview content={artifact.content} />;
    case 'json':
      return <JsonViewer data={artifact.content} />;
    case 'file_path':
      return <span>📁 {artifact.content}</span>;
  }
}
```

### T6: [v0.5.x CODE] WorkflowProgress 통합
- **Complexity**: M
- **Dependencies**: T2-T5
- **Description**: 워크플로우 진행 상황 전체 컴포넌트
- **Acceptance Criteria**:
  - [ ] 워크플로우 선택 드롭다운
  - [ ] StepGraph + StepDetail 조합
  - [ ] 결과물 보기 버튼

```typescript
// packages/office-web/src/components/WorkflowProgress/index.tsx

export function WorkflowProgress({ officeId }: { officeId: string }) {
  const {
    workflows,
    activeWorkflow,
    selectWorkflow,
    isLoading,
  } = useWorkflowProgress(officeId);

  const [showArtifacts, setShowArtifacts] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (!activeWorkflow) return <EmptyState message="진행 중인 워크플로우가 없습니다" />;

  const currentStep = activeWorkflow.steps.find(
    s => s.id === activeWorkflow.instance.currentStep
  );

  return (
    <div className="workflow-progress">
      <header>
        <h3>📋 워크플로우 진행 상황</h3>
        {workflows.length > 1 && (
          <WorkflowSelector
            workflows={workflows}
            selected={activeWorkflow.instance.id}
            onSelect={selectWorkflow}
          />
        )}
      </header>

      <div className="workflow-title">
        {activeWorkflow.instance.userCommand}
      </div>

      <StepGraph
        steps={activeWorkflow.steps}
        currentStepId={activeWorkflow.instance.currentStep}
      />

      {currentStep && <StepDetail step={currentStep} />}

      <button onClick={() => setShowArtifacts(true)}>
        결과물 보기
      </button>

      {showArtifacts && (
        <ArtifactPreview
          artifacts={collectArtifacts(activeWorkflow.steps)}
          onClose={() => setShowArtifacts(false)}
        />
      )}
    </div>
  );
}
```

### T7: [v0.5.x CODE] Frontmatter 파서/생성기
- **Complexity**: M
- **Dependencies**: -
- **Description**: 마크다운 Frontmatter 파싱 유틸
- **Acceptance Criteria**:
  - [ ] YAML frontmatter 파싱
  - [ ] YAML frontmatter 생성
  - [ ] 에러 처리

```typescript
// packages/office-web/src/utils/frontmatter.ts

import YAML from 'yaml';

export interface FrontmatterResult {
  frontmatter: Record<string, unknown>;
  content: string;
}

export function parseFrontmatter(markdown: string): FrontmatterResult {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content: markdown };
  }

  try {
    const frontmatter = YAML.parse(match[1]) || {};
    const content = match[2];
    return { frontmatter, content };
  } catch (error) {
    console.error('Failed to parse frontmatter:', error);
    return { frontmatter: {}, content: markdown };
  }
}

export function generateMarkdown(
  frontmatter: Record<string, unknown>,
  content: string
): string {
  const yaml = YAML.stringify(frontmatter, { indent: 2 });
  return `---\n${yaml}---\n${content}`;
}

export function validateFrontmatter(frontmatter: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!frontmatter.name) {
    errors.push('name 필드가 필요합니다');
  }
  if (!frontmatter.description) {
    errors.push('description 필드가 필요합니다');
  }

  return errors;
}
```

### T8: [v0.5.x CODE] useAgentDefinitions 훅
- **Complexity**: M
- **Dependencies**: Epic 2
- **Description**: 에이전트 정의 CRUD 훅
- **Acceptance Criteria**:
  - [ ] 목록 조회
  - [ ] 단일 조회
  - [ ] 업데이트

```typescript
// packages/office-web/src/hooks/useAgentDefinitions.ts

export function useAgentDefinitions(officeId: string) {
  const supabase = useSupabase();
  const [definitions, setDefinitions] = useState<AgentDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('agent_definitions')
        .select('*')
        .eq('office_id', officeId)
        .eq('is_active', true)
        .order('name');

      if (data) setDefinitions(data);
      setIsLoading(false);
    }
    load();
  }, [officeId]);

  const getDefinition = useCallback(async (name: string) => {
    const { data } = await supabase
      .from('agent_definitions')
      .select('*')
      .eq('office_id', officeId)
      .eq('name', name)
      .single();
    return data;
  }, [officeId, supabase]);

  const updateDefinition = useCallback(async (
    name: string,
    content: string,
    frontmatter: Record<string, unknown>
  ) => {
    const { error } = await supabase
      .from('agent_definitions')
      .update({
        definition_content: content,
        frontmatter,
        updated_at: new Date().toISOString(),
      })
      .eq('office_id', officeId)
      .eq('name', name);

    if (error) throw error;
  }, [officeId, supabase]);

  return {
    definitions,
    isLoading,
    getDefinition,
    updateDefinition,
  };
}
```

### T9: [v0.5.x CODE] DefinitionList 컴포넌트
- **Complexity**: S
- **Dependencies**: T8
- **Description**: 에이전트/스킬 정의 목록
- **Acceptance Criteria**:
  - [ ] 이름, 역할 표시
  - [ ] 선택 기능
  - [ ] 활성/비활성 표시

### T10: [v0.5.x CODE] Monaco Editor 통합
- **Complexity**: M
- **Dependencies**: -
- **Description**: Monaco Editor 설정 및 통합
- **Acceptance Criteria**:
  - [ ] 마크다운 언어 모드
  - [ ] 기본 테마 설정
  - [ ] 자동 저장 (debounce)

```typescript
// packages/office-web/src/components/admin/MarkdownEditor.tsx

import Editor from '@monaco-editor/react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

export function MarkdownEditor({ value, onChange, height = '400px' }: MarkdownEditorProps) {
  return (
    <Editor
      height={height}
      language="markdown"
      theme="vs-dark"
      value={value}
      onChange={(value) => onChange(value || '')}
      options={{
        minimap: { enabled: false },
        wordWrap: 'on',
        lineNumbers: 'on',
        fontSize: 14,
      }}
    />
  );
}
```

### T11: [v0.5.x CODE] FrontmatterForm 컴포넌트
- **Complexity**: M
- **Dependencies**: T7
- **Description**: Frontmatter 편집 폼
- **Acceptance Criteria**:
  - [ ] name, description 필드
  - [ ] tools 배열 편집
  - [ ] model 선택

```typescript
// packages/office-web/src/components/admin/FrontmatterForm.tsx

interface FrontmatterFormProps {
  frontmatter: Record<string, unknown>;
  onChange: (frontmatter: Record<string, unknown>) => void;
}

export function FrontmatterForm({ frontmatter, onChange }: FrontmatterFormProps) {
  const handleChange = (key: string, value: unknown) => {
    onChange({ ...frontmatter, [key]: value });
  };

  return (
    <div className="frontmatter-form">
      <div className="field">
        <label>Name</label>
        <input
          type="text"
          value={frontmatter.name as string || ''}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Description</label>
        <textarea
          value={frontmatter.description as string || ''}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Model</label>
        <select
          value={frontmatter.model as string || 'sonnet'}
          onChange={(e) => handleChange('model', e.target.value)}
        >
          <option value="sonnet">Sonnet</option>
          <option value="opus">Opus</option>
          <option value="haiku">Haiku</option>
        </select>
      </div>

      <div className="field">
        <label>Tools</label>
        <ToolsEditor
          tools={frontmatter.tools as string[] || []}
          onChange={(tools) => handleChange('tools', tools)}
        />
      </div>
    </div>
  );
}
```

### T12: [v0.5.x CODE] AgentDefinitionEditor 통합
- **Complexity**: L
- **Dependencies**: T7-T11
- **Description**: 에이전트 정의 편집기 전체 통합
- **Acceptance Criteria**:
  - [ ] 정의 선택/로드
  - [ ] 마크다운 편집
  - [ ] Frontmatter 폼 동기화
  - [ ] 저장 기능

```typescript
// packages/office-web/src/components/admin/AgentDefinitionEditor.tsx

export function AgentDefinitionEditor({ officeId }: { officeId: string }) {
  const { definitions, getDefinition, updateDefinition } = useAgentDefinitions(officeId);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 정의 로드
  useEffect(() => {
    if (selected) {
      getDefinition(selected).then((def) => {
        if (def) {
          setContent(def.definition_content);
          const { frontmatter: fm } = parseFrontmatter(def.definition_content);
          setFrontmatter(fm);
          setIsDirty(false);
        }
      });
    }
  }, [selected]);

  // 마크다운 변경 시 frontmatter 동기화
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    const { frontmatter: fm } = parseFrontmatter(newContent);
    setFrontmatter(fm);
    setIsDirty(true);
  };

  // Frontmatter 폼 변경 시 마크다운 동기화
  const handleFrontmatterChange = (fm: Record<string, unknown>) => {
    setFrontmatter(fm);
    const { content: body } = parseFrontmatter(content);
    const newContent = generateMarkdown(fm, body);
    setContent(newContent);
    setIsDirty(true);
  };

  // 저장
  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await updateDefinition(selected, content, frontmatter);
      setIsDirty(false);
    } catch (error) {
      alert('저장 실패: ' + error.message);
    }
    setIsSaving(false);
  };

  return (
    <div className="agent-definition-editor">
      <aside>
        <DefinitionList
          definitions={definitions}
          selected={selected}
          onSelect={setSelected}
        />
      </aside>

      <main>
        {selected ? (
          <>
            <div className="editor-header">
              <h3>{selected}</h3>
              <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>

            <div className="editor-body">
              <FrontmatterForm
                frontmatter={frontmatter}
                onChange={handleFrontmatterChange}
              />
              <MarkdownEditor
                value={content}
                onChange={handleContentChange}
              />
            </div>
          </>
        ) : (
          <EmptyState message="편집할 에이전트를 선택하세요" />
        )}
      </main>
    </div>
  );
}
```

### T13: [v0.5.x CODE] SkillDefinitionEditor 구현
- **Complexity**: L
- **Dependencies**: T7-T10
- **Description**: 스킬 정의 편집기
- **Acceptance Criteria**:
  - [ ] SKILL.md 편집
  - [ ] references 파일 목록/편집
  - [ ] 새 reference 추가

### T14: [v0.4.x TESTS] 컴포넌트 단위 테스트
- **Complexity**: M
- **Dependencies**: T6, T12, T13
- **Description**: UI 컴포넌트 테스트
- **Acceptance Criteria**:
  - [ ] WorkflowProgress 렌더링 테스트
  - [ ] AgentDefinitionEditor 상호작용 테스트
  - [ ] Frontmatter 파싱 테스트

## Test Requirements

### Frontmatter 파서 테스트
```typescript
describe('parseFrontmatter', () => {
  it('should parse valid frontmatter', () => {
    const markdown = `---
name: test
description: Test agent
---
# Content`;

    const result = parseFrontmatter(markdown);
    expect(result.frontmatter.name).toBe('test');
    expect(result.content.trim()).toBe('# Content');
  });

  it('should handle markdown without frontmatter', () => {
    const markdown = '# Just content';
    const result = parseFrontmatter(markdown);
    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe('# Just content');
  });
});
```

### 컴포넌트 테스트
```typescript
describe('WorkflowProgress', () => {
  it('should render step graph with correct status', () => {
    const { getByText } = render(
      <WorkflowProgress officeId="test-office" />
    );

    // 단계 표시 확인
    expect(getByText('분석')).toBeInTheDocument();
    expect(getByText('설계')).toBeInTheDocument();
  });
});
```
