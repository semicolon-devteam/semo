export interface SlackImage {
  name: string;
  media_type: string;
  localPath: string; // 다운로드된 임시 파일 경로
}

export interface SlackMessage {
  text: string;
  user: string;
  channel: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  /**
   * If the message arrived through a dedicated per-bot Slack app Socket Mode
   * connection, route directly to that SEMO bot mailbox instead of the
   * orchestrator/default channel router.
   */
  route_bot_id?: string;
  images?: SlackImage[];
}

export interface RouteResult {
  botId: string;
  serviceId: string;
  serviceDomain: string;
  phase: number;
  track: 'plan' | 'infra';
  projectType: string;
  /**
   * 라우팅 사유. 'kb-intent:...' 형식은 Phase 3b-2 매칭 audit (score/matched/runner 포함).
   * 정확한 enum 유지 시 새 코드가 추가될 때마다 union 늘어나므로 string 으로 격하.
   */
  routeReason: string;
  /** 스킬 힌트 — 라우터가 감지한 스킬을 봇에게 전달 */
  skillHint?: string;
  /** 스프린트 워크플로우 */
  workflow?: 'sprint' | null;
  workflowPreset?: 'full' | 'quick' | 'review-only';
}

export interface ThreadMessage {
  displayName: string;
  text: string;
  isBotMessage: boolean;
}

export interface DispatchContext {
  route: RouteResult;
  sender: string;
  senderId: string;
  channel: string;
  threadTs: string;
  threadHistory?: ThreadMessage[];
}

export interface DispatchResult {
  response: string;
  botId: string;
  costUsd: number;
  escalation?: { targetBotId: string; reason: string };
  artifacts?: {
    filePaths?: string[];
    prUrl?: string;
    issueNumber?: number;
    branch?: string;
  };
}

export interface BotConfig {
  botId: string;
  model: string;
  tools: string[];
  maxTurns: number;
  maxBudgetPerMessage: number;
  soulPrompt: string;
  kbDomains: string[];
  slackProfile: { username: string; icon_emoji: string };
  mcpServers?: Record<string, import('@anthropic-ai/claude-agent-sdk').McpServerConfig>;
  mcpAllowedTools?: string[];
  agents?: Record<string, import('@anthropic-ai/claude-agent-sdk').AgentDefinition>;
  worktreeSettings?: { symlinkDirectories?: string[]; sparsePaths?: string[] };
}

export interface ProjectContext {
  domain: string;
  projectType: string;
  metadata: Record<string, unknown>;
}

export interface ContextProvider {
  buildContext(route: RouteResult, botId: string): string;
}

export interface AskOption {
  label: string;
  value: string;
}

export interface BackgroundTaskEvent {
  botId: string;
  taskId: string;
  status: 'completed' | 'failed' | 'stopped';
  summary: string;
  outputFile?: string;
  /** Agent SDK task_notification usage stats */
  usage?: {
    total_tokens: number;
    tool_uses: number;
    duration_ms: number;
  };
}
