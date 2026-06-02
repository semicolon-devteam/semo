import { describe, expect, it } from 'vitest';

import { parseFullIngestChannels, shouldProcessSlackEvent } from '../slack/slack-gateway.js';

describe('SlackGateway full ingest guard', () => {
  it('keeps full-ingest disabled unless break-glass flag is enabled', () => {
    expect(parseFullIngestChannels('C123,C456', false)).toEqual(new Set());
    expect(parseFullIngestChannels('C123,C456', true)).toEqual(new Set(['C123', 'C456']));
  });
});

describe('SlackGateway bot-authored event guard', () => {
  const botUserId = 'U_SEMI';
  const botBotId = 'B_SEMI';

  it('allows bot-authored app mentions from another bot', () => {
    expect(
      shouldProcessSlackEvent({
        event: { user: 'U_OPERATOR', bot_id: 'B_OPERATOR', text: '<@U_SEMI> ping' },
        botUserId,
        botBotId,
        allowBotMessage: true,
      }),
    ).toBe(true);
  });

  it('keeps ordinary bot messages blocked unless they are system messages', () => {
    expect(
      shouldProcessSlackEvent({
        event: { user: 'U_OPERATOR', bot_id: 'B_OPERATOR', text: 'plain bot chatter' },
        botUserId,
        botBotId,
      }),
    ).toBe(false);

    expect(
      shouldProcessSlackEvent({
        event: { user: 'U_OPERATOR', bot_id: 'B_OPERATOR', text: '[System: retry]' },
        botUserId,
        botBotId,
      }),
    ).toBe(true);
  });

  it('blocks self-authored events to prevent bot loops', () => {
    expect(
      shouldProcessSlackEvent({
        event: { user: botUserId, bot_id: botBotId, text: '<@U_SEMI> ping' },
        botUserId,
        botBotId,
        allowBotMessage: true,
      }),
    ).toBe(false);
    expect(
      shouldProcessSlackEvent({
        event: { user: 'U_SEMI_ALIAS', bot_id: botBotId, text: '<@U_SEMI> ping' },
        botUserId,
        botBotId,
        allowBotMessage: true,
      }),
    ).toBe(false);
  });
});
