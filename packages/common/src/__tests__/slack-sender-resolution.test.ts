import { describe, expect, it } from 'vitest';

import { resolveSlackSenderBotId } from '../slack/bot-web-client-pool.js';

describe('resolveSlackSenderBotId', () => {
  it('routes legacy Claw bot senders to the configured unified Slack bot', () => {
    expect(
      resolveSlackSenderBotId('growthclaw', {
        SEMO_UNIFIED_SLACK_SENDER_BOT_ID: 'semi',
      }),
    ).toBe('semi');
  });

  it('uses the primary Semi app for Claw bot senders when reply wrapping is enabled', () => {
    expect(
      resolveSlackSenderBotId('infraclaw', {
        SEMO_REPLY_WRAP_PERSONA: '1',
        SEMO_PRIMARY_BOT_ID: 'semi',
      }),
    ).toBe('semi');
  });

  it('keeps non-Claw bot senders unchanged', () => {
    expect(
      resolveSlackSenderBotId('colony', {
        SEMO_UNIFIED_SLACK_SENDER_BOT_ID: 'semi',
        SEMO_REPLY_WRAP_PERSONA: '1',
        SEMO_PRIMARY_BOT_ID: 'semi',
      }),
    ).toBe('colony');
  });
});
