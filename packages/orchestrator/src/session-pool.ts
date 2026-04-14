/**
 * SessionPool — 봇별 Agent SDK 세션 관리 (Streaming Input 모드)
 *
 * 각 봇에 대해 query()를 AsyncIterable<SDKUserMessage> 입력으로 실행.
 * 프로세스가 상시 유지되어 콜드스타트 없이 즉시 응답.
 *
 * - 오케스트레이터 시작 시 7봇 프로세스 동시 기동 (~12s, 1회)
 * - 이후 메시지별 지연 = 순수 LLM 처리 시간만
 * - setModel()로 턴별 동적 모델 전환
 * - 세션 장애 시 자동 재생성
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKUserMessage,
  SDKResultMessage,
  Query,
  SDKTaskNotificationMessage,
  SDKTaskStartedMessage,
  SDKTaskProgressMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type {
  BotConfig,
  DispatchContext,
  DispatchResult,
  ContextProvider,
  BackgroundTaskEvent,
} from './types';
import { syncBotSkillSymlinks } from './bot-config';
// resolveModelForMessage 보류 — 쿼터 절감 기간 중 전체 Sonnet 고정
import { CostTracker } from './cost-tracker';
import { ITServiceContextProvider } from './service-context';
import { CoreContextProvider } from './core-context';
import { AsyncQueue } from './async-queue';

const SESSIONS_DIR = path.join(os.homedir(), '.semo-bot-sessions');

// ── 에스컬레이션 패턴 감지 ──

export const ESCALATION_PATTERNS = [
  /에스컬레이션[:\s]*(\w+(?:claw)?)/i,
  /인계[:\s]*(\w+(?:claw)?)/i,
  /→\s*(Semi|Plan|Design|Work|Review|Infra|Growth|Incubator)(?:Claw)?\b/i,
  /역할\s*밖.*?(\w+(?:claw)?)/i,
];

/** claw 안 붙는 봇 ID (에스컬레이션 정규화 시 claw 자동 붙이지 않음) */
const NON_CLAW_BOTS = new Set(['incubator']);

export function detectEscalation(text: string): { targetBotId: string; reason: string } | null {
  for (const pattern of ESCALATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let target = match[1].toLowerCase();
      if (!target.endsWith('claw') && !NON_CLAW_BOTS.has(target)) {
        target = target + 'claw';
      }
      return { targetBotId: target, reason: match[0] };
    }
  }
  return null;
}

// ── BotSession — 봇별 persistent query ──

interface TurnResult {
  responseText: string;
  costUsd: number;
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  numTurns: number;
  durationMs: number;
}

class BotSession {
  readonly botId: string;
  private config: BotConfig;
  private inputQueue: AsyncQueue<SDKUserMessage>;
  private queryHandle: Query;
  private currentModel: string;
  private _alive = true;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  // 턴 단위 응답 대기
  private pendingTurn: {
    resolve: (result: TurnResult) => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
  } | null = null;

  // 백그라운드 태스크 추적
  private activeTasks = new Map<
    string,
    { startedAt: number; timer: ReturnType<typeof setTimeout> }
  >();
  private onTaskComplete?: (event: BackgroundTaskEvent) => void;

  setOnTaskComplete(cb: (event: BackgroundTaskEvent) => void): void {
    this.onTaskComplete = cb;
  }

