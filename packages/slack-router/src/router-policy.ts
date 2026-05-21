export type SlackRouterPolicyDecision =
  | {
      allowed: true;
      botId: string;
      routeReason: string;
    }
  | {
      allowed: false;
      reason: 'openclaw-owned-bot' | 'semobot-system-only';
      botId: string;
      routeReason: string;
      guidance: string;
    };

export function normalizeBotId(botId: string): string {
  return botId.trim().toLowerCase();
}

export function applySlackRouterPolicy(input: {
  candidateBotId: string;
  routeReason: string;
  openclawBotIds: ReadonlySet<string>;
}): SlackRouterPolicyDecision {
  const botId = normalizeBotId(input.candidateBotId);
  const routeReason = input.routeReason;

  if (botId === 'semobot') {
    return {
      allowed: false,
      reason: 'semobot-system-only',
      botId,
      routeReason,
      guidance:
        'SemoBot is system/persona-only. Use deterministic SemoBot commands or create a durable action item for worker delegation.',
    };
  }

  if (input.openclawBotIds.has(botId)) {
    return {
      allowed: false,
      reason: 'openclaw-owned-bot',
      botId,
      routeReason,
      guidance:
        'This botId is owned by OpenClaw. Mention the OpenClaw bot directly or create a durable action item/GitHub issue instead of mailbox-routing through slack-router.',
    };
  }

  return { allowed: true, botId, routeReason };
}

export function shouldHandleSemoBotNlp(input: { allowNlpInbox: boolean }): boolean {
  return input.allowNlpInbox;
}

export function parseFullIngestChannels(raw: string | undefined, enabled: boolean): Set<string> {
  if (!enabled) return new Set();
  return new Set(
    (raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
