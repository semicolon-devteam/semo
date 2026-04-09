#!/usr/bin/env node
/**
 * SEMO Orchestrator — Agent SDK 기반 멀티에이전트 오케스트레이터
 *
 * Slack Socket Mode로 메시지 수신 → 라우팅 → 봇별 Agent SDK 세션에 디스패치 → 봇별 정체성으로 응답
 *
 * 환경변수: ~/.claude/semo/.env 자동 로드
 *   SLACK_BOT_TOKEN, SLACK_APP_TOKEN, DATABASE_URL (또는 SEMO_DB_*), OPENAI_API_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Pool } from 'pg';
import { SlackGateway } from './slack-gateway';
import { Router } from './router';
import { SessionPool } from './session-pool';
import { CostTracker } from './cost-tracker';
import { CommitmentTracker } from './commitment-tracker';
import { loadAllBotConfigsAsync, loadSlackProfilesFromAPI } from './bot-config';
import type { BotId } from './bot-config';
import type { SlackMessage, DispatchContext } from './types';

// ── Env Loading ──

function loadSemoEnv(): void {
  const envFile = path.join(os.homedir(), '.claude', 'semo', '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadSemoEnv();

// ── DB Pool ──

function buildDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : false,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    };
  }
  return {
    host: process.env.SEMO_DB_HOST,
    port: parseInt(process.env.SEMO_DB_PORT || '5432'),
    user: process.env.SEMO_DB_USER || 'app',
    password: process.env.SEMO_DB_PASSWORD,
    database: process.env.SEMO_DB_NAME || 'appdb',
    ssl: false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  };
}

// ── Main ──

const MAX_ESCALATION_DEPTH = 3;

async function main() {
  console.log('[orchestrator] Starting SEMO Orchestrator...');

  // 1. Validate env
  const { SLACK_BOT_TOKEN, SLACK_APP_TOKEN } = process.env;
  if (!SLACK_BOT_TOKEN || !SLACK_APP_TOKEN) {
    console.error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required.');
    process.exit(1);
  }

  // 2. DB 연결
  const pool = new Pool(buildDbConfig());
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[orchestrator] DB connected');
  } catch (err) {
    console.error('[orchestrator] DB connection failed:', err);
    process.exit(1);
  }

  // 3. Bot Slack profiles (KB 기반 동적 로드)
  await loadSlackProfilesFromAPI();

  // 4. Bot configs (parent 기반 KB 도메인 확장 포함)
  const botConfigs = await loadAllBotConfigsAsync(pool);
  console.log(`[orchestrator] Loaded ${botConfigs.size} bot configs`);

  // 4. Components
  const costTracker = new CostTracker(pool);
  const commitmentTracker = new CommitmentTracker(pool);
  const router = new Router(pool);
  const sessionPool = new SessionPool(botConfigs, costTracker);
  const slack = new SlackGateway(SLACK_BOT_TOKEN, SLACK_APP_TOKEN);

  // 5. 봇 세션 프리웜 (Slack 수신 전 프로세스 기동)
  sessionPool.warmUp().catch((err) => console.warn('[orchestrator] Warm-up partial failure:', err));
  await commitmentTracker.registerSessions(Array.from(botConfigs.keys()));

  // 6. Message handler
  slack.setMessageHandler(async (msg: SlackMessage, senderName: string) => {
    const threadTs = msg.thread_ts || msg.ts;
    let commitmentId = '';

    try {
      // Route
      const route = await router.route(msg.channel, msg.text);
      console.log(
        `[orchestrator] ${senderName} → ${route.botId} (${route.routeReason}, phase=${route.phase})`,
      );

      // 스레드 히스토리 조회 (스레드 답글인 경우만)
      let threadHistory: import('./types').ThreadMessage[] = [];
      if (msg.thread_ts && msg.thread_ts !== msg.ts) {
        threadHistory = await slack.getThreadHistory(msg.channel, msg.thread_ts);
      }

      // Typing status
      await slack.setTypingStatus(
        msg.channel,
        threadTs,
        `${botConfigs.get(route.botId as BotId)?.slackProfile.username || route.botId}가 처리 중...`,
      );

      // Dispatch with escalation chain + commitment tracking
      let currentBotId = route.botId as BotId;
      let currentMessage = msg.text;
      let depth = 0;
      commitmentId = await commitmentTracker.claimForDispatch({
        botId: currentBotId,
        title: msg.text.slice(0, 100),
        serviceId: route.serviceId,
        sessionOwner: 'agent-sdk',
        pipelineContext: { channel: msg.channel, phase: route.phase },
      });

      while (depth < MAX_ESCALATION_DEPTH) {
        const context: DispatchContext = {
          route: { ...route, botId: currentBotId },
          sender: senderName,
          senderId: msg.user,
          channel: msg.channel,
          threadTs,
          threadHistory,
        };

        const result = await sessionPool.dispatch(
          currentBotId,
          currentMessage,
          context,
          depth === 0 ? msg.images : undefined,
          commitmentId,
        );

        if (result.escalation && depth < MAX_ESCALATION_DEPTH - 1) {
          // 에스컬레이션: 이전 commitment done + 새 commitment claim
          console.log(
            `[orchestrator] Escalation: ${currentBotId} → ${result.escalation.targetBotId} (${result.escalation.reason})`,
          );
          commitmentId = await commitmentTracker.escalate(
            commitmentId,
            result.escalation.targetBotId,
            msg.text.slice(0, 100),
            route.serviceId,
          );
          await slack.setTypingStatus(
            msg.channel,
            threadTs,
            `${result.escalation.targetBotId}에 인계 중...`,
          );
          currentBotId = result.escalation.targetBotId as BotId;
          currentMessage = `[에스컬레이션 from ${result.botId}]\n원본 질문: ${msg.text}\n${result.botId} 응답: ${result.response}`;
          depth++;
          continue;
        }

        // 최종 응답 — commitment done
        commitmentTracker.markDone(commitmentId);

        if (result.response) {
          await slack.postAsBot(currentBotId, msg.channel, result.response, threadTs);
        } else {
          await slack.postAsBot(
            currentBotId,
            msg.channel,
            '(응답을 생성하지 못했습니다)',
            threadTs,
          );
        }

        if (result.costUsd > 0) {
          console.log(`[orchestrator] ${currentBotId} cost: $${result.costUsd.toFixed(4)}`);
        }
        break;
      }
    } catch (err) {
      console.error('[orchestrator] Handler error:', err);
      if (commitmentId) commitmentTracker.markFailed(commitmentId, String(err));
      await slack.postAsBot(
        'semiclaw',
        msg.channel,
        '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        threadTs,
      );
    }
  });

  // 7. Start Slack
  await slack.start();
  console.log('[orchestrator] Ready — listening for Slack messages');

  // 8. Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[orchestrator] ${signal} received, shutting down...`);
    try {
      await sessionPool.drainAndShutdown(10_000);
      await commitmentTracker.terminateSessions(Array.from(botConfigs.keys()));
    } catch (err) {
      console.error('[orchestrator] Drain error:', err);
    } finally {
      await slack.stop().catch((e: unknown) => console.error('Slack stop error:', e));
      await pool.end().catch((e: unknown) => console.error('DB pool end error:', e));
    }
    console.log('[orchestrator] Shutdown complete');
    process.exit(0);
  };

  const onSignal = (signal: string) =>
    shutdown(signal).catch((err) => {
      console.error(`[orchestrator] Shutdown error:`, err);
      process.exit(1);
    });
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));
}

// ── Crash notification ──

async function notifyCrash(error: Error | string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK;
  if (!webhookUrl) {
    console.warn('[orchestrator] SLACK_WEBHOOK not set — crash alert skipped');
    return;
  }
  const timestamp = new Date().toISOString();
  const errorStr =
    error instanceof Error
      ? `${error.message}\n${(error.stack || '').slice(0, 800)}`
      : String(error).slice(0, 500);
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *SEMO Orchestrator Crashed*\nTime: ${timestamp}\nError: \`\`\`${errorStr}\`\`\``,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* 알림 실패는 무시 */
  }
}

main().catch(async (err) => {
  console.error('[orchestrator] Fatal:', err);
  await notifyCrash(err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[orchestrator] Uncaught exception:', err);
  notifyCrash(err).finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 3000);
});

process.on('unhandledRejection', (reason) => {
  console.error('[orchestrator] Unhandled rejection:', reason);
  const err = reason instanceof Error ? reason : new Error(String(reason));
  notifyCrash(err).finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 3000);
});