  constructor(botId: string, config: BotConfig) {
    this.botId = botId;
    this.config = config;
    this.currentModel = config.model;
    this.inputQueue = new AsyncQueue();

    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    const cwd = path.join(SESSIONS_DIR, botId);
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });

    const skillCount = syncBotSkillSymlinks(botId, cwd);
    if (skillCount > 0) {
      console.log(`[bot-session] ${botId} skills symlinked: ${skillCount}`);
    }

    if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
      console.log(
        `[bot-session] ${botId} MCP servers: ${Object.keys(config.mcpServers).join(', ')}`,
      );
    }

    const startTime = Date.now();
    // 전체 Sonnet + effort low (쿼터 절감은 thinking 토큰 최소화로)
    const sessionModel = 'claude-sonnet-4-6';

    const hooksDir = path.join(os.homedir(), '.semo', 'shared', 'hooks');
    const envFile = path.join(os.homedir(), '.claude', 'semo', '.env');

    this.queryHandle = query({
      prompt: this.inputQueue,
      options: {
        cwd,
        model: sessionModel,
        allowedTools: [...config.tools, ...(config.mcpAllowedTools || [])],
        permissionMode: 'acceptEdits',
        effort: 'low',
        settingSources: ['project'],
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: `${config.soulPrompt}\n\n## Agent SDK 세션 제약 (NON-NEGOTIABLE)\n- EnterPlanMode 도구 사용 금지. 이 세션은 interactive 승인이 불가능하므로 plan mode에 진입하면 세션이 영구 block됩니다.\n- 계획이 필요하면 마크다운 텍스트로 응답하세요. plan mode 도구를 호출하지 마세요.`,
        },
        persistSession: false,
        settings: {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command' as const,
                    command: `bash ${hooksDir}/destructive-guard.sh`,
                    timeout: 5,
                  },
                ],
              },
            ],
            // 로컬 세션과 동일한 훅 구성 — 4단계 양방향 동기화
            SessionStart: [
              {
                matcher: '',
                hooks: [
                  {
                    type: 'command' as const,
                    command: `. ${envFile} 2>/dev/null; semo context sync --no-skills 2>/dev/null || true`,
                    timeout: 30,
                  },
                ],
              },
            ],
            UserPromptSubmit: [
              {
                matcher: '',
                hooks: [
                  {
                    type: 'command' as const,
                    command: `bash ${hooksDir}/context-router.sh`,
                    timeout: 10,
                  },
                ],
              },
            ],
            Stop: [
              {
                matcher: '',
                hooks: [
                  {
                    type: 'command' as const,
                    command: `. ${envFile} 2>/dev/null; semo context push 2>/dev/null || true`,
                    timeout: 30,
                  },
                  {
                    type: 'command' as const,
                    command: `bash ${hooksDir}/kb-first-guard.sh`,
                    timeout: 10,
                  },
                  {
                    type: 'command' as const,
                    command: `bash ${hooksDir}/url-validator-guard.sh`,
                    timeout: 5,
                  },
                  {
                    type: 'command' as const,
                    command: `bash ${hooksDir}/response-length-guard.sh`,
                    timeout: 5,
                  },
                  {
                    type: 'command' as const,
                    command: `bash ${hooksDir}/decision-reminder.sh`,
                    timeout: 10,
                  },
                ],
              },
            ],
            PreCompact: [
              {
                matcher: '',
                hooks: [
                  {
                    type: 'command' as const,
                    command: `. ${envFile} 2>/dev/null; semo context-preserve 2>/dev/null || true`,
                    timeout: 15,
                  },
                ],
              },
            ],
          },
          ...(config.worktreeSettings ? { worktree: config.worktreeSettings } : {}),
        },
        ...(config.mcpServers && Object.keys(config.mcpServers).length > 0
          ? { mcpServers: config.mcpServers }
          : {}),
        ...(config.agents ? { agents: config.agents } : {}),
        env: {
          ...process.env,
          // 봇 프로세스가 직접 Slack API 호출하는 것을 방지 (이중 응답 원인)
          SLACK_BOT_TOKEN: '',
          SLACK_APP_TOKEN: '',
          SLACK_WEBHOOK: '',
          CLAUDE_CONFIG_DIR: path.join(os.homedir(), '.claude-orchestrator'),
        },
      },
    });

    // 백그라운드 output 소비 루프
    this.consumeOutput(startTime).catch((err) => {
      console.error(`[bot-session] ${botId} output consumer fatal:`, err);
      this._alive = false;
      this.rejectPending(err instanceof Error ? err : new Error(String(err)));
    });
  }

  private async consumeOutput(startTime: number): Promise<void> {
    let readyResolved = false;
    // 현재 턴의 assistant 텍스트 누적
    let turnText = '';
    let turnCostUsd = 0;
    let turnSessionId = '';
    let turnInputTokens = 0;
    let turnOutputTokens = 0;
    let turnCacheReadTokens = 0;
    let turnCacheCreationTokens = 0;
    let turnNumTurns = 1;
    let turnDurationMs = 0;
    try {
      for await (const msg of this.queryHandle) {
        // 첫 메시지 수신 = 프로세스 준비 완료
        if (!readyResolved) {
          readyResolved = true;
          const warmMs = Date.now() - startTime;
          console.log(`[bot-session] ${this.botId} warm in ${warmMs}ms`);
          this.resolveReady();
        }

        // assistant 메시지에서 텍스트 추출
        if (msg.type === 'assistant' && (msg as any).message?.content) {
          const content = (msg as any).message.content;
          if (typeof content === 'string') {
            turnText = content;
          } else if (Array.isArray(content)) {
            // ContentBlock[] — text 블록만 추출
            const texts = content.filter((b: any) => b.type === 'text').map((b: any) => b.text);
            if (texts.length > 0) turnText = texts.join('\n');
          }
        }

        // result 메시지 — 확정적 턴 완료 (세션 종료 시)
        if (msg.type === 'result') {
          const resultMsg = msg as SDKResultMessage;
          if (resultMsg.subtype === 'success') {
            turnText = (resultMsg as any).result || turnText;
          } else if (resultMsg.subtype === 'error_max_budget_usd') {
            turnText = '(비용 한도 초과 — 응답이 잘렸을 수 있습니다)';
          } else {
            turnText = `(오류 발생: ${(resultMsg as any).errors?.join(', ') || 'unknown'})`;
          }
          turnCostUsd = resultMsg.total_cost_usd || 0;
          turnSessionId = resultMsg.session_id || '';
          // 토큰 데이터 추출
          const apiUsage = (resultMsg as any).usage?.apiUsage;
          turnInputTokens = apiUsage?.input_tokens ?? 0;
          turnOutputTokens = apiUsage?.output_tokens ?? 0;
          turnCacheReadTokens = apiUsage?.cache_read_input_tokens ?? 0;
          turnCacheCreationTokens = apiUsage?.cache_creation_input_tokens ?? 0;
          turnNumTurns = (resultMsg as any).num_turns ?? 1;
          turnDurationMs = (resultMsg as any).duration_ms ?? 0;
          this.resolveTurn(turnText, turnCostUsd, turnSessionId, {
            inputTokens: turnInputTokens,
            outputTokens: turnOutputTokens,
            cacheReadTokens: turnCacheReadTokens,
            cacheCreationTokens: turnCacheCreationTokens,
            numTurns: turnNumTurns,
            durationMs: turnDurationMs,
          });
          turnText = '';
          turnCostUsd = 0;
        }

        // session_state_changed → idle = 턴 완료 시그널 (streaming input 모드)
        if (
          msg.type === 'system' &&
          (msg as any).subtype === 'session_state_changed' &&
          (msg as any).state === 'idle'
        ) {
          turnSessionId = (msg as any).session_id || turnSessionId;
          this.resolveTurn(turnText, turnCostUsd, turnSessionId, {
            inputTokens: turnInputTokens,
            outputTokens: turnOutputTokens,
            cacheReadTokens: turnCacheReadTokens,
            cacheCreationTokens: turnCacheCreationTokens,
            numTurns: turnNumTurns,
            durationMs: turnDurationMs,
          });
          turnText = '';
          turnCostUsd = 0;
        }

        // Background task started
        if (msg.type === 'system' && (msg as SDKTaskStartedMessage).subtype === 'task_started') {
          const taskMsg = msg as SDKTaskStartedMessage;
          const taskId = taskMsg.task_id;
          const description = taskMsg.description;
          console.log(
            `[bot-session] ${this.botId} background task started: ${taskId} — ${description}`,
          );
          const TIMEOUT = 10 * 60_000; // 10분
          const timer = setTimeout(() => {
            console.warn(`[bot-session] ${this.botId} task ${taskId} timed out`);
            this.queryHandle.stopTask(taskId).catch(console.error);
          }, TIMEOUT);
          this.activeTasks.set(taskId, { startedAt: Date.now(), timer });
        }

        // Background task progress (logging only)
        if (msg.type === 'system' && (msg as SDKTaskProgressMessage).subtype === 'task_progress') {
          const progressMsg = msg as SDKTaskProgressMessage;
          console.log(`[bot-session] ${this.botId} task progress: ${progressMsg.task_id}`);
        }

        // Background task completed/failed
        if (
          msg.type === 'system' &&
          (msg as SDKTaskNotificationMessage).subtype === 'task_notification'
        ) {
          const notifMsg = msg as SDKTaskNotificationMessage;
          const taskId = notifMsg.task_id;
          const taskInfo = this.activeTasks.get(taskId);
          if (taskInfo?.timer) clearTimeout(taskInfo.timer);
          this.activeTasks.delete(taskId);
          if (this.onTaskComplete) {
            this.onTaskComplete({
              botId: this.botId,
              taskId,
              status: notifMsg.status,
              summary: notifMsg.summary,
              outputFile: notifMsg.output_file || undefined,
              usage: notifMsg.usage,
            });
          }
        }
      }
    } catch (err) {
      this.rejectPending(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this._alive = false;
      if (!readyResolved) this.resolveReady();
    }
  }

  private resolveTurn(
    text: string,
    costUsd: number,
    sessionId: string,
    tokens?: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
      numTurns: number;
      durationMs: number;
    },
  ): void {
    if (!this.pendingTurn) return;
    const turn: TurnResult = {
      responseText: text,
      costUsd,
      sessionId,
      inputTokens: tokens?.inputTokens ?? 0,
      outputTokens: tokens?.outputTokens ?? 0,
      cacheReadTokens: tokens?.cacheReadTokens ?? 0,
      cacheCreationTokens: tokens?.cacheCreationTokens ?? 0,
      numTurns: tokens?.numTurns ?? 1,
      durationMs: tokens?.durationMs ?? 0,
    };
    if (this.pendingTurn.timer) clearTimeout(this.pendingTurn.timer);
    this.pendingTurn.resolve(turn);
    this.pendingTurn = null;
  }

  private rejectPending(err: Error): void {
    if (this.pendingTurn) {
      if (this.pendingTurn.timer) clearTimeout(this.pendingTurn.timer);
      this.pendingTurn.reject(err);
      this.pendingTurn = null;
    }
  }

  async dispatch(
    contextPrompt: string,
    desiredModel: string,
    timeoutMs = 180_000,
  ): Promise<TurnResult> {
    if (!this._alive) {
      throw new Error(`Bot session ${this.botId} is not alive`);
    }

    // 동적 모델 전환 (streaming input 전용 API)
    if (desiredModel !== this.currentModel) {
      try {
        await this.queryHandle.setModel(desiredModel);
        this.currentModel = desiredModel;
        console.log(`[bot-session] ${this.botId} model switched → ${desiredModel}`);
      } catch (err) {
        console.warn(
          `[bot-session] ${this.botId} setModel failed, using ${this.currentModel}:`,
          err,
        );
      }
    }

    return new Promise<TurnResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingTurn) {
          this.pendingTurn = null;
          reject(new Error(`Dispatch timeout (${timeoutMs}ms) for ${this.botId}`));
        }
      }, timeoutMs);

      this.pendingTurn = { resolve, reject, timer };

      this.inputQueue.push({
        type: 'user',
        message: { role: 'user', content: contextPrompt } as MessageParam,
        parent_tool_use_id: null,
      });
    });
  }

  get alive(): boolean {
    return this._alive;
  }

  /** 프로세스가 준비될 때까지 대기 */
  waitReady(): Promise<void> {
    return this.readyPromise;
  }

  close(): void {
    for (const task of this.activeTasks.values()) {
      clearTimeout(task.timer);
    }
    this.activeTasks.clear();
    this.inputQueue.close();
    this._alive = false;
    this.rejectPending(new Error('Session closed'));
  }
}

