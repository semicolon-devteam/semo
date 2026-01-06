/**
 * Semo Office Server Types
 */

export interface Office {
  id: string;
  name: string;
  github_org: string;
  github_repo: string;
  repo_path?: string;
  layout: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentPersona {
  id: string;
  role: AgentRole;
  name?: string;
  avatar_config: Record<string, unknown>;
  persona_prompt: string;
  scope_patterns: string[];
  skill_ids: string[];
  core_skills: string[];
  knowledge_refs: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentRole = 'PO' | 'PM' | 'Architect' | 'FE' | 'BE' | 'QA' | 'DevOps';

export interface Worktree {
  id: string;
  office_id: string;
  agent_role: AgentRole;
  path: string;
  branch: string;
  session_id?: string;
  status: WorktreeStatus;
  created_at: string;
  updated_at: string;
}

export type WorktreeStatus = 'idle' | 'working' | 'blocked';

export interface OfficeAgent {
  id: string;
  office_id: string;
  persona_id: string;
  worktree_id?: string;
  session_id?: string;
  status: AgentStatus;
  position_x: number;
  position_y: number;
  current_task?: string;
  last_message?: string;
  updated_at: string;
}

export type AgentStatus = 'idle' | 'working' | 'blocked';

export interface Job {
  id: string;
  office_id: string;
  agent_id?: string;
  worktree_id?: string;
  description: string;
  status: JobStatus;
  depends_on: string[];
  pr_number?: number;
  branch_name?: string;
  priority: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export type JobStatus = 'pending' | 'ready' | 'processing' | 'done' | 'merged' | 'failed';

export interface AgentMessage {
  id: string;
  office_id: string;
  from_agent_id?: string;
  to_agent_id?: string;
  message_type: MessageType;
  content: string;
  context: Record<string, unknown>;
  created_at: string;
}

export type MessageType = 'request' | 'response' | 'notification' | 'handoff';

// Task Decomposer Types

export interface DecompositionRequest {
  office_id: string;
  request: string;
  context?: ProjectContext;
}

export interface ProjectContext {
  repo?: string;
  tech_stack?: string[];
  existing_files?: string[];
}

export interface DecompositionResult {
  request_summary: string;
  jobs: DecomposedJob[];
  dependency_graph: DependencyEdge[];
  execution_order: string[][];
  estimated_agents: number;
}

export interface DecomposedJob {
  id: string;
  role: AgentRole;
  description: string;
  scope: string[];
  depends_on: string[];
  persona_id?: string;
  skills: string[];
  priority: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
}
