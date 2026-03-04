/**
 * Session Executor (semo-remote-client 통합)
 *
 * Supabase Realtime을 통해 semo-remote-client와 통신하여
 * iTerm2에서 Claude Code 세션을 관리합니다.
 *
 * 흐름:
 * 1. Office Server: agent_commands에 명령 INSERT
 * 2. semo-remote-client: Realtime으로 수신 → iTerm2 Python API 실행
 * 3. semo-remote-client: agent_command_results에 결과 저장
 * 4. Office Server: Realtime으로 결과 수신
 */

import { EventEmitter } from 'events';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { AgentPersona, Job } from '../types.js';

export interface ExecutorConfig {
  supabaseUrl: string;
  supabaseKey: string;
  timeout: number; // 기본 타임아웃 (ms)
  pollInterval: number; // 결과 폴링 간격 (ms)
  verbose: boolean;
}

export interface ExecutionContext {
  job: Job;
  persona: AgentPersona;
  worktreePath: string;
  officeId: string;
  agentId?: string;
}

export interface ExecutionResult {
  success: boolean;
  jobId: string;
  commandId?: string;
  output: string;
  error?: string;
  prNumber?: number;
  duration: number;
}

// Command types for semo-remote-client
export type CommandType =
  | 'create_session'
  | 'send_prompt'
  | 'send_text'
  | 'get_output'
  | 'cancel'
  | 'terminate';

export interface AgentCommand {
  id: string;
  office_id: string;
  agent_id?: string;
  job_id?: string;
  iterm_session_id?: string;
  command_type: CommandType;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
  error_message?: string;
  created_at: string;
  processed_at?: string;
  completed_at?: string;
  timeout_seconds: number;
}

export interface AgentCommandResult {
  id: string;
  command_id: string;
  success: boolean;
  output?: string;
  pr_number?: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentSession {
  id: string;
  office_id: string;
  agent_id?: string;
  worktree_id?: string;
  iterm_session_id: string;
  iterm_tab_name?: string;
  is_claude_code: boolean;
  claude_version?: string;
  status: 'active' | 'idle' | 'disconnected';
  cwd?: string;
  last_activity_at: string;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || '',
  timeout: 5 * 60 * 1000, // 5분
  pollInterval: 1000, // 1초
  verbose: true,
};

export class SessionExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private supabase: SupabaseClient | null = null;
  private resultChannel: RealtimeChannel | null = null;
  private pendingCommands: Map<string, {
    resolve: (result: ExecutionResult) => void;
    startTime: number;
    jobId: string;
  }> = new Map();