// ── SessionPool — 봇 세션 풀 ──

export class SessionPool {
  private configs: Map<string, BotConfig>;
  private sessions: Map<string, BotSession> = new Map();
  private costTracker: CostTracker;
  private activeDispatches = 0;
  private contextProviders: Map<string, ContextProvider>;
  private coreContextProvider = new CoreContextProvider();
  private _taskCompleteCallback?: (event: BackgroundTaskEvent) => void;

  constructor(
    configs: Map<string, BotConfig>,
    costTracker: CostTracker,
    contextProviders?: Map<string, ContextProvider>,
  ) {
    this.configs = configs;
    this.costTracker = costTracker;
    this.contextProviders =
      contextProviders ?? new Map([['service', new ITServiceContextProvider()]]);

    // 모든 봇 세션 즉시 생성 — 프로세스 프리웜
    for (const [botId, config] of configs) {
      this.sessions.set(botId, new BotSession(botId, config));
    }
    console.log(`[session-pool] ${this.sessions.size} bot sessions warming up`);
  }

  /** 모든 봇 세션이 준비될 때까지 대기 (옵션) */
  async warmUp(): Promise<void> {
    const start = Date.now();
    await Promise.allSettled(Array.from(this.sessions.values()).map((s) => s.waitReady()));
    console.log(`[session-pool] All sessions warm (${Date.now() - start}ms)`);
  }

