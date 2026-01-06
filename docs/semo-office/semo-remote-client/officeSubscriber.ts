/**
 * Office Command Subscriber for semo-remote-client
 *
 * Supabase Realtime을 통해 agent_commands 테이블을 구독하고
 * iTerm2 Python API로 Claude Code 세션을 제어합니다.
 *
 * 이 파일을 semo-remote-client/src/main/officeSubscriber.ts로 복사하세요.
 */

import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Types
interface AgentCommand {
  id: string;
  office_id: string;
  agent_id: string | null;
  job_id: string | null;
  iterm_session_id: string | null;
  command_type: string;
  payload: Record<string, unknown>;
  status: string;
  timeout_seconds: number;
  created_at: string;
}

interface CommandResult {
  success: boolean;
  output?: string;
  prNumber?: number;
  sessionId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface ItermSession {
  id: string;
  name: string;
  cwd: string;
  isActive: boolean;
  pid: number | null;
  isClaudeCode: boolean;
  processName: string | null;
}

// 외부에서 주입받는 함수들 (main/index.ts에서 import)
type SendToClaudeCodeFn = (
  sessionId: string,
  text: string,
  method?: string,
  enter?: string
) => Promise<boolean>;
type CreateNewItermTabFn = (
  projectPath?: string,
  runClaude?: boolean
) => Promise<{ success: boolean; session?: ItermSession; error?: string }>;
type SendToItermFn = (
  sessionId: string,
  text: string,
  useInject?: boolean
) => Promise<boolean>;
type GetSessionOutputFn = (
  sessionId: string,
  lines?: number
) => Promise<{ success: boolean; lines?: string[] }>;

interface OfficeDependencies {
  supabase: SupabaseClient;
  sendToClaudeCode: SendToClaudeCodeFn;
  createNewItermTab: CreateNewItermTabFn;
  sendToIterm: SendToItermFn;
  getSessionOutput: GetSessionOutputFn;
}

// State
let officeChannel: RealtimeChannel | null = null;
let activeOfficeId: string | null = null;
let deps: OfficeDependencies | null = null;

// Processing command IDs to prevent duplicates
const processingCommands = new Set<string>();

/**
 * Office Command Subscriber 초기화
 */
export function initializeOfficeSubscriber(dependencies: OfficeDependencies): void {
  deps = dependencies;
  console.log("[Office] Subscriber initialized");
}

/**
 * Office 명령 구독 시작
 */
export async function subscribeToOfficeCommands(officeId: string): Promise<void> {
  if (!deps) {
    console.error("[Office] Subscriber not initialized. Call initializeOfficeSubscriber first.");
    return;
  }

  // 기존 채널 정리
  if (officeChannel) {
    await deps.supabase.removeChannel(officeChannel);
    officeChannel = null;
  }

  activeOfficeId = officeId;

  // Realtime 구독 설정
  officeChannel = deps.supabase
    .channel(`office_commands:${officeId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "agent_commands",
        filter: `office_id=eq.${officeId}`,
      },
      async (payload) => {
        const command = payload.new as AgentCommand;
        if (command.status === "pending" && !processingCommands.has(command.id)) {
          console.log(`[Office] Realtime received command: ${command.id}`);
          processingCommands.add(command.id);
          try {
            await handleCommand(command);
          } finally {
            processingCommands.delete(command.id);
          }
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Office] Subscription status: ${status}`);
      if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
        console.log("[Office] Realtime failed, starting polling fallback...");
        startPolling(officeId);
      }
    });

  // 폴링도 시작 (백업)
  startPolling(officeId);

  console.log(`[Office] Subscribed to commands for office: ${officeId}`);
}

/**
 * 구독 중지
 */
export async function unsubscribeFromOfficeCommands(): Promise<void> {
  if (officeChannel && deps) {
    await deps.supabase.removeChannel(officeChannel);
    officeChannel = null;
  }
  activeOfficeId = null;
  stopPolling();
  console.log("[Office] Unsubscribed from office commands");
}

