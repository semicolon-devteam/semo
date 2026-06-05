import { describe, expect, it } from 'vitest';

import {
  resolveDedicatedInboundSlackApps,
  summarizeInboundGatewayStart,
} from './slack-app-policy.js';

describe('dedicated inbound Slack app policy', () => {
  it('defaults to Semi/Colony visible apps and skips legacy Claw app tokens', () => {
    const decision = resolveDedicatedInboundSlackApps({
      tokenBotIds: ['semi', 'colony', 'designclaw', 'workclaw'],
      primaryBotId: 'semi',
      openclawBotIds: new Set(),
    });

    expect(decision.enabledBotIds).toEqual(['colony']);
    expect(decision.skipped).toEqual(
      expect.arrayContaining([
        { botId: 'semi', reason: 'primary-app' },
        { botId: 'designclaw', reason: 'not-visible-slack-app' },
        { botId: 'workclaw', reason: 'not-visible-slack-app' },
      ]),
    );
  });

  it('allows legacy Claw inbound only through an explicit allowlist', () => {
    const decision = resolveDedicatedInboundSlackApps({
      tokenBotIds: ['colony', 'designclaw', 'workclaw'],
      primaryBotId: 'semi',
      openclawBotIds: new Set(['designclaw', 'workclaw']),
      allowedBotIdsRaw: 'designclaw,colony',
    });

    expect(decision.enabledBotIds).toEqual(['colony', 'designclaw']);
    expect(decision.skipped).toEqual([{ botId: 'workclaw', reason: 'not-visible-slack-app' }]);
  });
});

describe('inbound Slack gateway startup summary', () => {
  it('continues when at least one Slack app starts and reports failed apps', () => {
    const summary = summarizeInboundGatewayStart([
      { botId: 'semi', status: 'fulfilled' },
      { botId: 'designclaw', status: 'rejected', reason: new Error('account_inactive') },
    ]);

    expect(summary.shouldThrow).toBe(false);
    expect(summary.startedBotIds).toEqual(['semi']);
    expect(summary.failed).toEqual([
      { botId: 'designclaw', message: 'account_inactive' },
    ]);
  });

  it('throws only when every Slack app fails', () => {
    const summary = summarizeInboundGatewayStart([
      { botId: 'semi', status: 'rejected', reason: new Error('invalid_auth') },
      { botId: 'colony', status: 'rejected', reason: new Error('account_inactive') },
    ]);

    expect(summary.shouldThrow).toBe(true);
    expect(summary.startedBotIds).toEqual([]);
  });
});
