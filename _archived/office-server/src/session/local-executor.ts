/**
 * Local Session Executor (node-pty + xterm-headless)
 *
 * Spawns and manages Claude Code sessions locally using node-pty.
 * Uses xterm-headless to render screen state for proper UPSERT streaming.
 *
 * Flow:
 * 1. Create PTY session with Claude Code
 * 2. PTY output is written to headless xterm for rendering
 * 3. Screen content is extracted as lines and streamed to clients
 * 4. Parse completion markers to detect job finish
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import xtermHeadless from '@xterm/headless';
const { Terminal } = xtermHeadless;
import type { AgentPersona, Job } from '../types.js';
import crypto from 'crypto';
import { PromptDetector, type DetectedPrompt } from './prompt-detector.js';
import { AutoResponder, type AutoResponseConfig, DEFAULT_AUTO_RESPONSE_CONFIG } from './auto-responder.js';

export interface LocalExecutorConfig {
  shell: string;
  claudeCommand: string;
  timeout: number;
  verbose: boolean;
  /** Max output buffer size in bytes */
  maxOutputBuffer: number;
  /** Working directory for sessions */
  defaultCwd: string;
}

// Type for headless xterm terminal instance
type TerminalInstance = InstanceType<typeof Terminal>;

export interface LocalSession {
  id: string;
  pty: pty.IPty;
  terminal: TerminalInstance;  // Headless xterm for screen rendering
  agentId?: string;
  jobId?: string;
  worktreePath: string;
  status: 'idle' | 'busy' | 'terminating';
  output: string[];
  lastScreenHash: string;  // For change detection
  createdAt: Date;
  lastActivityAt: Date;
  // Auto-response support
  autoResponder?: AutoResponder;
  lastPromptHash?: string;  // To avoid responding to same prompt twice
  pendingAutoResponse?: NodeJS.Timeout;  // Debounce timer for auto-response
}

export interface LocalExecutionContext {
  job: Job;
  persona: AgentPersona;
  worktreePath: string;
  officeId: string;
  agentId?: string;
}

export interface LocalExecutionResult {
  success: boolean;
  jobId: string;
  sessionId: string;
  output: string;
  error?: string;
  prNumber?: number;
  duration: number;
}

const DEFAULT_CONFIG: LocalExecutorConfig = {
  shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
  claudeCommand: 'claude',
  timeout: 10 * 60 * 1000, // 10 minutes
  verbose: true,
  maxOutputBuffer: 1024 * 1024, // 1MB
  defaultCwd: process.cwd(),
};

// Markers to detect completion
const COMPLETION_MARKERS = [
  '🤖 Generated with [Claude Code]',
  'PR created:',
  'Pull request created',
  'Successfully created PR',
  '[Job completed]',
  'Commit created:',
];

const ERROR_MARKERS = [
  'Error:',
  'error:',
  'Failed to',
  'Permission denied',
  'Command failed',
];

export class LocalSessionExecutor extends EventEmitter {
  private config: LocalExecutorConfig;
  private sessions: Map<string, LocalSession> = new Map();
  private pendingExecutions: Map<string, {
    resolve: (result: LocalExecutionResult) => void;
    reject: (error: Error) => void;
    startTime: number;
    timeoutId: NodeJS.Timeout;
  }> = new Map();
  private promptDetector: PromptDetector;
  private defaultAutoResponseConfig: Partial<AutoResponseConfig>;

  constructor(config: Partial<LocalExecutorConfig> = {}, autoResponseConfig?: Partial<AutoResponseConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.promptDetector = new PromptDetector();
    this.defaultAutoResponseConfig = autoResponseConfig || {};
  }

  /**
   * Initialize executor
   */
  async initialize(): Promise<void> {
    if (this.config.verbose) {
      console.log('[LocalExecutor] Initialized');
    }
  }

  /**
   * Shutdown all sessions
   */
  async shutdown(): Promise<void> {
    for (const [sessionId] of this.sessions) {
      await this.terminateSession(sessionId);
    }
    this.sessions.clear();
  }