// Polling
let pollingInterval: NodeJS.Timeout | null = null;

function startPolling(officeId: string): void {
  if (pollingInterval) return;

  pollingInterval = setInterval(async () => {
    await pollPendingCommands(officeId);
  }, 2000);

  console.log("[Office] Started command polling (every 2s)");
}

function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

async function pollPendingCommands(officeId: string): Promise<void> {
  if (!deps) return;

  try {
    const { data: commands, error } = await deps.supabase
      .from("agent_commands")
      .select("*")
      .eq("office_id", officeId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) {
      console.error("[Office] Polling error:", error);
      return;
    }

    if (commands && commands.length > 0) {
      const newCommands = commands.filter((cmd) => !processingCommands.has(cmd.id));
      if (newCommands.length > 0) {
        console.log(`[Office] Polling found ${newCommands.length} pending commands`);
        for (const command of newCommands) {
          processingCommands.add(command.id);
          handleCommand(command as AgentCommand).finally(() => {
            processingCommands.delete(command.id);
          });
        }
      }
    }
  } catch (error) {
    console.error("[Office] Polling error:", error);
  }
}

/**
 * 명령 처리
 */
async function handleCommand(command: AgentCommand): Promise<void> {
  if (!deps) return;

  console.log(`[Office] Processing command: ${command.command_type} (${command.id})`);

  // 상태를 processing으로 업데이트
  await deps.supabase
    .from("agent_commands")
    .update({ status: "processing", processed_at: new Date().toISOString() })
    .eq("id", command.id);

  try {
    let result: CommandResult;

    switch (command.command_type) {
      case "create_session":
        result = await handleCreateSession(command);
        break;
      case "send_prompt":
        result = await handleSendPrompt(command);
        break;
      case "send_text":
        result = await handleSendText(command);
        break;
      case "get_output":
        result = await handleGetOutput(command);
        break;
      case "cancel":
        result = await handleCancel(command);
        break;
      case "terminate":
        result = await handleTerminate(command);
        break;
      default:
        result = { success: false, error: `Unknown command: ${command.command_type}` };
    }

    // 결과 저장
    await saveCommandResult(command.id, result);

    // 명령 상태 업데이트
    await deps.supabase
      .from("agent_commands")
      .update({
        status: result.success ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        error_message: result.error,
      })
      .eq("id", command.id);

    console.log(`[Office] Command ${command.id} ${result.success ? "completed" : "failed"}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Office] Command ${command.id} error:`, errorMessage);

    await deps.supabase
      .from("agent_commands")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq("id", command.id);

    await saveCommandResult(command.id, { success: false, error: errorMessage });
  }
}

/**
 * create_session 핸들러
 */
async function handleCreateSession(command: AgentCommand): Promise<CommandResult> {
  if (!deps) return { success: false, error: "Dependencies not initialized" };

  const { worktree_path, persona_name, initial_prompt } = command.payload as {
    worktree_path: string;
    persona_name: string;
    initial_prompt: string;
  };

  console.log(`[Office] Creating session for ${persona_name} at ${worktree_path}`);

  // 1. 새 iTerm 탭 생성 + Claude Code 실행
  const result = await deps.createNewItermTab(worktree_path, true);

  if (!result.success || !result.session) {
    return { success: false, error: result.error || "Failed to create iTerm tab" };
  }

  const sessionId = result.session.id;

  // 2. agent_sessions에 등록
  const { error: insertError } = await deps.supabase.from("agent_sessions").insert({
    office_id: command.office_id,
    agent_id: command.agent_id,
    iterm_session_id: sessionId,
    iterm_tab_name: `Agent: ${persona_name}`,
    is_claude_code: true,
    status: "active",
    cwd: worktree_path,
  });

  if (insertError) {
    console.error("[Office] Failed to register agent_session:", insertError);
  }

  // 3. 초기 프롬프트 전송 (Claude Code 초기화 대기 후)
  console.log(`[Office] Waiting for Claude Code initialization...`);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log(`[Office] Sending initial prompt...`);
  const sendResult = await deps.sendToClaudeCode(sessionId, initial_prompt, "applescript");

  return {
    success: sendResult,
    sessionId,
    output: sendResult ? "Session created and prompt sent" : "Session created but prompt failed",
  };
}

