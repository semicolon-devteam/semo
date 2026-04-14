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
  images?: SlackImage[];
}

export interface RouteResult {
  botId: string;
  serviceId: string;
  serviceDomain: string;
  phase: number;
  track: 'plan' | 'infra';
  projectType: string;
  routeReason:
    | 'route-tag'
    | 'thread-sticky'
    | 'keyword'
    | 'skill-dispatch'
    | 'phase-based'
    | 'fallback';
  /** 스킬 힌트 — 라우터가 감지한 스킬을 봇에게 전달 */
  skillHint?: string;
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
