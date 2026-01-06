/**
 * Semo Office API Client
 *
 * Client for communicating with the office-server backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_OFFICE_SERVER_URL || 'http://localhost:3001';

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
  status: 'idle' | 'working' | 'blocked';
  position_x: number;
  position_y: number;
  current_task?: string;
  last_message?: string;
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

// === Health Check ===

export async function healthCheck(): Promise<{
  status: string;
  service: string;
  version: string;
}> {
  return fetchApi('/health');
}