  /**
   * Execute a job
   */
  async execute(context: LocalExecutionContext): Promise<LocalExecutionResult> {
    const { job, persona, worktreePath, agentId } = context;
    const startTime = Date.now();

    this.emit('start', { jobId: job.id, worktreePath });

    try {
      // Find or create session
      let session = this.findIdleSession(agentId);

      if (!session) {
        session = await this.createSession(worktreePath, agentId);
      }

      // Send prompt
      const prompt = this.buildPrompt(job, persona);
      session.jobId = job.id;
      session.status = 'busy';
      session.output = [];

      return await this.executePrompt(session, job.id, prompt, startTime);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        jobId: job.id,
        sessionId: '',
        output: '',
        error: message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Create a new session (public method for testing)
   * Returns immediately after session creation without waiting for completion
   */
  async createSessionOnly(
    worktreePath: string,
    agentId?: string,
    autoResponseConfig?: Partial<AutoResponseConfig>
  ): Promise<LocalSession> {
    return this.createSession(worktreePath, agentId, autoResponseConfig);
  }

  /**
   * Create a new PTY session with Claude Code
   */
  private async createSession(
    worktreePath: string,
    agentId?: string,
    autoResponseConfig?: Partial<AutoResponseConfig>
  ): Promise<LocalSession> {
    const sessionId = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const cols = 120;
    const rows = 30;

    // Create headless terminal for screen rendering
    const terminal = new Terminal({
      cols,
      rows,
      allowProposedApi: true,
    });

    const ptyProcess = pty.spawn(this.config.shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: worktreePath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
      },
    });

    // Merge auto-response config: param > default > DEFAULT_AUTO_RESPONSE_CONFIG
    const mergedAutoResponseConfig: AutoResponseConfig = {
      ...DEFAULT_AUTO_RESPONSE_CONFIG,
      ...this.defaultAutoResponseConfig,
      ...autoResponseConfig,
    };

    const session: LocalSession = {
      id: sessionId,
      pty: ptyProcess,
      terminal,
      agentId,
      worktreePath,
      status: 'idle',
      output: [],
      lastScreenHash: '',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      // Auto-response support
      autoResponder: new AutoResponder(mergedAutoResponseConfig),
    };

    // Handle output - write to headless terminal and emit screen content
    ptyProcess.onData((data) => {
      this.handleSessionOutput(sessionId, data);
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      if (this.config.verbose) {
        console.log(`[LocalExecutor] Session ${sessionId} exited: code=${exitCode}, signal=${signal}`);
      }
      this.handleSessionExit(sessionId, exitCode);
    });

    this.sessions.set(sessionId, session);

    // Start Claude Code
    await this.startClaudeCode(session);

    if (this.config.verbose) {
      console.log(`[LocalExecutor] Created session: ${sessionId} in ${worktreePath}`);
    }

    return session;
  }

  /**
   * Start Claude Code in the session
   */
  private startClaudeCode(session: LocalSession): Promise<void> {
    return new Promise((resolve) => {
      session.pty.write(`${this.config.claudeCommand}\r`);
      // Wait for Claude Code to initialize
      setTimeout(resolve, 2000);
    });
  }

