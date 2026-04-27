/**
 * P5-2e 라이브 검증 — SlackProjectionEmitter 가 실 Slack chat.postMessage 호출 후 즉시 chat.delete.
 *
 * 실행 조건:
 *   SLACK_BOT_TOKEN  실 Bot User OAuth Token
 *   SEMO_SMOKE_CHANNEL  테스트 채널 ID (멤버여야 함, 기본 #bot-ops)
 *
 * 미설정 시 it.skip.
 */

import { describe, it, expect } from 'vitest';
import { WebClient } from '@slack/web-api';
import { SlackProjectionEmitter } from '../runtime/emitters/slack-projection-emitter.js';

const TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL = process.env.SEMO_SMOKE_CHANNEL;
const RUN = !!(TOKEN && CHANNEL);

describe.skipIf(!RUN)('P5-2e: SlackProjectionEmitter 라이브 검증', () => {
  it('실 chat.postMessage 1건 전송 후 즉시 삭제', async () => {
    const web = new WebClient(TOKEN!);
    const emitter = new SlackProjectionEmitter(web);
    const result = await emitter.emit(
      {
        channel: 'slack-block',
        destination: CHANNEL!,
        options: { unfurlLinks: false },
      },
      {
        text: `:test_tube: P5-2e SlackProjectionEmitter live smoke (${new Date().toISOString()}) — 자동 삭제됩니다.`,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.channel).toBe('slack-block');
    expect(result.channelMessageId).toBeTruthy();

    // cleanup — 즉시 삭제
    if (result.channelMessageId) {
      await web.chat.delete({ channel: CHANNEL!, ts: result.channelMessageId });
    }
  }, 15000);
});
