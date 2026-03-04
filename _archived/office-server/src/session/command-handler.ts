/**
 * Command Handler for Office Server
 *
 * semo-remote의 officeSubscriber.ts 패턴을 기반으로
 * node-pty를 통해 직접 터미널 명령을 실행합니다.
 *
 * 원본: semo/docs/semo-office/semo-remote-client/officeSubscriber.ts
 */

import { LocalSessionExecutor, LocalSession } from './local-executor.js';
import type { AutoResponseConfig } from './auto-responder.js';

// Command Types (semo-remote 호환)
export type CommandType =
  | 'create_session'
  | 'send_prompt'
  | 'send_text'
  | 'get_output'
  | 'cancel'
  | 'terminate';

// Command Interface (semo-remote 호환)
export interface AgentCommand {
  id: string;
  office_id: string;
  agent_id?: string;
  job_id?: string;
  session_id?: string; // node-pty 세션 ID
  command_type: CommandType;
  payload: Record<string, unknown>;
  timeout_seconds?: number;
}

// Command Result (semo-remote 호환)
export interface CommandResult {
  success: boolean;
  output?: string;
  prNumber?: number;
  sessionId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Payload Types
export interface CreateSessionPayload {
  worktree_path: string;
  persona_name?: string;
  persona_prompt?: string;
  initial_prompt?: string;
  auto_response_config?: Partial<AutoResponseConfig>;
}

export interface SendPromptPayload {
  prompt: string;
}

export interface SendTextPayload {
  text: string;
}

export interface GetOutputPayload {
  lines?: number;
}

/**
 * Command Handler
 *
 * semo-remote의 명령 핸들링 패턴을 따르되,
 * iTerm2 API 대신 LocalSessionExecutor (node-pty)를 사용합니다.
 */
export class CommandHandler {
  private executor: LocalSessionExecutor;
  private processingCommands: Set<string> = new Set();

  constructor(executor: LocalSessionExecutor) {
    this.executor = executor;
    console.log('[CommandHandler] Initialized');
  }

