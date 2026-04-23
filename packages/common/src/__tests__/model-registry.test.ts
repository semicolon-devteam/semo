import { describe, expect, it, vi } from 'vitest';
import { ModelRegistry } from '../execution/model-registry.js';

describe('ModelRegistry', () => {
  it('falls back to defaults when KB store is not provided', async () => {
    const reg = new ModelRegistry({ defaults: { orchestrator: 'claude-opus-4-7' } });
    const id = await reg.get('orchestrator');
    expect(id).toBe('claude-opus-4-7');
  });

  it('falls back to adapter default when logical name is unknown', async () => {
    const reg = new ModelRegistry({});
    const id = await reg.get('reviewer', 'claude-sonnet-4-6');
    expect(id).toBe('claude-sonnet-4-6');
  });

  it('prefers KB catalog (JSON) over defaults', async () => {
    const kbStore = {
      get: vi.fn().mockResolvedValue({
        content: JSON.stringify({ orchestrator: 'kb-model-a', planner: 'kb-model-b' }),
      }),
    };
    const reg = new ModelRegistry({
      kbStore,
      defaults: { orchestrator: 'default-a', planner: 'default-b' },
    });
    expect(await reg.get('orchestrator')).toBe('kb-model-a');
    expect(await reg.get('planner')).toBe('kb-model-b');
    expect(kbStore.get).toHaveBeenCalledWith('semo', 'models', 'catalog');
  });

  it('parses simple `key: value` blocks when content is not JSON', async () => {
    const kbStore = {
      get: vi.fn().mockResolvedValue({
        content: `
- orchestrator: claude-opus-4-7
- coder: claude-sonnet-4-6
- local: qwen2.5-coder:14b
`,
      }),
    };
    const reg = new ModelRegistry({ kbStore });
    expect(await reg.get('orchestrator')).toBe('claude-opus-4-7');
    expect(await reg.get('coder')).toBe('claude-sonnet-4-6');
    expect(await reg.get('local')).toBe('qwen2.5-coder:14b');
  });

  it('caches catalog within TTL', async () => {
    const kbStore = {
      get: vi.fn().mockResolvedValue({ content: JSON.stringify({ orchestrator: 'm-1' }) }),
    };
    const reg = new ModelRegistry({ kbStore, ttlMs: 1_000 });
    await reg.get('orchestrator');
    await reg.get('orchestrator');
    expect(kbStore.get).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces KB re-fetch', async () => {
    const kbStore = {
      get: vi.fn().mockResolvedValue({ content: JSON.stringify({ coder: 'm-1' }) }),
    };
    const reg = new ModelRegistry({ kbStore });
    await reg.get('coder');
    reg.invalidate();
    await reg.get('coder');
    expect(kbStore.get).toHaveBeenCalledTimes(2);
  });

  it('returns defaults when KB throws', async () => {
    const kbStore = { get: vi.fn().mockRejectedValue(new Error('offline')) };
    const reg = new ModelRegistry({ kbStore, defaults: { orchestrator: 'fallback' } });
    expect(await reg.get('orchestrator')).toBe('fallback');
  });
});