  /**
   * Execute a prompt in the session
   */
  private executePrompt(
    session: LocalSession,
    jobId: string,
    prompt: string,
    startTime: number
  ): Promise<LocalExecutionResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = this.pendingExecutions.get(session.id);
        if (pending) {
          this.pendingExecutions.delete(session.id);
          session.status = 'idle';
          this.emit('timeout', { jobId, sessionId: session.id });
          resolve({
            success: false,
            jobId,
            sessionId: session.id,
            output: session.output.join(''),
            error: 'Execution timed out',
            duration: Date.now() - startTime,
          });
        }
      }, this.config.timeout);

      this.pendingExecutions.set(session.id, {
        resolve,
        reject,
        startTime,
        timeoutId,
      });

      // Send prompt (escape newlines for terminal)
      const escapedPrompt = prompt.replace(/\n/g, '\\n');
      session.pty.write(`${escapedPrompt}\r`);
    });
  }

  /**
   * Extract screen content from headless terminal
   */
  private getScreenContent(terminal: TerminalInstance): string {
    const buffer = terminal.buffer.active;
    const lines: string[] = [];

    // Get all lines including scrollback
    const totalRows = buffer.length;
    for (let i = 0; i < totalRows; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true)); // true = trim trailing whitespace
      }
    }

    // Remove trailing empty lines
    while (lines.length > 0 && !lines[lines.length - 1].trim()) {
      lines.pop();
    }

    return lines.join('\n');
  }

  /**
   * Handle output from PTY
   */
  private handleSessionOutput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Write to headless terminal for rendering
    session.terminal.write(data);
    session.output.push(data);
    session.lastActivityAt = new Date();

    // Trim raw output buffer if too large
    const totalLength = session.output.reduce((acc, s) => acc + s.length, 0);
    if (totalLength > this.config.maxOutputBuffer) {
      session.output = session.output.slice(-100);
    }

    // Extract rendered screen content
    const screenContent = this.getScreenContent(session.terminal);
    const screenHash = crypto.createHash('md5').update(screenContent).digest('hex');

    // Only emit if screen content has changed
    if (screenHash !== session.lastScreenHash) {
      session.lastScreenHash = screenHash;
      // Emit screen event with full rendered content (UPSERT style)
      this.emit('screen', { sessionId, content: screenContent });

      // Auto-response: Detect and respond to prompts
      this.tryAutoRespond(session, screenContent, screenHash);
    }

    // Also emit raw output for legacy compatibility
    this.emit('output', { sessionId, data });

    // Check for completion
    const fullOutput = session.output.join('');
    const pending = this.pendingExecutions.get(sessionId);

    if (pending && session.jobId) {
      // Check for completion markers
      const isComplete = COMPLETION_MARKERS.some(marker => fullOutput.includes(marker));
      const hasError = ERROR_MARKERS.some(marker => fullOutput.includes(marker));

      if (isComplete || hasError) {
        clearTimeout(pending.timeoutId);
        this.pendingExecutions.delete(sessionId);

        const prMatch = fullOutput.match(/PR #?(\d+)|pull\/(\d+)/);
        const prNumber = prMatch ? parseInt(prMatch[1] || prMatch[2]) : undefined;

        const result: LocalExecutionResult = {
          success: isComplete && !hasError,
          jobId: session.jobId,
          sessionId,
          output: fullOutput,
          error: hasError ? 'Execution failed' : undefined,
          prNumber,
          duration: Date.now() - pending.startTime,
        };

        session.status = 'idle';
        session.jobId = undefined;
        this.emit('complete', result);
        pending.resolve(result);
      }
    }
  }

  /**
   * Try to auto-respond to detected prompts
   */
  private tryAutoRespond(session: LocalSession, screenContent: string, screenHash: string): void {
    // Skip if no auto-responder configured
    if (!session.autoResponder) return;

    // Skip if we already responded to this exact screen content
    if (session.lastPromptHash === screenHash) return;

    // Quick check: might contain prompt?
    if (!PromptDetector.mightContainPrompt(screenContent)) return;

    // Full detection
    const prompt = this.promptDetector.detect(screenContent);
    if (!prompt) return;

    // Get auto-response decision
    const result = session.autoResponder.resolve(prompt);

    if (!result.shouldRespond || !result.response) {
      if (this.config.verbose) {
        console.log(`[LocalExecutor] Auto-response skipped for session ${session.id}: ${result.reason}`);
      }
      return;
    }

    // Clear any pending auto-response timer
    if (session.pendingAutoResponse) {
      clearTimeout(session.pendingAutoResponse);
    }

    // Debounce: Wait for screen to stabilize before responding
    const delay = session.autoResponder.getResponseDelay();
    session.pendingAutoResponse = setTimeout(() => {
      // Re-check screen content hasn't changed
      const currentScreenContent = this.getScreenContent(session.terminal);
      const currentHash = crypto.createHash('md5').update(currentScreenContent).digest('hex');

      if (currentHash === screenHash) {
        // Mark this prompt as handled
        session.lastPromptHash = screenHash;

        // Send the response
        session.pty.write(result.response + '\r');

        if (this.config.verbose) {
          console.log(`[LocalExecutor] Auto-response sent for session ${session.id}: "${result.response}" (${result.reason})`);
        }

        // Emit event for audit logging
        this.emit('autoResponse', {
          sessionId: session.id,
          prompt: {
            type: prompt.type,
            toolName: prompt.toolName,
            question: prompt.question,
            optionsCount: prompt.options?.length,
          },
          response: result.response,
          reason: result.reason,
        });
      }
    }, delay);
  }

  /**
   * Handle session exit
   */
  private handleSessionExit(sessionId: string, exitCode: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const pending = this.pendingExecutions.get(sessionId);
    if (pending && session.jobId) {
      clearTimeout(pending.timeoutId);
      this.pendingExecutions.delete(sessionId);

      pending.resolve({
        success: exitCode === 0,
        jobId: session.jobId,
        sessionId,
        output: session.output.join(''),
        error: exitCode !== 0 ? `Session exited with code ${exitCode}` : undefined,
        duration: Date.now() - pending.startTime,
      });
    }

    this.sessions.delete(sessionId);
    this.emit('sessionEnded', { sessionId, exitCode });
  }

  /**
   * Find an idle session for reuse
   */
  private findIdleSession(agentId?: string): LocalSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.status === 'idle') {
        if (!agentId || session.agentId === agentId) {
          return session;
        }
      }
    }
    return undefined;
  }

  /**
   * Build prompt for Claude Code
   */
  private buildPrompt(job: Job, persona: AgentPersona): string {
    return `[SEMO Agent] ${persona.name || persona.role}

## Task
${job.description}

## Rules
1. Only modify files in your scope: ${persona.scope_patterns.join(', ')}
2. Commit with message including Job ID: [${job.id}]
3. Create PR when done (gh pr create)
4. Say "[Job completed]" when finished

Start working.`;
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'terminating';

    // Cancel pending execution
    const pending = this.pendingExecutions.get(sessionId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingExecutions.delete(sessionId);
      pending.resolve({
        success: false,
        jobId: session.jobId || '',
        sessionId,
        output: session.output.join(''),
        error: 'Session terminated',
        duration: Date.now() - pending.startTime,
      });
    }

    // Send Ctrl+C then exit
    session.pty.write('\x03');
    await new Promise(resolve => setTimeout(resolve, 500));
    session.pty.write('exit\r');

    // Force kill after timeout
    setTimeout(() => {
      if (this.sessions.has(sessionId)) {
        session.pty.kill();
        this.sessions.delete(sessionId);
      }
    }, 2000);

    if (this.config.verbose) {
      console.log(`[LocalExecutor] Terminated session: ${sessionId}`);
    }
  }

  /**
   * Send text to a session
   */
  sendText(sessionId: string, text: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.pty.write(text);
    return true;
  }

  /**
   * Send Ctrl+C to cancel current operation
   */
  cancel(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.pty.write('\x03');

    const pending = this.pendingExecutions.get(sessionId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingExecutions.delete(sessionId);
      pending.resolve({
        success: false,
        jobId: session.jobId || '',
        sessionId,
        output: session.output.join(''),
        error: 'Cancelled',
        duration: Date.now() - pending.startTime,
      });
    }

    session.status = 'idle';
    session.jobId = undefined;
    return true;
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): LocalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session output (raw PTY output chunks)
   */
  getOutput(sessionId: string, lines?: number): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return lines ? session.output.slice(-lines) : [...session.output];
  }

  /**
   * Get current rendered screen content (UPSERT style)
   */
  getScreen(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    return this.getScreenContent(session.terminal);
  }

  /**
   * Get all sessions
   */
  getSessions(): LocalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.status === 'busy') count++;
    }
    return count;
  }

  /**
   * Get statistics
   */
  getStats(): LocalExecutorStats {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      idleSessions: sessions.filter(s => s.status === 'idle').length,
      busySessions: sessions.filter(s => s.status === 'busy').length,
      pendingExecutions: this.pendingExecutions.size,
    };
  }
}

interface LocalExecutorStats {
  totalSessions: number;
  idleSessions: number;
  busySessions: number;
  pendingExecutions: number;
}
