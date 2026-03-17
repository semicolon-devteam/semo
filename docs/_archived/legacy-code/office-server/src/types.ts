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

/**
 * AgentRole is now a flexible string to support dynamic CRUD
 * without code changes. Common roles include:
 * - PO Team: Researcher, Planner, Architect, Designer
 * - PM Team: Publisher, FE, DBA, BE
 * - Ops Team: QA, Healer, Infra, Marketer
 * - Special: Orchestrator
 */
export type AgentRole = string;

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

export type WorktreeStatus = 'idle' | 'active' | 'working' | 'blocked' | 'dirty' | 'failed';

export interface OfficeAgent {
  id: string;
  office_id: string;
  persona_id: string;
  worktree_id?: string;
  session_id?: string;
  status: AgentStatus;
  position_x: number;
  position_y: number;
  target_x?: number;      // Target position when moving
  target_y?: number;      // Target position when moving
  current_task?: string;
  last_message?: string;
  updated_at: string;
}

/**
 * Agent status states:
 * - idle: Agent is waiting/inactive
 * - working: Agent is processing a job
 * - blocked: Agent is waiting for dependencies
 * - moving: Agent is moving to a new position
 * - listening: Agent is in Order Mode, listening to user
 * - error: Agent encountered an error
 */
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'moving' | 'listening' | 'error';

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

// Chat Types (PM 조율 워크플로우)

export type ChatType = 'task_submit' | 'proximity_chat';

export interface ChatMessage {
  id: string;
  office_id: string;
  type: ChatType;
  content: string;
  sender_type: 'user' | 'agent';
  sender_id?: string;           // agent_id (agent가 보낸 경우)
  target_agent_id?: string;     // 대상 agent (proximity_chat인 경우)
  created_at: string;
}

export interface ChatRouteResult {
  success: boolean;
  type: ChatType;
  message_id: string;
  jobs?: DecomposedJob[];       // task_submit인 경우 생성된 Job들
  session_id?: string;          // proximity_chat인 경우 대상 세션
  error?: string;
}
