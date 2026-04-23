import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnthropicApiTarget,
  OpenAiTarget,
  GeminiTarget,
  OllamaTarget,
  MlxTarget,
  defaultRegistry,
} from '../execution/index.js';

type FetchMock = (url: string, init?: RequestInit) => Promise<Response>;

function mockJson(url: string, payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): () => void {
  const original = globalThis.fetch;
  const spy: FetchMock = (input, init) => Promise.resolve(handler(String(input), init));
  (globalThis as unknown as { fetch: FetchMock }).fetch = spy;
  return () => {
    (globalThis as unknown as { fetch: typeof original }).fetch = original;
  };
}

describe('AnthropicApiTarget', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('sends request and parses text reply + token usage', async () => {
    const restore = installFetch((url, init) => {
      expect(url).toContain('messages');
      const body = JSON.parse((init?.body as string) ?? '{}');
      expect(body.model).toBe('claude-opus-4-7');
      return mockJson(url, {
        id: 'msg_1',
        model: 'claude-opus-4-7',
        content: [{ type: 'text', text: 'hi from claude' }],
        usage: { input_tokens: 5, output_tokens: 7 },
        stop_reason: 'end_turn',
      });
    });
    const target = new AnthropicApiTarget({ kind: 'anthropic-api' });
    const out = await target.dispatch({
      botId: 'b',
      sessionKey: 's',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(out.replyText).toBe('hi from claude');
    expect(out.usage.inputTokens).toBe(5);
    expect(out.usage.outputTokens).toBe(7);
    restore();
  });

  it('throws without API key', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new AnthropicApiTarget({ kind: 'anthropic-api' })).toThrow(/API_KEY/);
  });
});

describe('OpenAiTarget', () => {
  beforeEach(() => (process.env.OPENAI_API_KEY = 'sk-test'));
  afterEach(() => delete process.env.OPENAI_API_KEY);

  it('dispatches chat/completions and parses content', async () => {
    const restore = installFetch((url, init) => {
      expect(url).toContain('chat/completions');
      const body = JSON.parse((init?.body as string) ?? '{}');
      expect(body.messages[0].role).toBe('system');
      return mockJson(url, {
        id: 'c1',
        model: 'gpt-4o',
        choices: [{ message: { role: 'assistant', content: 'open reply' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      });
    });
    const target = new OpenAiTarget({ kind: 'openai' });
    const out = await target.dispatch({
      botId: 'b',
      sessionKey: 's',
      systemPrompt: 'You are helpful.',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.replyText).toBe('open reply');
    expect(out.usage.inputTokens).toBe(3);
    restore();
  });
});

describe('GeminiTarget', () => {
  beforeEach(() => (process.env.GEMINI_API_KEY = 'key'));
  afterEach(() => delete process.env.GEMINI_API_KEY);

  it('maps assistant → model role and extracts text', async () => {
    const restore = installFetch((url, init) => {
      expect(url).toContain(':generateContent');
      const body = JSON.parse((init?.body as string) ?? '{}');
      expect(body.contents[0].role).toBe('user');
      return mockJson(url, {
        candidates: [{ content: { parts: [{ text: 'gemini says hi' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 },
        modelVersion: 'gemini-1.5-pro',
      });
    });
    const target = new GeminiTarget({ kind: 'gemini' });
    const out = await target.dispatch({
      botId: 'b',
      sessionKey: 's',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.replyText).toBe('gemini says hi');
    expect(out.usage.inputTokens).toBe(2);
    restore();
  });
});

describe('OllamaTarget', () => {
  it('healthCheck detects missing model', async () => {
    const restore = installFetch((url) => {
      if (url.endsWith('/api/tags')) {
        return mockJson(url, { models: [{ name: 'other:7b' }] });
      }
      return new Response('not found', { status: 404 });
    });
    const target = new OllamaTarget({ kind: 'ollama', model: 'qwen2.5-coder:14b' });
    const h = await target.healthCheck();
    expect(h.ok).toBe(false);
    expect(h.detail).toMatch(/pull/);
    restore();
  });

  it('dispatches chat and parses reply', async () => {
    const restore = installFetch((url, init) => {
      expect(url).toContain('/api/chat');
      const body = JSON.parse((init?.body as string) ?? '{}');
      expect(body.stream).toBe(false);
      return mockJson(url, {
        model: 'qwen2.5-coder:14b',
        message: { role: 'assistant', content: 'local reply' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 4,
      });
    });
    const target = new OllamaTarget({ kind: 'ollama' });
    const out = await target.dispatch({
      botId: 'b',
      sessionKey: 's',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.replyText).toBe('local reply');
    expect(out.usage.costUsd).toBe(0);
    expect(out.usage.inputTokens).toBe(10);
    restore();
  });
});

describe('MlxTarget', () => {
  it('uses OpenAI-compatible completions endpoint', async () => {
    const restore = installFetch((url) => {
      expect(url).toContain('/v1/chat/completions');
      return mockJson(url, {
        id: 'mlx-1',
        model: 'local',
        choices: [{ message: { role: 'assistant', content: 'mlx reply' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 6, completion_tokens: 2 },
      });
    });
    const target = new MlxTarget({ kind: 'mlx' });
    const out = await target.dispatch({
      botId: 'b',
      sessionKey: 's',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.replyText).toBe('mlx reply');
    expect(out.usage.costUsd).toBe(0);
    restore();
  });
});

describe('defaultRegistry adapter factories', () => {
  it('registers all new kinds', () => {
    expect(defaultRegistry.has('anthropic-api')).toBe(true);
    expect(defaultRegistry.has('openai')).toBe(true);
    expect(defaultRegistry.has('gemini')).toBe(true);
    expect(defaultRegistry.has('ollama')).toBe(true);
    expect(defaultRegistry.has('mlx')).toBe(true);
    expect(defaultRegistry.has('claude-code')).toBe(true);
  });

  it('ollama adapter does not require any API key', () => {
    const target = defaultRegistry.resolve({ kind: 'ollama', model: 'qwen2.5-coder:14b' });
    expect(target.kind).toBe('ollama');
    expect(target.capability.offlineCapable).toBe(true);
    expect(target.capability.costProfile).toBe('free');
  });
});