  private getOrRecreateSession(botId: string): BotSession | null {
    let session = this.sessions.get(botId);
    if (session?.alive) return session;

    // 세션 사망 → 재생성
    const config = this.configs.get(botId);
    if (!config) return null;

    console.log(`[session-pool] Recreating session for ${botId}`);
    session?.close();
    const newSession = new BotSession(botId, config);
    if (this._taskCompleteCallback) {
      newSession.setOnTaskComplete(this._taskCompleteCallback);
    }
    this.sessions.set(botId, newSession);
    return newSession;
  }

  onBackgroundTaskComplete(cb: (event: BackgroundTaskEvent) => void): void {
    this._taskCompleteCallback = cb;
    for (const session of this.sessions.values()) {
      session.setOnTaskComplete(cb);
    }
  }

  async dispatch(
    botId: string,
    message: string,
    context: DispatchContext,
    images?: import('./types').SlackImage[],
    commitmentId?: string,
  ): Promise<DispatchResult> {
    const config = this.configs.get(botId);
    if (!config) {
      return { response: `봇 ${botId} 설정을 찾을 수 없습니다.`, botId, costUsd: 0 };
    }

    const session = this.getOrRecreateSession(botId);
    if (!session) {
      return { response: `봇 ${botId} 세션을 생성할 수 없습니다.`, botId, costUsd: 0 };
    }

    this.activeDispatches++;
    try {
      // 스레드 히스토리 포매팅
      const historyBlock = context.threadHistory?.length
        ? [
            '',
            `[스레드 이전 대화 (${context.threadHistory.length}건)]`,
            ...context.threadHistory.map((m) => `${m.displayName}: ${m.text}`),
            `[/스레드 이전 대화]`,
            '',
          ].join('\n')
        : '';

      // 프로젝트 컨텍스트 (entity_type 기반 provider 선택, fallback: CoreContextProvider)
      const provider =
        this.contextProviders.get(context.route.projectType) ?? this.coreContextProvider;
      const gfpContext = provider.buildContext(context.route, botId);

      // 이미지 첨부 안내
      const imageBlock =
        images && images.length > 0
          ? [
              `[첨부 이미지 ${images.length}개 — Read 도구로 확인 가능]`,
              ...images.map((img) => `- ${img.name}: ${img.localPath}`),
            ].join('\n')
          : '';

      // 컨텍스트 프롬프트 조립
      const channelScope = context.route.serviceDomain
        ? context.route.phase >= 0
          ? `프로젝트: ${context.route.serviceDomain} (Phase ${context.route.phase})\n[채널 스코프] 이 채널은 ${context.route.serviceDomain} 프로젝트 전용입니다. "전체" 또는 다른 프로젝트를 명시하지 않는 한, ${context.route.serviceDomain} 관련 정보만 응답하세요.`
          : `도메인: ${context.route.serviceDomain}\n[채널 스코프] 이 채널은 ${context.route.serviceDomain} 관련 채널입니다. "전체" 또는 다른 도메인을 명시하지 않는 한, ${context.route.serviceDomain} 관련 정보만 응답하세요.`
        : '';

      // 스킬 디스패치 힌트
      const skillBlock = context.route.skillHint
        ? `[SKILL DISPATCH] 이 메시지는 /${context.route.skillHint} 스킬로 처리하세요. 반드시 해당 스킬을 호출하여 응답하세요.`
        : '';

      const contextPrompt = [
        `[Slack 메시지]`,
        `채널: ${context.channel}`,
        `발신자: ${context.sender} (${context.senderId})`,
        channelScope,
        skillBlock,
        `스레드: ${context.threadTs}`,
        gfpContext,
        imageBlock,
        historyBlock,
        message,
      ]
        .filter(Boolean)
        .join('\n');

      // 쿼터 절감: 전체 Sonnet + effort low
      const actualModel = 'claude-sonnet-4-6';
      console.log(`[session-pool] Dispatching to ${botId} (streaming, model: ${actualModel})`);

      // MCP 서버가 있는 봇은 도구 호출이 느릴 수 있으므로 타임아웃 확장
      const hasMcp = config.mcpServers && Object.keys(config.mcpServers).length > 0;
      const dispatchTimeout = hasMcp ? 300_000 : 180_000;
      let turnResult: TurnResult;
      try {
        turnResult = await session.dispatch(contextPrompt, actualModel, dispatchTimeout);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[session-pool] ${botId} dispatch failed, recreating: ${errMsg}`);

        const retrySession = this.getOrRecreateSession(botId);
        if (!retrySession) {
          return { response: `(봇 실행 오류: ${errMsg})`, botId, costUsd: 0 };
        }
        try {
          turnResult = await retrySession.dispatch(contextPrompt, actualModel);
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          console.error(`[session-pool] ${botId} retry failed:`, retryMsg);
          return { response: `(봇 실행 오류: ${retryMsg})`, botId, costUsd: 0 };
        }
      }

      // 비용 + 토큰 추적 (commitment 연동)
      this.costTracker.record(botId, turnResult.costUsd, {
        serviceId: context.route.serviceId,
        model: actualModel,
        commitmentId,
        inputTokens: turnResult.inputTokens,
        outputTokens: turnResult.outputTokens,
        cacheReadTokens: turnResult.cacheReadTokens,
        cacheCreationTokens: turnResult.cacheCreationTokens,
        numTurns: turnResult.numTurns,
        durationMs: turnResult.durationMs,
      });

      // 에스컬레이션 감지
      const escalation = detectEscalation(turnResult.responseText);

      return {
        response: turnResult.responseText,
        botId,
        costUsd: turnResult.costUsd,
        escalation: escalation || undefined,
      };
    } finally {
      this.activeDispatches--;
    }
  }

  async drainAndShutdown(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.activeDispatches > 0 && Date.now() < deadline) {
      console.log(`[session-pool] Draining ${this.activeDispatches} active dispatches...`);
      await new Promise((r) => setTimeout(r, 500));
    }
    if (this.activeDispatches > 0) {
      console.warn(`[session-pool] Force shutdown with ${this.activeDispatches} active dispatches`);
    }
    this.shutdown();
  }

  shutdown(): void {
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();
    console.log('[session-pool] All sessions closed');
  }
}
