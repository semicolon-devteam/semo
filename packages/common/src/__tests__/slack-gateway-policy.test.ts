import { describe, expect, it } from 'vitest';

import { parseFullIngestChannels } from '../slack/slack-gateway.js';

describe('SlackGateway full ingest guard', () => {
  it('keeps full-ingest disabled unless break-glass flag is enabled', () => {
    expect(parseFullIngestChannels('C123,C456', false)).toEqual(new Set());
    expect(parseFullIngestChannels('C123,C456', true)).toEqual(new Set(['C123', 'C456']));
  });
});
