import { describe, it, expect } from 'vitest';
import {
  MockTarget,
  TargetRegistry,
  defaultRegistry,
  type ExecutionTarget,
  type TargetDispatchInput,
} from '../execution/index.js';

function sampleInput(overrides: Partial<TargetDispatchInput> = {}): TargetDispatchInput {
  return {
    botId: 'semiclaw',
    sessionKey: 'test-session',
    messages: [{ role: 'user', content: 'hello' }],
    ...overrides,
  };
}

describe('MockTarget', () => {
  it('returns echo-style reply when replyText is not set', async () => {
    const target = new MockTarget();
    const out = await target.dispatch(sampleInput());
    expect(out.replyText).toContain('hello');
    expect(out.replyText).toContain('semiclaw');
    expect(out.usage.costUsd).toBe(0);
    expect(out.targetMeta.mock).toBe(true);
  });

  it('returns fixed replyText when configured', async () => {
    const target = new MockTarget({ replyText: 'FIXED' });
    const out = await target.dispatch(sampleInput());
    expect(out.replyText).toBe('FIXED');
  });

  it('tracks dispatch calls for verification', async () => {
    const target = new MockTarget();
    await target.dispatch(sampleInput({ botId: 'a' }));
    await target.dispatch(sampleInput({ botId: 'b' }));
    expect(target.calls).toHaveLength(2);
    expect(target.calls[0].botId).toBe('a');
    expect(target.calls[1].botId).toBe('b');
  });

  it('reports estimated token usage', async () => {
    const target = new MockTarget({ replyText: 'x'.repeat(40) });
    const out = await target.dispatch(
      sampleInput({ messages: [{ role: 'user', content: 'y'.repeat(20) }] }),
    );
    expect(out.usage.inputTokens).toBeGreaterThan(0);
    expect(out.usage.outputTokens).toBeGreaterThan(0);
  });

  it('healthCheck reports ok by default', async () => {
    const target = new MockTarget();
    const h = await target.healthCheck();
    expect(h.ok).toBe(true);
  });

  it('healthCheck reports not-ok when configured unhealthy', async () => {
    const target = new MockTarget({ healthy: false });
    const h = await target.healthCheck();
    expect(h.ok).toBe(false);
    expect(h.detail).toBeDefined();
  });

  it('throws after shutdown', async () => {
    const target = new MockTarget();
    await target.shutdown();
    await expect(target.dispatch(sampleInput())).rejects.toThrow(/shutdown/i);
  });

  it('reset clears calls and shutdown flag', async () => {
    const target = new MockTarget();
    await target.dispatch(sampleInput());
    await target.shutdown();
    target.reset();
    await expect(target.dispatch(sampleInput())).resolves.toBeDefined();
    expect(target.calls).toHaveLength(1);
  });

  it('capability overrides merge with defaults', () => {
    const target = new MockTarget({ capability: { toolUse: false, supportsVision: true } });
    expect(target.capability.toolUse).toBe(false);
    expect(target.capability.supportsVision).toBe(true);
    expect(target.capability.maxContextTokens).toBe(200_000); // default preserved
    expect(target.capability.costProfile).toBe('free');
  });

  it('latency simulation delays dispatch', async () => {
    const target = new MockTarget({ latencyMs: 50 });
    const start = Date.now();
    await target.dispatch(sampleInput());
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });
});

describe('TargetRegistry', () => {
  it('resolves registered factory', () => {
    const registry = new TargetRegistry();
    registry.register('mock', () => new MockTarget({ replyText: 'FIXED' }));
    const target = registry.resolve({ kind: 'mock' });
    expect(target.kind).toBe('mock');
  });

  it('throws for unregistered kind', () => {
    const registry = new TargetRegistry();
    expect(() => registry.resolve({ kind: 'on-device' })).toThrow(/No ExecutionTarget factory/);
  });

  it('has() reflects registration state', () => {
    const registry = new TargetRegistry();
    expect(registry.has('mock')).toBe(false);
    registry.register('mock', () => new MockTarget());
    expect(registry.has('mock')).toBe(true);
  });

  it('kinds() returns all registered', () => {
    const registry = new TargetRegistry();
    registry.register('mock', () => new MockTarget());
    registry.register('on-device', () => new MockTarget());
    expect(registry.kinds().sort()).toEqual(['mock', 'on-device']);
  });

  it('factory receives full config including endpoint', async () => {
    const registry = new TargetRegistry();
    let received: unknown;
    registry.register('on-device', (config) => {
      received = config;
      return new MockTarget();
    });
    registry.resolve({ kind: 'on-device', endpoint: 'http://host:11434', model: 'qwen3:32b' });
    expect(received).toMatchObject({ kind: 'on-device', endpoint: 'http://host:11434' });
  });

  it('defaultRegistry has mock registered out of the box', () => {
    expect(defaultRegistry.has('mock')).toBe(true);
    const target = defaultRegistry.resolve({ kind: 'mock' });
    expect(target.kind).toBe('mock');
  });
});

describe('ExecutionTarget contract (via MockTarget)', () => {
  it('implements full interface', () => {
    const target: ExecutionTarget = new MockTarget();
    expect(target.kind).toBeDefined();
    expect(target.capability).toBeDefined();
    expect(typeof target.dispatch).toBe('function');
    expect(typeof target.healthCheck).toBe('function');
    expect(typeof target.shutdown).toBe('function');
  });

  it('dispatch result has required fields', async () => {
    const target: ExecutionTarget = new MockTarget();
    const out = await target.dispatch(sampleInput());
    expect(out.replyText).toBeDefined();
    expect(out.usage).toBeDefined();
    expect(out.usage.inputTokens).toBeGreaterThanOrEqual(0);
    expect(out.usage.outputTokens).toBeGreaterThanOrEqual(0);
    expect(typeof out.latencyMs).toBe('number');
    expect(out.targetMeta).toBeDefined();
  });
});