  constructor(config: Partial<ExecutorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the executor and subscribe to results
   */
  async initialize(): Promise<void> {
    if (!this.config.supabaseUrl || !this.config.supabaseKey) {
      console.warn('[SessionExecutor] Supabase credentials not configured');
      return;
    }

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey
    );

    // Subscribe to command results
    this.resultChannel = this.supabase
      .channel('agent_command_results')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_command_results',
        },
        (payload) => {
          this.handleCommandResult(payload.new as AgentCommandResult);
        }
      )
      .subscribe();

    if (this.config.verbose) {
      console.log('[SessionExecutor] Initialized and subscribed to results');
    }
  }

  /**
   * Shutdown the executor
   */
  async shutdown(): Promise<void> {
    if (this.resultChannel && this.supabase) {
      await this.supabase.removeChannel(this.resultChannel);
      this.resultChannel = null;
    }
  }

  /**
   * Execute a job by sending command to semo-remote-client
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { job, persona, worktreePath, officeId, agentId } = context;
    const startTime = Date.now();

    this.emit('start', { jobId: job.id, worktreePath });

    if (!this.supabase) {
      return {
        success: false,
        jobId: job.id,
        output: '',
        error: 'Supabase not initialized',
        duration: Date.now() - startTime,
      };
    }

    try {
      // 1. Check if there's an existing session for this agent
      const existingSession = await this.findAgentSession(officeId, agentId);

      let commandId: string;

      if (existingSession) {
        // Use existing session - send prompt
        commandId = await this.sendPromptCommand(
          officeId,
          job,
          persona,
          existingSession.iterm_session_id,
          agentId
        );
      } else {
        // Create new session
        commandId = await this.createSessionCommand(
          officeId,
          job,
          persona,
          worktreePath,
          agentId
        );
      }

      // 2. Wait for result
      return this.waitForResult(commandId, job.id, startTime);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        jobId: job.id,
        output: '',
        error: message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Find existing agent session
   */
  private async findAgentSession(
    officeId: string,
    agentId?: string
  ): Promise<AgentSession | null> {
    if (!this.supabase) return null;

    const query = this.supabase
      .from('agent_sessions')
      .select('*')
      .eq('office_id', officeId)
      .eq('status', 'active')
      .eq('is_claude_code', true);

    if (agentId) {
      query.eq('agent_id', agentId);
    }

    const { data, error } = await query.single();

    if (error || !data) return null;
    return data as AgentSession;
  }

  /**
   * Send create_session command
   */
  private async createSessionCommand(
    officeId: string,
    job: Job,
    persona: AgentPersona,
    worktreePath: string,
    agentId?: string
  ): Promise<string> {
    if (!this.supabase) throw new Error('Supabase not initialized');

    const prompt = this.buildPrompt(job, persona);

    const command: Partial<AgentCommand> = {
      office_id: officeId,
      agent_id: agentId,
      job_id: job.id,
      command_type: 'create_session',
      payload: {
        worktree_path: worktreePath,
        persona_name: persona.name || persona.role,
        persona_prompt: persona.persona_prompt,
        skills: persona.core_skills,
        initial_prompt: prompt,
      },
      status: 'pending',
      timeout_seconds: Math.floor(this.config.timeout / 1000),
    };

    const { data, error } = await this.supabase
      .from('agent_commands')
      .insert(command)
      .select()
      .single();

    if (error) throw new Error(`Failed to create command: ${error.message}`);

    if (this.config.verbose) {
      console.log(`[SessionExecutor] Created session command: ${data.id}`);
    }
    return data.id;
  }

  /**
   * Send prompt to existing session
   */
  private async sendPromptCommand(
    officeId: string,
    job: Job,
    persona: AgentPersona,
    itermSessionId: string,
    agentId?: string
  ): Promise<string> {
    if (!this.supabase) throw new Error('Supabase not initialized');

    const prompt = this.buildPrompt(job, persona);

    const command: Partial<AgentCommand> = {
      office_id: officeId,
      agent_id: agentId,
      job_id: job.id,
      iterm_session_id: itermSessionId,
      command_type: 'send_prompt',
      payload: {
        prompt,
        method: 'applescript', // Use AppleScript for Claude Code
      },
      status: 'pending',
      timeout_seconds: Math.floor(this.config.timeout / 1000),
    };

    const { data, error } = await this.supabase
      .from('agent_commands')
      .insert(command)
      .select()
      .single();

    if (error) throw new Error(`Failed to create command: ${error.message}`);

    if (this.config.verbose) {
      console.log(`[SessionExecutor] Created prompt command: ${data.id}`);
    }
    return data.id;
  }

  /**
   * Wait for command result
   */
  private waitForResult(
    commandId: string,
    jobId: string,
    startTime: number
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      // Store pending command
      this.pendingCommands.set(commandId, {
        resolve,
        startTime,
        jobId,
      });

      // Set timeout
      setTimeout(() => {
        const pending = this.pendingCommands.get(commandId);
        if (pending) {
          this.pendingCommands.delete(commandId);
          this.emit('timeout', { jobId, commandId });
          resolve({
            success: false,
            jobId,
            commandId,
            output: '',
            error: 'Execution timed out',
            duration: Date.now() - startTime,
          });
        }
      }, this.config.timeout);
    });
  }

  /**
   * Handle command result from Realtime
   */
  private handleCommandResult(result: AgentCommandResult): void {
    const pending = this.pendingCommands.get(result.command_id);
    if (!pending) return;

    this.pendingCommands.delete(result.command_id);

    const executionResult: ExecutionResult = {
      success: result.success,
      jobId: pending.jobId,
      commandId: result.command_id,
      output: result.output || '',
      error: result.success ? undefined : 'Execution failed',
      prNumber: result.pr_number,
      duration: Date.now() - pending.startTime,
    };

    this.emit('complete', executionResult);
    pending.resolve(executionResult);
  }

  /**
   * Build prompt for Claude Code
   */
  private buildPrompt(job: Job, persona: AgentPersona): string {
    return `
[SEMO Office Agent Execution]

당신은 ${persona.name || persona.role} Agent입니다.

## 페르소나
${persona.persona_prompt}

## 담당 영역
${persona.scope_patterns.map((p) => `- ${p}`).join('\n')}

## 사용 가능한 스킬
${persona.core_skills.map((s) => `- ${s}`).join('\n')}

## 현재 작업
${job.description}

## 작업 규칙
1. 담당 영역 내의 파일만 수정하세요
2. 작업 완료 후 반드시 커밋하세요
3. 커밋 메시지에 Job ID를 포함하세요: [${job.id}]
4. 코드 작성 후 PR을 생성하세요 (gh pr create 사용)

## 작업 시작
위 작업을 수행해주세요.
`.trim();
  }

  /**
   * Cancel a running command
   */
  async cancel(commandId: string): Promise<boolean> {
    if (!this.supabase) return false;

    // Get the command to find session
    const { data: command } = await this.supabase
      .from('agent_commands')
      .select('*')
      .eq('id', commandId)
      .single();

    if (!command || !command.iterm_session_id) return false;

    // Send cancel command
    const { error } = await this.supabase.from('agent_commands').insert({
      office_id: command.office_id,
      iterm_session_id: command.iterm_session_id,
      command_type: 'cancel',
      payload: {},
      status: 'pending',
      timeout_seconds: 30,
    });

    if (error) return false;

    // Remove from pending
    this.pendingCommands.delete(commandId);
    return true;
  }

  /**
   * Cancel all pending commands for a job
   */
  cancelAll(): void {
    for (const [commandId, pending] of this.pendingCommands) {
      this.cancel(commandId).catch(() => {});
      pending.resolve({
        success: false,
        jobId: pending.jobId,
        commandId,
        output: '',
        error: 'Cancelled',
        duration: Date.now() - pending.startTime,
      });
    }
    this.pendingCommands.clear();
  }

  /**
   * Check if a command is pending
   */
  isRunning(commandId: string): boolean {
    return this.pendingCommands.has(commandId);
  }

  /**
   * Get all sessions for an office
   */
  async getSessions(officeId: string): Promise<AgentSession[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('agent_sessions')
      .select('*')
      .eq('office_id', officeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as AgentSession[];
  }

  /**
   * Get pending commands count
   */
  getPendingCount(): number {
    return this.pendingCommands.size;
  }

  /**
   * Get active count (alias for compatibility)
   */
  getActiveCount(): number {
    return this.getPendingCount();
  }
}
