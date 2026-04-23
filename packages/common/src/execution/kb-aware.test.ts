import { describe, it, expect, vi } from 'vitest';
import { KbAwareTarget, type KbSearcher, type KbEntryLite } from './kb-aware.js';
import type { ExecutionTarget, TargetDispatchInput, TargetDispatchResult } from './types.js';

function makeInnerTarget() {
  const dispatch = vi.fn(
    async (input: TargetDispatchInput): Promise<TargetDispatchResult> => ({
      replyText: `echo: ${input.messages.at(-1)?.content ?? ''}`,
      usage: { inputTokens: 10, outputTokens: 20 },
      latencyMs: 5,
      targetMeta: { receivedSystem: input.systemPrompt ?? null },
    }),
  );
  const inner: ExecutionTarget = {
    kind: 'mock',
    capability: {
      toolUse: false,
      streaming: false,
      maxContextTokens: 8192,
      supportsEmbedding: false,
      supportsVision: false,
      costProfile: 'free',
      offlineCapable: true,
    },
    dispatch,
    healthCheck: async () => ({ ok: true }),
    shutdown: async () => undefined,
  };
  return { inner, dispatch };
}

function makeSearcher(entries: KbEntryLite[]): KbSearcher {
  return {
    async search(_q, _opts) {
      return entries;
    },
  };
}

describe('KbAwareTarget', () => {
  it('KB 결과를 systemPrompt 에 첨부한다', async () => {
    const { inner, dispatch } = makeInnerTarget();
    const searcher = makeSearcher([
      {
        domain: 'reus',
        key: 'about-me',
        content: '나는 SEMO 를 만들고 있다.',
        similarityPct: 92.5,
      },
    ]);
    const target = new KbAwareTarget(inner, searcher);
    const res = await target.dispatch({
      botId: 'semiclaw',
      sessionKey: 's1',
      messages: [{ role: 'user', content: 'SEMO 가 뭐야?' }],
      systemPrompt: 'You are a helpful bot.',
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const injected = dispatch.mock.calls[0][0].systemPrompt!;
    expect(injected).toContain('You are a helpful bot.');
    expect(injected).toContain('<kb-context>');
    expect(injected).toContain('[reus] about-me');
    expect(injected).toContain('나는 SEMO');
    expect(res.targetMeta.kb_injected).toBe(1);
  });

  it('KB 결과가 없으면 systemPrompt 원본 유지', async () => {
    const { inner, dispatch } = makeInnerTarget();
    const target = new KbAwareTarget(inner, makeSearcher([]));
    await target.dispatch({
      botId: 'semiclaw',
      sessionKey: 's1',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'original',
    });
    expect(dispatch.mock.calls[0][0].systemPrompt).toBe('original');
  });

  it('KB 검색 실패해도 dispatch 는 계속 된다', async () => {
    const { inner, dispatch } = makeInnerTarget();
    const failing: KbSearcher = {
      async search() {
        throw new Error('boom');
      },
    };
    const target = new KbAwareTarget(inner, failing);
    const res = await target.dispatch({
      botId: 'semiclaw',
      sessionKey: 's1',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(dispatch).toHaveBeenCalled();
    expect(res.replyText).toBe('echo: hi');
  });

  it('user 메시지가 없으면 KB 검색을 생략', async () => {
    const { inner, dispatch } = makeInnerTarget();
    const searcher = makeSearcher([{ domain: 'x', key: 'y', content: 'should-not-appear' }]);
    const target = new KbAwareTarget(inner, searcher);
    await target.dispatch({
      botId: 'semiclaw',
      sessionKey: 's1',
      messages: [{ role: 'assistant', content: 'earlier bot reply' }],
      systemPrompt: 'sys',
    });
    expect(dispatch.mock.calls[0][0].systemPrompt).toBe('sys');
  });

  it('previewChars 로 엔트리를 자른다', async () => {
    const { inner, dispatch } = makeInnerTarget();
    const long = 'A'.repeat(1000);
    const target = new KbAwareTarget(
      inner,
      makeSearcher([{ domain: 'd', key: 'k', content: long }]),
      { previewChars: 50 },
    );
    await target.dispatch({
      botId: 'semiclaw',
      sessionKey: 's1',
      messages: [{ role: 'user', content: 'q' }],
    });
    const injected = dispatch.mock.calls[0][0].systemPrompt!;
    expect(injected).toContain('A'.repeat(50));
    expect(injected).toContain('...');
    expect(injected).not.toContain('A'.repeat(60));
  });
});
