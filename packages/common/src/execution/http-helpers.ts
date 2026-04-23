/**
 * ExecutionTarget 어댑터 공용 HTTP 유틸.
 * SDK 의존 제거를 위해 전부 fetch 기반. Node 18+ 표준 fetch 가정.
 */

export interface HttpPostJsonOptions {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function httpPostJson<T>(opts: HttpPostJsonOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = opts.timeoutMs ?? 120_000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(opts.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
      body: JSON.stringify(opts.body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await safeReadText(res);
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function httpGet<T>(
  url: string,
  timeoutMs = 10_000,
  headers: Record<string, string> = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
