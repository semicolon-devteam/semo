/**
 * SessionPool — 봇별 Agent SDK 세션 관리 (Streaming Input 모드)
 *
 * 봇별 BotSession을 유지하여 프로세스를 alive 상태로 유지.
 * 첫 메시지: ~12초 (프로세스 스폰), 후속 메시지: ~2-3초.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { BotConfig, DispatchContext, DispatchResult } from './types';
import type { BotId } from './bot-config';
import { CostTracker } from './cost-tracker';
import { buildGfpContext } from './gfp-context';

const SESSIONS_DIR = path.join(os.homedir(), '.semo-bot-sessions');
const CLAUDE_CONFIG_DIR = path.join(os.homedir(), '.claude-orchestrator');
const DISPATCH_TIMEOUT_MS = 120_000; // 2분
const MAX_RESTART_COUNT = 3;

// 에스컬레이션 패턴 감지
export const ESCALATION_PATTERNS = [
  /에스컬레이션[:\s]*(\w+claw)/i,
  /인계[:\s]*(\w+claw)/i,
  /→\s*(Semi|Plan|Design|Work|Review|Infra|Growth)Claw/i,
  /역할\s*밖.*?(\w+claw)/i,
];

export function detectEscalation(text: string): { targetBotId: string; reason: string } | null {
  for (const pattern of ESCALATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let target = match[1].toLowerCase();
      if (!target.endsWith('claw')) target = target.toLowerCase() + 'claw';
      return { targetBotId: target, reason: match[0] };
    }
  }
  return null;
}

// ── BotSession: 프로세스 alive 유지하는 스트리밍 세션 ──

interface PendingDispatch {
  prompt: string;
  resolve: (result: { responseText: string; costUsd: number; sessionId: string }) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class BotSession {
  private botId: BotId;
  private config: BotConfig;
  private alive = false;
  private queue: PendingDispatch[] = [];
  private current: PendingDispatch | null = null;
  private notifyQueue: (() => void) | null = null;
  private queryHandle: ReturnType<typeof query> | null = null;
  private restartCount = 0;

  constructor(botId: BotId, config: BotConfig) {
    this.botId = botId;
    this.config = config;
  }

  async dispatch(
    prompt: string,
  ): Promise<{ responseText: string; costUsd: number; sessionId: string }> {
    return new Promise((resolve, reject) => {
      // 타임아웃 가드
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((p) => p.timer === timer);
        if (idx >= 0) this.queue.splice(idx, 1);
        if (this.current?.timer === timer) this.current = null;
        reject(new Error('Dispatch timeout (120s)'));
      }, DISPATCH_TIMEOUT_MS);

      this.queue.push({ prompt, resolve, reject, timer });

      if (!this.alive) {
        this.startSession();
      } else {
        this.notifyQueue?.();
      }
    });
  }

  private async startSession() {
    this.alive = true;
    const cwd = path.join(SESSIONS_DIR, this.botId);
    fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });

    const isWarm = this.restartCount > 0;
    console.log(
      `[bot-session] ${this.botId} ${isWarm ? 'restarting' : 'starting'} session (restart #${this.restartCount})`,
    );

    try {
      this.queryHandle = query({
        prompt: this.createMessageGenerator(),
        options: {
          cwd,
          model: this.config.model,
          allowedTools: this.config.tools,
          maxTurns: this.config.maxTurns,
          maxBudgetUsd: this.config.maxBudgetPerMessage * 10, // 세션 전체 예산 (10턴분)
          permissionMode: 'acceptEdits',
          systemPrompt: { type: 'preset', preset: 'claude_code', append: this.config.soulPrompt },
          env: { ...process.env, CLAUDE_CONFIG_DIR },
        },
      });

      for await (const msg of this.queryHandle) {
        if (msg.type === 'result' && this.current) {
          const subtype = (msg as any).subtype;
          const responseText =
            subtype === 'success' ? (msg as any).result || '' : `(오류: ${subtype})`;
          const costUsd = (msg as any).total_cost_usd || 0;
          const sessionId = (msg as any).session_id || '';
          clearTimeout(this.current.timer);
          this.current.resolve({ responseText, costUsd, sessionId });
          this.current = null;
          this.restartCount = 0; // 성공 시 카운터 리셋
        }
      }
    } catch (err) {
      console.error(
        `[bot-session] ${this.botId} session error:`,
        err instanceof Error ? err.message : err,
      );
      if (this.current) {
        clearTimeout(this.current.timer);
        this.current.reject(err instanceof Error ? err : new Error(String(err)));
        this.current = null;
      }
    } finally {
      this.alive = false;
      this.queryHandle = null;
      // 큐에 남은 요청 → 재시작 (최대 횟수 제한)
      if (this.queue.length > 0 && this.restartCount < MAX_RESTART_COUNT) {
        this.restartCount++;
        console.log(
          `[bot-session] ${this.botId} restarting (${this.restartCount}/${MAX_RESTART_COUNT})`,
        );
        this.startSession();
      } else if (this.queue.length > 0) {
        console.error(
          `[bot-session] ${this.botId} max restarts reached, rejecting ${this.queue.length} queued`,
        );
        for (const pending of this.queue) {
          clearTimeout(pending.timer);
          pending.reject(new Error('Max session restarts reached'));
        }
        this.queue = [];
        this.restartCount = 0;
      }
    }
  }

  private async *createMessageGenerator(): AsyncGenerator<string> {
    while (this.alive) {
      // 큐에서 다음 메시지 대기 (레이스 컨디션 방지: 대기 후 재확인)
      while (this.queue.length === 0 && this.alive) {
        await new Promise<void>((resolve) => {
          this.notifyQueue = resolve;
          // 안전장치: 1초마다 큐 재확인
          setTimeout(resolve, 1000);
        });
      }
      if (!this.alive) return;
      const next = this.queue.shift();
      if (!next) continue;
      this.current = next;
      yield next.prompt;
    }
  }

  close() {
    this.alive = false;
    if (this.queryHandle && typeof (this.queryHandle as any).close === 'function') {
      (this.queryHandle as any).close();
    }
    for (const pending of this.queue) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Session closed'));
    }
    this.queue = [];
    if (this.current) {
      clearTimeout(this.current.timer);
      this.current.reject(new Error('Session closed'));
      this.current = null;
    }
  }
}

// ── SessionPool ──

export class SessionPool {
  private configs: Map<BotId, BotConfig>;
  private sessions = new Map<string, BotSession>();
  private costTracker: CostTracker;
  private activeDispatches = 0;

  constructor(configs: Map<BotId, BotConfig>, costTracker: CostTracker) {
    this.configs = configs;
    this.costTracker = costTracker;
  }

  async dispatch(
    botId: BotId,
    message: string,
    context: DispatchContext,
    images?: import('./types').SlackImage[],
  ): Promise<DispatchResult> {
    const config = this.configs.get(botId);
    if (!config) {
      return { response: `봇 ${botId} 설정을 찾을 수 없습니다.`, botId, costUsd: 0 };
    }
    this.activeDispatches++;
    try {
      const historyBlock = context.threadHistory?.length
        ? [
            '',
            `[스레드 이전 대화 (${context.threadHistory.length}건)]`,
            ...context.threadHistory.map((m) => `${m.displayName}: ${m.text}`),
            `[/스레드 이전 대화]`,
            '',
          ].join('\n')
        : '';
      const gfpContext = buildGfpContext(context.route, botId);
      const imageBlock = images?.length
        ? [
            `[첨부 이미지 ${images.length}개 — Read 도구로 확인 가능]`,
            ...images.map((img) => `- ${img.name}: ${img.localPath}`),
          ].join('\n')
        : '';

      const contextPrompt = [
        `[Slack 메시지]`,
        `채널: ${context.channel}`,
        `발신자: ${context.sender} (${context.senderId})`,
        context.route.serviceDomain
          ? `프로젝트: ${context.route.serviceDomain} (Phase ${context.route.phase})`
          : '',
        `스레드: ${context.threadTs}`,
        gfpContext,
        imageBlock,
        historyBlock,
        message,
      ]
        .filter(Boolean)
        .join('\n');

      const isNew = !this.sessions.has(botId);
      let session = this.sessions.get(botId);
      if (!session) {
        session = new BotSession(botId, config);
        this.sessions.set(botId, session);
      }

      console.log(`[session-pool] Dispatching to ${botId} (${isNew ? 'cold' : 'warm'})`);

      const result = await session.dispatch(contextPrompt);
      this.costTracker.record(botId, result.costUsd, context.route.serviceId);
      const escalation = detectEscalation(result.responseText);

      return {
        response: result.responseText,
        botId,
        costUsd: result.costUsd,
        escalation: escalation || undefined,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[session-pool] ${botId} dispatch error:`, errMsg);
      this.sessions.delete(botId);
      return { response: `(봇 실행 오류: ${errMsg})`, botId, costUsd: 0 };
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
    this.shutdown();
  }

  shutdown() {
    for (const [botId, session] of this.sessions) {
      session.close();
      console.log(`[session-pool] ${botId} session closed`);
    }
    this.sessions.clear();
    console.log('[session-pool] All sessions closed');
  }
}
