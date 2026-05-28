import { describe, expect, it } from 'vitest';

import {
  applySlackRouterPolicy,
  parseFullIngestChannels,
  shouldHandleSemoBotNlp,
} from './router-policy.js';

const openclaw = new Set([
  'semiclaw',
  'workclaw',
  'planclaw',
  'reviewclaw',
  'designclaw',
  'growthclaw',
  'infraclaw',
]);

describe('slack-router split-runtime policy', () => {
  it('blocks direct mailbox routing to OpenClaw botIds from route tags', () => {
    const result = applySlackRouterPolicy({
      candidateBotId: 'planclaw',
      routeReason: 'route-tag',
      openclawBotIds: openclaw,
    });

    if (result.allowed) throw new Error('expected policy to block OpenClaw botId');
    expect(result.reason).toBe('openclaw-owned-bot');
  });

  it('blocks default orchestrator fallback when it targets an OpenClaw botId', () => {
    const result = applySlackRouterPolicy({
      candidateBotId: 'semiclaw',
      routeReason: 'orchestrator',
      openclawBotIds: openclaw,
    });

    if (result.allowed) throw new Error('expected policy to block OpenClaw botId');
    expect(result.reason).toBe('openclaw-owned-bot');
  });

  it('allows router-native botIds such as incubator', () => {
    const result = applySlackRouterPolicy({
      candidateBotId: 'incubator',
      routeReason: 'incubator-session',
      openclawBotIds: openclaw,
    });

    expect(result.allowed).toBe(true);
    expect(result.botId).toBe('incubator');
  });

  it('keeps SemoBot system-only by default instead of routing natural language to inbox', () => {
    expect(shouldHandleSemoBotNlp({ allowNlpInbox: false })).toBe(false);
    expect(shouldHandleSemoBotNlp({ allowNlpInbox: true })).toBe(true);
  });

  it('ignores full-ingest channels unless explicitly enabled by a break-glass flag', () => {
    expect(parseFullIngestChannels('C123,C456', false)).toEqual(new Set());
    expect(parseFullIngestChannels('C123,C456', true)).toEqual(new Set(['C123', 'C456']));
  });
});
