import { describe, it, expect } from 'vitest';
import { AsyncQueue } from '../async-queue';

describe('AsyncQueue', () => {
  it('should yield items pushed before iteration', async () => {
    const q = new AsyncQueue<number>();
    q.push(1);
    q.push(2);
    q.push(3);
    q.close();

    const items: number[] = [];
    for await (const item of q) {
      items.push(item);
    }
    expect(items).toEqual([1, 2, 3]);
  });

  it('should yield items pushed during iteration', async () => {
    const q = new AsyncQueue<string>();
    const items: string[] = [];

    const consumer = (async () => {
      for await (const item of q) {
        items.push(item);
        if (items.length === 3) break;
      }
    })();

    q.push('a');
    q.push('b');
    q.push('c');

    await consumer;
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('should resolve waiters when items arrive', async () => {
    const q = new AsyncQueue<number>();
    const items: number[] = [];

    const consumer = (async () => {
      for await (const item of q) {
        items.push(item);
        if (items.length === 2) break;
      }
    })();

    // 지연 push — waiter가 먼저 등록됨
    await new Promise((r) => setTimeout(r, 10));
    q.push(10);
    await new Promise((r) => setTimeout(r, 10));
    q.push(20);

    await consumer;
    expect(items).toEqual([10, 20]);
  });

  it('should stop iteration on close', async () => {
    const q = new AsyncQueue<number>();
    q.push(1);

    const items: number[] = [];
    const consumer = (async () => {
      for await (const item of q) {
        items.push(item);
      }
    })();

    // 첫 아이템 처리 후 close
    await new Promise((r) => setTimeout(r, 10));
    q.close();

    await consumer;
    expect(items).toEqual([1]);
  });

  it('should reject pending waiters on close', async () => {
    const q = new AsyncQueue<number>();
    const items: number[] = [];

    const consumer = (async () => {
      for await (const item of q) {
        items.push(item);
      }
    })();

    // waiter가 등록된 상태에서 close
    await new Promise((r) => setTimeout(r, 10));
    q.close();

    await consumer;
    expect(items).toEqual([]);
    expect(q.closed).toBe(true);
  });

  it('should silently ignore push after close', () => {
    const q = new AsyncQueue<number>();
    q.close();
    q.push(1); // should not throw
    expect(q.closed).toBe(true);
  });

  it('should handle interleaved push and pull', async () => {
    const q = new AsyncQueue<number>();
    const items: number[] = [];

    const consumer = (async () => {
      for await (const item of q) {
        items.push(item);
        if (items.length === 4) break;
      }
    })();

    q.push(1);
    await new Promise((r) => setTimeout(r, 5));
    q.push(2);
    q.push(3);
    await new Promise((r) => setTimeout(r, 5));
    q.push(4);

    await consumer;
    expect(items).toEqual([1, 2, 3, 4]);
  });
});
