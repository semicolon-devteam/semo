import { describe, expect, it } from 'vitest';
import { NotImplementedError, type KbStore } from '../index.js';

class StubStore implements KbStore {
  async get() {
    return null;
  }
  async search() {
    return [];
  }
  async upsert(): Promise<never> {
    throw new NotImplementedError('upsert');
  }
  async delete(): Promise<never> {
    throw new NotImplementedError('delete');
  }
  async watch(): Promise<never> {
    throw new NotImplementedError('watch');
  }
  async transaction(): Promise<never> {
    throw new NotImplementedError('transaction');
  }
}

describe('KbStore contract', () => {
  it('read methods resolve without throwing on a minimal adapter', async () => {
    const s: KbStore = new StubStore();
    await expect(s.get('d', 'k')).resolves.toBeNull();
    await expect(s.search('q', { topK: 5 })).resolves.toEqual([]);
  });

  it('Phase 1b/1c methods throw NotImplementedError by default', async () => {
    const s: KbStore = new StubStore();
    await expect(s.upsert({ domain: 'd', key: 'k', content: 'v' })).rejects.toBeInstanceOf(
      NotImplementedError,
    );
    await expect(s.delete({ domain: 'd', key: 'k' })).rejects.toBeInstanceOf(NotImplementedError);
  });
});
