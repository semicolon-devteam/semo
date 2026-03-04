/**
 * Supabase Client
 *
 * Database client for Semo Office.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Office,
  AgentPersona,
  Worktree,
  OfficeAgent,
  Job,
  AgentMessage,
  AgentRole,
  JobStatus,
} from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseClient;
}

// === Office Operations ===

export async function createOffice(
  data: Omit<Office, 'id' | 'created_at' | 'updated_at'>
): Promise<Office> {
  const { data: office, error } = await getSupabaseClient()
    .from('offices')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return office;
}

export async function getOffice(id: string): Promise<Office | null> {
  const { data, error } = await getSupabaseClient()
    .from('offices')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function listOffices(): Promise<Office[]> {
  const { data, error } = await getSupabaseClient()
    .from('offices')
    .select()
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteOffice(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('offices')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// === Persona Operations ===

export async function getPersonas(role?: AgentRole): Promise<AgentPersona[]> {
  let query = getSupabaseClient()
    .from('agent_personas')
    .select();

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query.order('role');

  if (error) throw error;
  return data || [];
}

export async function getDefaultPersona(role: AgentRole): Promise<AgentPersona | null> {
  const { data, error } = await getSupabaseClient()
    .from('agent_personas')
    .select()
    .eq('role', role)
    .eq('is_default', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createPersona(
  data: Omit<AgentPersona, 'id' | 'created_at' | 'updated_at'>
): Promise<AgentPersona> {
  const { data: persona, error } = await getSupabaseClient()
    .from('agent_personas')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return persona;
}

// === Worktree Operations ===

export async function createWorktreeRecord(
  data: Omit<Worktree, 'id' | 'created_at' | 'updated_at'>
): Promise<Worktree> {
  const { data: worktree, error } = await getSupabaseClient()
    .from('worktrees')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return worktree;
}

export async function getWorktree(officeId: string, agentRole: AgentRole): Promise<Worktree | null> {
  const { data, error } = await getSupabaseClient()
    .from('worktrees')
    .select()
    .eq('office_id', officeId)
    .eq('agent_role', agentRole)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function updateWorktree(
  id: string,
  updates: Partial<Omit<Worktree, 'id'>>
): Promise<Worktree> {
  const { data, error } = await getSupabaseClient()
    .from('worktrees')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWorktreeRecord(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('worktrees')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// === Agent Operations ===

export async function createAgent(
  data: Omit<OfficeAgent, 'id' | 'updated_at'>
): Promise<OfficeAgent> {
  const { data: agent, error } = await getSupabaseClient()
    .from('office_agents')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return agent;
}

export async function getAgents(officeId: string): Promise<(OfficeAgent & { persona?: AgentPersona })[]> {
  const { data, error } = await getSupabaseClient()
    .from('office_agents')
    .select('*, persona:agent_personas(*)')
    .eq('office_id', officeId);

  if (error) throw error;
  return data || [];
}

export async function updateAgent(
  id: string,
  updates: Partial<Omit<OfficeAgent, 'id'>>
): Promise<OfficeAgent> {
  const { data, error } = await getSupabaseClient()
    .from('office_agents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// === Job Operations ===

export async function createJob(
  data: Omit<Job, 'id' | 'created_at'>
): Promise<Job> {
  const { data: job, error } = await getSupabaseClient()
    .from('job_queue')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return job;
}

export async function getJobs(officeId: string, status?: JobStatus): Promise<Job[]> {
  let query = getSupabaseClient()
    .from('job_queue')
    .select()
    .eq('office_id', officeId);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('priority').order('created_at');

  if (error) throw error;
  return data || [];
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await getSupabaseClient()
    .from('job_queue')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function updateJob(
  id: string,
  updates: Partial<Omit<Job, 'id'>>
): Promise<Job> {
  const { data, error } = await getSupabaseClient()
    .from('job_queue')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getReadyJobs(officeId: string): Promise<Job[]> {
  return getJobs(officeId, 'ready');
}

export async function updateDependentJobs(officeId: string, completedJobId: string): Promise<void> {
  // Get all pending jobs that depend on the completed job
  const { data: pendingJobs, error: fetchError } = await getSupabaseClient()
    .from('job_queue')
    .select()
    .eq('office_id', officeId)
    .eq('status', 'pending')
    .contains('depends_on', [completedJobId]);

  if (fetchError) throw fetchError;
  if (!pendingJobs) return;

  // Check each job to see if all dependencies are now complete
  for (const job of pendingJobs) {
    const { data: deps, error: depsError } = await getSupabaseClient()
      .from('job_queue')
      .select('id, status')
      .in('id', job.depends_on);

    if (depsError) throw depsError;

    const allDepsComplete = deps?.every(
      (d) => d.status === 'done' || d.status === 'merged'
    );

    if (allDepsComplete) {
      await updateJob(job.id, { status: 'ready' });
    }
  }
}

// === Message Operations ===

export async function createMessage(
  data: Omit<AgentMessage, 'id' | 'created_at'>
): Promise<AgentMessage> {
  const { data: message, error } = await getSupabaseClient()
    .from('agent_messages')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return message;
}

export async function getMessages(
  officeId: string,
  limit: number = 50
): Promise<AgentMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from('agent_messages')
    .select()
    .eq('office_id', officeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).reverse();
}
