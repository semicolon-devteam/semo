/**
 * Semo Office API Client
 *
 * Client for communicating with the office-server backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_OFFICE_SERVER_URL || 'http://localhost:3030';

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

export interface Job {
  id: string;
  office_id: string;
  description: string;
  status: 'pending' | 'ready' | 'processing' | 'done' | 'merged' | 'failed';
  depends_on: string[];
  pr_number?: number;
  branch_name?: string;
  priority: number;
  created_at: string;
}

export interface Agent {
  id: string;
  office_id: string;
  persona_id: string;
  status: 'idle' | 'working' | 'blocked' | 'moving' | 'listening' | 'error';
  position_x: number;
  position_y: number;
  target_x?: number | null;
  target_y?: number | null;
  current_task?: string;
  current_job_id?: string;
  last_message?: string;
  persona?: Persona;
}

export interface Persona {
  id: string;
  role: string;
  name?: string;
  persona_prompt: string;
  scope_patterns: string[];
  core_skills: string[];
  is_default: boolean;
}

export interface Message {
  id: string;
  office_id: string;
  from_agent_id?: string;
  to_agent_id?: string;
  message_type: string;
  content: string;
  created_at: string;
}

export interface TaskResult {
  message: string;
  summary: string;
  jobs: Job[];
  execution_order: string[][];
  estimated_agents: number;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || error.message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// === Office API ===

export async function listOffices(): Promise<{ offices: Office[] }> {
  return fetchApi('/api/offices');
}

export async function getOffice(id: string): Promise<Office> {
  return fetchApi(`/api/offices/${id}`);
}

export async function createOffice(data: {
  name: string;
  github_org: string;
  github_repo: string;
  repo_path?: string;
}): Promise<Office> {
  return fetchApi('/api/offices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteOffice(id: string): Promise<void> {
  return fetchApi(`/api/offices/${id}`, { method: 'DELETE' });
}

// === Task API ===

export async function submitTask(
  officeId: string,
  task: string,
  context?: Record<string, unknown>
): Promise<TaskResult> {
  return fetchApi(`/api/offices/${officeId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ task, context }),
  });
}

export async function getJobs(
  officeId: string,
  status?: string
): Promise<{ jobs: Job[]; total: number }> {
  const params = status ? `?status=${status}` : '';
  return fetchApi(`/api/offices/${officeId}/jobs${params}`);
}

export async function getJob(officeId: string, jobId: string): Promise<Job> {
  return fetchApi(`/api/offices/${officeId}/jobs/${jobId}`);
}

export async function updateJob(
  officeId: string,
  jobId: string,
  updates: { status?: string; pr_number?: number }
): Promise<Job> {
  return fetchApi(`/api/offices/${officeId}/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export interface ExecuteJobResult {
  message: string;
  job_id: string;
  status: string;
}

export async function executeJob(
  officeId: string,
  jobId: string,
  options?: { agent_id?: string; create_worktree?: boolean }
): Promise<ExecuteJobResult> {
  return fetchApi(`/api/offices/${officeId}/jobs/${jobId}/execute`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

// === Session API ===

export interface SessionStats {
  totalSessions: number;
  idleSessions: number;
  busySessions: number;
  pendingExecutions: number;
}

export interface Session {
  id: string;
  agentId?: string;
  jobId?: string;
  worktreePath: string;
  status: 'idle' | 'busy' | 'terminating';
  createdAt: string;
  lastActivityAt: string;
}

export async function getSessionStats(): Promise<SessionStats> {
  return fetchApi('/api/sessions/stats');
}

export async function getSessions(): Promise<{ sessions: Session[]; total: number }> {
  return fetchApi('/api/sessions');
}

export async function cancelSession(sessionId: string): Promise<{ success: boolean }> {
  return fetchApi(`/api/sessions/${sessionId}/cancel`, { method: 'POST' });
}

export async function terminateSession(sessionId: string): Promise<void> {
  return fetchApi(`/api/sessions/${sessionId}`, { method: 'DELETE' });
}

// === Agent API ===

export async function getAgents(
  officeId: string
): Promise<{ agents: Agent[]; total: number }> {
  return fetchApi(`/api/offices/${officeId}/agents`);
}

export async function createAgent(
  officeId: string,
  data: { persona_id: string; position_x?: number; position_y?: number }
): Promise<Agent> {
  return fetchApi(`/api/offices/${officeId}/agents`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAgent(
  officeId: string,
  agentId: string,
  updates: Partial<Agent>
): Promise<Agent> {
  return fetchApi(`/api/offices/${officeId}/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function sendAgentMessage(
  officeId: string,
  agentId: string,
  content: string
): Promise<Message> {
  return fetchApi(`/api/offices/${officeId}/agents/${agentId}/message`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// === Persona API ===

export async function getPersonas(
  role?: string
): Promise<{ personas: Persona[]; total: number }> {
  const params = role ? `?role=${role}` : '';
  return fetchApi(`/api/personas${params}`);
}

export async function createPersona(data: {
  role: string;
  name?: string;
  persona_prompt: string;
  scope_patterns?: string[];
  core_skills?: string[];
}): Promise<Persona> {
  return fetchApi('/api/personas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// === Message API ===

export async function getMessages(
  officeId: string,
  limit?: number
): Promise<{ messages: Message[]; total: number }> {
  const params = limit ? `?limit=${limit}` : '';
  return fetchApi(`/api/offices/${officeId}/messages${params}`);
}

export async function createMessage(
  officeId: string,
  data: {
    from_agent_id?: string;
    to_agent_id?: string;
    content: string;
    message_type?: string;
  }
): Promise<Message> {
  return fetchApi(`/api/offices/${officeId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// === Chat API (PM 조율 워크플로우) ===

export type ChatType = 'task_submit' | 'proximity_chat';

export interface ChatMessage {
  type: ChatType;
  content: string;
  target_agent_id?: string;
  sender_type?: 'user' | 'agent';
}

export interface ChatResult {
  success: boolean;
  type: ChatType;
  message_id: string;
  jobs?: Array<{
    id: string;
    role: string;
    description: string;
    scope: string[];
    depends_on: string[];
    skills: string[];
    priority: number;
  }>;
  session_id?: string;
  error?: string;
}

export interface AgentSession {
  agentId: string;
  sessionId: string;
  role: string;
  worktreePath?: string;
}

/**
 * Send a chat message to the office
 * - task_submit: PM이 수신하여 분해/분배
 * - proximity_chat: 특정 에이전트에게 직접 전송
 */