/**
 * send_prompt 핸들러
 */
async function handleSendPrompt(command: AgentCommand): Promise<CommandResult> {
  if (!deps) return { success: false, error: "Dependencies not initialized" };

  const { prompt, method } = command.payload as {
    prompt: string;
    method?: "applescript" | "direct";
  };

  if (!command.iterm_session_id) {
    return { success: false, error: "No iTerm session ID provided" };
  }

  console.log(`[Office] Sending prompt to session ${command.iterm_session_id}`);

  const result = await deps.sendToClaudeCode(
    command.iterm_session_id,
    prompt,
    method || "applescript"
  );

  return {
    success: result,
    output: result ? "Prompt sent" : "Failed to send prompt",
  };
}

/**
 * send_text 핸들러
 */
async function handleSendText(command: AgentCommand): Promise<CommandResult> {
  if (!deps) return { success: false, error: "Dependencies not initialized" };

  const { text } = command.payload as { text: string };

  if (!command.iterm_session_id) {
    return { success: false, error: "No iTerm session ID provided" };
  }

  const result = await deps.sendToIterm(command.iterm_session_id, text, false);

  return { success: result };
}

/**
 * get_output 핸들러
 */
async function handleGetOutput(command: AgentCommand): Promise<CommandResult> {
  if (!deps) return { success: false, error: "Dependencies not initialized" };

  const { lines } = command.payload as { lines?: number };

  if (!command.iterm_session_id) {
    return { success: false, error: "No iTerm session ID provided" };
  }

  // getSessionOutput 함수 구현 필요 (main/index.ts에서 주입)
  // 현재는 placeholder
  console.log(`[Office] get_output not fully implemented yet`);

  return {
    success: true,
    output: "Output retrieval not implemented",
  };
}

/**
 * cancel 핸들러
 */
async function handleCancel(command: AgentCommand): Promise<CommandResult> {
  if (!deps) return { success: false, error: "Dependencies not initialized" };

  if (!command.iterm_session_id) {
    return { success: false, error: "No iTerm session ID provided" };
  }

  // Ctrl+C 전송
  const result = await deps.sendToIterm(command.iterm_session_id, "\x03", false);

  return { success: result };
}

/**
 * terminate 핸들러
 */
async function handleTerminate(command: AgentCommand): Promise<CommandResult> {
  if (!deps) return { success: false, error: "Dependencies not initialized" };

  if (!command.iterm_session_id) {
    return { success: false, error: "No iTerm session ID provided" };
  }

  // 세션 상태 업데이트
  await deps.supabase
    .from("agent_sessions")
    .update({ status: "disconnected" })
    .eq("iterm_session_id", command.iterm_session_id);

  // exit 명령 전송
  const result = await deps.sendToIterm(command.iterm_session_id, "exit\n", false);

  return { success: result };
}

/**
 * 결과 저장
 */
async function saveCommandResult(commandId: string, result: CommandResult): Promise<void> {
  if (!deps) return;

  await deps.supabase.from("agent_command_results").insert({
    command_id: commandId,
    success: result.success,
    output: result.output,
    pr_number: result.prNumber,
    metadata: {
      session_id: result.sessionId,
      ...result.metadata,
    },
  });
}

/**
 * 현재 Office ID 반환
 */
export function getActiveOfficeId(): string | null {
  return activeOfficeId;
}

/**
 * Office 모드 활성화 여부
 */
export function isOfficeModeActive(): boolean {
  return activeOfficeId !== null;
}
