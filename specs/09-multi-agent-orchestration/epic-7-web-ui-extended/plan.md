# Multi-Agent Orchestration - Web UI Extended Implementation Plan

## Overview

워크플로우 진행 상황 표시 UI와 에이전트/스킬 정의 편집 UI 구현.
Monaco Editor를 사용하여 마크다운 편집 제공.

## Technical Approach

### 1. useWorkflowProgress 훅 설계

```typescript
// packages/office-web/src/hooks/useWorkflowProgress.ts

interface WorkflowProgressData {
  instance: WorkflowInstance;
  steps: StepProgress[];
  currentStep: StepProgress | null;
  artifacts: Artifact[];
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

interface UseWorkflowProgressResult {
  workflows: WorkflowProgressData[];
  activeWorkflow: WorkflowProgressData | null;
  selectWorkflow: (instanceId: string) => void;
  isLoading: boolean;
}

function useWorkflowProgress(officeId: string): UseWorkflowProgressResult;
```

### 2. WorkflowProgress 컴포넌트 설계

```
+------------------------------------------+
| 📋 워크플로우 진행 상황                    |
+------------------------------------------+
| [기능 요청: 로그인 구현] ← 활성 워크플로우   |
+------------------------------------------+
|                                          |
|  ○──●──○──○                              |
|  분석 설계 구현 테스트                     |
|  ✓   ●   ○   ○                           |
|                                          |
| 현재 단계: 설계                            |
| 담당: Architect Agent                     |
| 시작: 10분 전                              |
|                                          |
| [결과물 보기]                              |
+------------------------------------------+
```

### 3. 에이전트 정의 편집기 설계

```typescript
// packages/office-web/src/components/admin/AgentDefinitionEditor.tsx

interface AgentDefinitionEditorProps {
  officeId: string;
  agentName?: string;  // 없으면 목록에서 선택
  onSave?: (definition: AgentDefinition) => void;
}

// 편집기 상태
interface EditorState {
  originalContent: string;
  currentContent: string;
  parsedFrontmatter: Record<string, unknown>;
  isDirty: boolean;
  isValid: boolean;
  validationErrors: string[];
}
```

### 4. Frontmatter 파서/생성기

```typescript
// packages/office-web/src/utils/frontmatter.ts

interface FrontmatterResult {
  frontmatter: Record<string, unknown>;
  content: string;
}

// 파싱
export function parseFrontmatter(markdown: string): FrontmatterResult {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content: markdown };

  const yaml = match[1];
  const content = match[2];
  const frontmatter = parseYaml(yaml);

  return { frontmatter, content };
}

// 생성
export function generateMarkdown(frontmatter: Record<string, unknown>, content: string): string {
  const yaml = stringifyYaml(frontmatter);
  return `---\n${yaml}---\n${content}`;
}
```

### 5. 스킬 정의 편집기

```typescript
// packages/office-web/src/components/admin/SkillDefinitionEditor.tsx

interface SkillDefinitionEditorProps {
  officeId: string;
  skillName?: string;
}

// 스킬 = SKILL.md + references/ 디렉토리
interface SkillEditorState {
  skillContent: string;
  references: { filename: string; content: string }[];
  isDirty: boolean;
}
```

## Dependencies

### 외부 의존성
- `@monaco-editor/react` (코드 에디터)
- `yaml` (YAML 파싱)
- Epic 2의 정의 CRUD API

### 선행 작업
- Epic 1-6 완료
- 정의 CRUD API 존재

## File Structure

```
packages/office-web/src/
├── hooks/
│   ├── useWorkflowProgress.ts
│   └── useAgentDefinitions.ts
├── components/
│   ├── WorkflowProgress/
│   │   ├── index.tsx
│   │   ├── StepGraph.tsx
│   │   ├── StepDetail.tsx
│   │   └── ArtifactPreview.tsx
│   └── admin/
│       ├── AgentDefinitionEditor.tsx
│       ├── SkillDefinitionEditor.tsx
│       ├── DefinitionList.tsx
│       └── FrontmatterForm.tsx
└── utils/
    └── frontmatter.ts
```
