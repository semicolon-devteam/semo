/**
 * AsyncQueue — push/pull 기반 비동기 큐
 *
 * Streaming input 모드에서 봇별 메시지 큐로 사용.
 * AsyncIterable 프로토콜을 구현하여 query()의 prompt 인자로 직접 전달 가능.
 */

interface Waiter<T> {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
}

export class AsyncQueue<T> {
  private buffer: T[] = [];
  private waiters: Waiter<T>[] = [];
  private _closed = false;

  get closed(): boolean {
    return this._closed;
  }

  push(item: T): void {
    if (this._closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve(item);
    } else {
      this.buffer.push(item);
    }
  }

  close(): void {
    this._closed = true;
    for (const w of this.waiters) {
      w.reject(new Error('Queue closed'));
    }
    this.waiters.length = 0;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    while (true) {
      if (this._closed && this.buffer.length === 0) return;
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
      } else if (this._closed) {
        return;
      } else {
        try {
          const item = await new Promise<T>((resolve, reject) => {
            this.waiters.push({ resolve, reject });
          });
          yield item;
        } catch {
          return;
        }
      }
    }
  }
}
