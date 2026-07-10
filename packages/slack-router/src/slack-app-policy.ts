export type DedicatedInboundSkipReason =
  | 'primary-app'
  | 'system-app'
  | 'not-visible-slack-app'
  | 'openclaw-owned';

export interface DedicatedInboundSlackAppsDecision {
  enabledBotIds: string[];
  skipped: Array<{ botId: string; reason: DedicatedInboundSkipReason }>;
}

const DEFAULT_VISIBLE_SLACK_APP_BOTS = new Set(['semi', 'colony']);
const SYSTEM_APP_BOTS = new Set(['slack', 'semobot']);

function normalizeBotId(botId: string): string {
  return botId.trim().toLowerCase();
}

function parseBotIdList(raw: string | undefined): Set<string> | undefined {
  const list = (raw || '')
    .split(',')
    .map(normalizeBotId)
    .filter(Boolean);
  return list.length ? new Set(list) : undefined;
}

/**
 * Decide which secondary Socket Mode Slack apps should be started.
 *
 * Product-facing Slack surface is Semi/Colony by default. Legacy *claw identities
 * stay available as internal workers, but their old Slack apps are not startup
 * dependencies unless explicitly named in SEMO_DEDICATED_INBOUND_BOTS.
 */
export function resolveDedicatedInboundSlackApps(input: {
  tokenBotIds: readonly string[];
  primaryBotId?: string;
  openclawBotIds: ReadonlySet<string>;
  allowedBotIdsRaw?: string;
}): DedicatedInboundSlackAppsDecision {
  const explicitAllowlist = parseBotIdList(input.allowedBotIdsRaw);
  const allowedBotIds = explicitAllowlist ?? DEFAULT_VISIBLE_SLACK_APP_BOTS;
  const primaryBotId = input.primaryBotId ? normalizeBotId(input.primaryBotId) : undefined;
  const seen = new Set<string>();
  const enabledBotIds: string[] = [];
  const skipped: DedicatedInboundSlackAppsDecision['skipped'] = [];

  for (const rawBotId of input.tokenBotIds) {
    const botId = normalizeBotId(rawBotId);
    if (!botId || seen.has(botId)) continue;
    seen.add(botId);

    if (SYSTEM_APP_BOTS.has(botId)) {
      skipped.push({ botId, reason: 'system-app' });
      continue;
    }

    if (primaryBotId && botId === primaryBotId) {
      skipped.push({ botId, reason: 'primary-app' });
      continue;
    }

    if (!allowedBotIds.has(botId)) {
      skipped.push({ botId, reason: 'not-visible-slack-app' });
      continue;
    }

    if (!explicitAllowlist && input.openclawBotIds.has(botId)) {
      skipped.push({ botId, reason: 'openclaw-owned' });
      continue;
    }

    enabledBotIds.push(botId);
  }

  return { enabledBotIds, skipped };
}

export type InboundGatewayStartResult =
  | { botId: string; status: 'fulfilled' }
  | { botId: string; status: 'rejected'; reason: unknown };

export interface InboundGatewayStartSummary {
  startedBotIds: string[];
  failed: Array<{ botId: string; message: string }>;
  shouldThrow: boolean;
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

export function summarizeInboundGatewayStart(
  results: readonly InboundGatewayStartResult[],
): InboundGatewayStartSummary {
  const startedBotIds = results
    .filter((r): r is { botId: string; status: 'fulfilled' } => r.status === 'fulfilled')
    .map((r) => r.botId);
  const failed = results
    .filter(
      (r): r is { botId: string; status: 'rejected'; reason: unknown } =>
        r.status === 'rejected',
    )
    .map((r) => ({ botId: r.botId, message: errorMessage(r.reason) }));

  return {
    startedBotIds,
    failed,
    shouldThrow: results.length > 0 && startedBotIds.length === 0,
  };
}