  /**
   * 명령 처리 (메인 핸들러)
   */
  async handleCommand(command: AgentCommand): Promise<CommandResult> {
    // 중복 처리 방지
    if (this.processingCommands.has(command.id)) {
      return { success: false, error: 'Command already being processed' };
    }

    this.processingCommands.add(command.id);
    console.log(`[CommandHandler] Processing: ${command.command_type} (${command.id})`);

    try {
      let result: CommandResult;

      switch (command.command_type) {
        case 'create_session':
          result = await this.handleCreateSession(command);
          break;
        case 'send_prompt':
          result = await this.handleSendPrompt(command);
          break;
        case 'send_text':
          result = await this.handleSendText(command);
          break;
        case 'get_output':
          result = await this.handleGetOutput(command);
          break;
        case 'cancel':
          result = await this.handleCancel(command);
          break;
        case 'terminate':
          result = await this.handleTerminate(command);
          break;
        default:
          result = { success: false, error: `Unknown command: ${command.command_type}` };
      }

      console.log(`[CommandHandler] ${command.id} ${result.success ? 'completed' : 'failed'}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[CommandHandler] ${command.id} error:`, errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this.processingCommands.delete(command.id);
    }
  }

  /**
   * create_session: 새 터미널 세션 생성 + Claude Code 시작 + 초기 프롬프트 전송
   */
  private async handleCreateSession(command: AgentCommand): Promise<CommandResult> {
    const payload = command.payload as unknown as CreateSessionPayload;
    const { worktree_path, persona_name, initial_prompt, auto_response_config } = payload;

    if (!worktree_path) {
      return { success: false, error: 'worktree_path is required' };
    }

    console.log(`[CommandHandler] Creating session at ${worktree_path}`);

    try {
      // 세션 생성 (with optional auto-response config)
      console.log(`[CommandHandler] Creating PTY session...`);
      const session = await this.executor.createSessionOnly(
        worktree_path,
        command.agent_id,
        auto_response_config
      );

      console.log(`[CommandHandler] Session created: ${session.id}`);

      // 초기 프롬프트가 있으면 Claude Code 시작 후 전송
      if (initial_prompt) {
        console.log(`[CommandHandler] Sending initial prompt to session ${session.id}`);
        // Claude Code 초기화 대기 (약 2초)
        setTimeout(() => {
          this.executor.sendText(session.id, initial_prompt);
          // Enter 키 전송하여 프롬프트 실행
          setTimeout(() => {
            this.executor.sendText(session.id, '\r');
          }, 100);
        }, 2500);
      }

      return {
        success: true,
        sessionId: session.id,
        output: initial_prompt
          ? 'Session created! Initial prompt will be sent shortly...'
          : 'Session created! Claude Code is starting...',
        metadata: {
          worktreePath: worktree_path,
          personaName: persona_name || 'Agent',
          hasInitialPrompt: !!initial_prompt,
          autoResponseEnabled: auto_response_config?.enabled !== false,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
      console.error(`[CommandHandler] Session creation error:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * send_prompt: 기존 세션에 프롬프트 전송
   */
  private async handleSendPrompt(command: AgentCommand): Promise<CommandResult> {
    const payload = command.payload as unknown as SendPromptPayload;
    const { prompt } = payload;

    if (!command.session_id) {
      return { success: false, error: 'session_id is required' };
    }

    if (!prompt) {
      return { success: false, error: 'prompt is required' };
    }

    const session = this.executor.getSession(command.session_id);
    if (!session) {
      return { success: false, error: `Session not found: ${command.session_id}` };
    }

    console.log(`[CommandHandler] Sending prompt to session ${command.session_id}`);

    // 프롬프트 전송 (newline 이스케이프 + Enter)
    const escapedPrompt = prompt.replace(/\n/g, '\\n');
    const success = this.executor.sendText(command.session_id, `${escapedPrompt}\r`);

    return {
      success,
      output: success ? 'Prompt sent' : 'Failed to send prompt',
      sessionId: command.session_id,
    };
  }

  /**
   * send_text: 세션에 텍스트 전송
   */
  private async handleSendText(command: AgentCommand): Promise<CommandResult> {
    const payload = command.payload as unknown as SendTextPayload;
    const { text } = payload;

    if (!command.session_id) {
      return { success: false, error: 'session_id is required' };
    }

    if (!text) {
      return { success: false, error: 'text is required' };
    }

    const success = this.executor.sendText(command.session_id, text);

    return {
      success,
      sessionId: command.session_id,
    };
  }

  /**
   * get_output: 세션 출력 조회
   */
  private async handleGetOutput(command: AgentCommand): Promise<CommandResult> {
    const payload = command.payload as unknown as GetOutputPayload;
    const { lines } = payload;

    if (!command.session_id) {
      return { success: false, error: 'session_id is required' };
    }

    const session = this.executor.getSession(command.session_id);
    if (!session) {
      return { success: false, error: `Session not found: ${command.session_id}` };
    }

    const output = this.executor.getOutput(command.session_id, lines);

    return {
      success: true,
      output: output.join(''),
      sessionId: command.session_id,
      metadata: {
        lineCount: output.length,
      },
    };
  }

  /**
   * cancel: Ctrl+C 전송
   */
  private async handleCancel(command: AgentCommand): Promise<CommandResult> {
    if (!command.session_id) {
      return { success: false, error: 'session_id is required' };
    }

    const success = this.executor.cancel(command.session_id);

    return {
      success,
      output: success ? 'Cancelled' : 'Failed to cancel',
      sessionId: command.session_id,
    };
  }

  /**
   * terminate: 세션 종료
   */
  private async handleTerminate(command: AgentCommand): Promise<CommandResult> {
    if (!command.session_id) {
      return { success: false, error: 'session_id is required' };
    }

    try {
      await this.executor.terminateSession(command.session_id);
      return {
        success: true,
        output: 'Session terminated',
        sessionId: command.session_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to terminate';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 모든 세션 목록 조회
   */
  getSessions(): LocalSession[] {
    return this.executor.getSessions();
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.executor.getStats(),
      processingCommands: this.processingCommands.size,
    };
  }
}