export async function sendChatMessage(
  officeId: string,
  message: ChatMessage
): Promise<ChatResult> {
  return fetchApi(`/api/offices/${officeId}/chat`, {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

/**
 * Get chat router stats
 */
export async function getChatStats(officeId: string): Promise<{
  officeId: string;
  pmAgentId?: string;
  registeredSessions: number;
  sessionsByRole: Record<string, number>;
}> {
  return fetchApi(`/api/offices/${officeId}/chat/stats`);
}

/**
 * Register an agent session for proximity chat
 */
export async function registerAgentSession(
  officeId: string,
  data: {
    agent_id: string;
    session_id: string;
    role: string;
    worktree_path?: string;
  }
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/offices/${officeId}/chat/sessions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Unregister an agent session
 */
export async function unregisterAgentSession(
  officeId: string,
  agentId: string
): Promise<{ success: boolean; message: string }> {
  return fetchApi(`/api/offices/${officeId}/chat/sessions/${agentId}`, {
    method: 'DELETE',
  });
}

/**
 * Get registered agent sessions
 */
export async function getAgentSessions(
  officeId: string
): Promise<{ sessions: AgentSession[]; total: number }> {
  return fetchApi(`/api/offices/${officeId}/chat/sessions`);
}

// === Health Check ===

export async function healthCheck(): Promise<{
  status: string;
  service: string;
  version: string;
}> {
  return fetchApi('/health');
}

// === Test API (Development Only) ===

export interface TestConfig {
  playgroundPath: string;
  configured: boolean;
}

export interface TestSessionResult {
  success: boolean;
  sessionId?: string;
  playgroundPath: string;
  message: string;
}

export interface TestPromptResult {
  success: boolean;
  output?: string;
  sessionId?: string;
  error?: string;
}

export interface TestOutputResult {
  success: boolean;
  output?: string;
  sessionId?: string;
  metadata?: {
    lineCount: number;
  };
}

/**
 * Get test configuration
 */
export async function getTestConfig(): Promise<TestConfig> {
  return fetchApi('/api/test/config');
}

/**
 * Create a test session with Claude Code
 */
export async function createTestSession(prompt?: string): Promise<TestSessionResult> {
  return fetchApi('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

/**
 * Send a prompt to a test session
 */
export async function sendTestPrompt(
  sessionId: string,
  prompt: string
): Promise<TestPromptResult> {
  return fetchApi('/api/test/prompt', {
    method: 'POST',
    body: JSON.stringify({ sessionId, prompt }),
  });
}

/**
 * Get output from a test session
 */
export async function getTestOutput(
  sessionId: string,
  lines?: number
): Promise<TestOutputResult> {
  const params = lines ? `?lines=${lines}` : '';
  return fetchApi(`/api/test/output/${sessionId}${params}`);
}
