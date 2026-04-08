/**
 * SessionPool — 봇별 Agent SDK 세션 관리
 *
 * 각 봇에 대해 Agent SDK query()를 실행하고 응답을 수신.
 * 세션은 단일 프롬프트 모드 + resume로 운영 (안정성 우선).
 *
 * Streaming input 모드(프로세스 상시 유지)는 SDK 안정화 후 전환 예정.
 * 현재는 resume 기반 — 첫 호출 ~12초, resume 시에도 ~12초지만 컨텍스트 보존.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { BotConfig, DispatchContext, DispatchResult } from './types';
import type { BotId } from './bot-config';
import { resolveModelForMessage } from './bot-config';
import { CostTracker } from './cost-tracker';
import { buildGfpContext } from './gfp-context';

const SESSIONS_DIR = path.join(os.homedir(), '.semo-bot-sessions');

// 봇별 마지막 세션 ID 추적 (resume용)
const SESSION_STATE_FILE = path.join(os.homedir(), '.semo-bot-sessions', '.session-state.json');

interface SessionState {
  [botId: string]: { sessionId: string; lastActive: number };
}

function loadSessionState(): SessionState {
  try {
    if (fs.existsSync(SESSION_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_STATE_FILE, 'utf8'));
    }
  } catch {
    /* corrupt file */
  }
  return {};
}

function saveSessionState(state: SessionState) {
  try {
    fs.writeFileSync(SESSION_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[session-pool] Failed to save session state:', err);
  }
}

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
      // "PlanClaw" → "planclaw" normalization
      if (!target.endsWith('claw')) target = target.toLowerCase() + 'claw';
      return { targetBotId: target, reason: match[0] };
    }
  }
  return null;
}

export class SessionPool {
  private configs: Map<BotId, BotConfig>;
  private sessionState: SessionState;
  private costTracker: CostTracker;
  private activeDispatches = 0;

  constructor(configs: Map<BotId, BotConfig>, costTracker: CostTracker) {
    this.configs = configs;
    this.costTracker = costTracker;
    this.sessionState = loadSessionState();
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
      const cwd = path.join(SESSIONS_DIR, botId);
      fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
      const lastSession = this.sessionState[botId];

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

      // GFP 프로젝트 컨텍스트 (Phase별 선택적 주입)
      const gfpContext = buildGfpContext(context.route, botId);

      // 이미지 첨부 안내 (Read 도구로 파일 확인 가능)
      const imageBlock =
        images && images.length > 0
          ? [
              `[첨부 이미지 ${images.length}개 — Read 도구로 확인 가능]`,
              ...images.map((img) => `- ${img.name}: ${img.localPath}`),
            ].join('\n')
          : '';

      // 컨텍스트 프롬프트: 서비스 정보 + GFP 컨텍스트 + 스레드 히스토리
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

      const actualModel = resolveModelForMessage(botId, config.model, message);
      if (actualModel !== config.model) {
        console.log(`[session-pool] Model upgrade: ${botId} ${config.model} → ${actualModel}`);
      }
      console.log(
        `[session-pool] Dispatching to ${botId} (resume: ${lastSession?.sessionId || 'new'}, model: ${actualModel})`,
      );

      let responseText = '';
      let costUsd = 0;
      let sessionId = '';

      try {
        for await (const msg of query({
          prompt: contextPrompt,
          options: {
            cwd,
            model: actualModel,
            allowedTools: config.tools,
            maxTurns: config.maxTurns,
            maxBudgetUsd: config.maxBudgetPerMessage,
            permissionMode: 'acceptEdits',
            systemPrompt: { type: 'preset', preset: 'claude_code', append: config.soulPrompt },
            ...(lastSession?.sessionId ? { resume: lastSession.sessionId } : {}),
            env: {
              ...process.env,
              CLAUDE_CONFIG_DIR: path.join(os.homedir(), '.claude-orchestrator'),
            },
          },
        })) {
          if (msg.type === 'result') {
            if (msg.subtype === 'success') {
              responseText = msg.result || '';
            } else if (msg.subtype === 'error_max_budget_usd') {
              responseText = '(비용 한도 초과 — 응답이 잘렸을 수 있습니다)';
            } else if (msg.subtype === 'error_during_execution') {
              responseText = `(오류 발생: ${(msg as any).errors?.join(', ') || 'unknown'})`;
            }
            costUsd = (msg as any).total_cost_usd || 0;
            sessionId = (msg as any).session_id || '';
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        // resume 실패 시 새 세션으로 재시도
        if (errMsg.includes('No conversation found') && lastSession?.sessionId) {
          console.log(`[session-pool] ${botId} session not found, retrying without resume...`);
          delete this.sessionState[botId];
          saveSessionState(this.sessionState);
          try {
            for await (const msg of query({
              prompt: contextPrompt,
              options: {
                cwd,
                model: actualModel,
                allowedTools: config.tools,
                maxTurns: config.maxTurns,
                maxBudgetUsd: config.maxBudgetPerMessage,
                permissionMode: 'acceptEdits',
                systemPrompt: { type: 'preset', preset: 'claude_code', append: config.soulPrompt },
                env: {
                  ...process.env,
                  CLAUDE_CONFIG_DIR: path.join(os.homedir(), '.claude-orchestrator'),
                },
              },
            })) {
              if (msg.type === 'result') {
                if (msg.subtype === 'success') responseText = msg.result || '';
                costUsd = (msg as any).total_cost_usd || 0;
                sessionId = (msg as any).session_id || '';
              }
            }
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            console.error(`[session-pool] ${botId} retry also failed:`, retryMsg);
            responseText = `(봇 실행 오류: ${retryMsg})`;
          }
        } else {
          console.error(`[session-pool] ${botId} dispatch error:`, errMsg);
          responseText = `(봇 실행 오류: ${errMsg})`;
        }
      }

      // 세션 ID 저장 (다음 resume용)
      if (sessionId) {
        this.sessionState[botId] = { sessionId, lastActive: Date.now() };
        saveSessionState(this.sessionState);
      }

      // 비용 추적
      this.costTracker.record(botId, costUsd, context.route.serviceId, actualModel);

      // 에스컬레이션 감지
      const escalation = detectEscalation(responseText);

      return { response: responseText, botId, costUsd, escalation: escalation || undefined };
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

  shutdown() {
    saveSessionState(this.sessionState);
    console.log('[session-pool] Session state saved');
  }
}
