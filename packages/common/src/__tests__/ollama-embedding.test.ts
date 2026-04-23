/**
 * OllamaEmbeddingProvider 단위테스트.
 *
 * Personal 프로파일에서 KB 한국어 검색 품질을 확보하는 무료 임베딩 경로.
 * fetch 를 모킹해 /api/embeddings 호출 규약과 에러 경로만 검증한다.
 */
import { describe, expect, it } from 'vitest';
import { OllamaEmbeddingProvider } from '../embedding/index.js';

type FetchMock = (url: string, init?: RequestInit) => Promise<Response>;

function installFetch(handler: (url: string, init?: RequestInit) => Response): () => void {
  const original = globalThis.fetch;
  const spy: FetchMock = (input, init) => Promise.resolve(handler(String(input), init));
  (globalThis as unknown as { fetch: FetchMock }).fetch = spy;
  return () => {
    (globalThis as unknown as { fetch: typeof original }).fetch = original;
  };
}

function mockJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OllamaEmbeddingProvider', () => {
  it('id 는 "ollama:{model}" 포맷이고 dim 기본 768', () => {
    const p = new OllamaEmbeddingProvider();
    expect(p.id).toBe('ollama:nomic-embed-text');
    expect(p.dim).toBe(768);
  });

  it('커스텀 model/dim 지원 (bge-m3 = 1024)', () => {
    const p = new OllamaEmbeddingProvider({ model: 'bge-m3', dim: 1024 });
    expect(p.id).toBe('ollama:bge-m3');
    expect(p.dim).toBe(1024);
  });

  it('embed() 가 /api/embeddings 로 POST, prompt 전송, embedding 파싱', async () => {
    const restore = installFetch((url, init) => {
      expect(url).toBe('http://127.0.0.1:11434/api/embeddings');
      expect(init?.method).toBe('POST');
      const body = JSON.parse((init?.body as string) ?? '{}');
      expect(body.model).toBe('nomic-embed-text');
      expect(body.prompt).toBe('안녕하세요');
      return mockJson({ embedding: new Array(768).fill(0.01) });
    });
    const p = new OllamaEmbeddingProvider();
    const vec = await p.embed('안녕하세요');
    expect(vec).toHaveLength(768);
    expect(vec[0]).toBeCloseTo(0.01);
    restore();
  });

  it('host 오버라이드 + 후행 슬래시 제거', async () => {
    let seen = '';
    const restore = installFetch((url) => {
      seen = url;
      return mockJson({ embedding: [0, 1, 2] });
    });
    const p = new OllamaEmbeddingProvider({ host: 'http://ollama.local:8080/' });
    await p.embed('x');
    expect(seen).toBe('http://ollama.local:8080/api/embeddings');
    restore();
  });

  it('embed() 가 non-2xx 응답을 명확한 에러로 변환', async () => {
    const restore = installFetch(() => new Response('model not found', { status: 404 }));
    const p = new OllamaEmbeddingProvider({ model: 'missing-model' });
    await expect(p.embed('x')).rejects.toThrow(/Ollama embeddings error.*404.*model not found/);
    restore();
  });

  it('embed() 가 embedding 누락 응답을 에러로 변환', async () => {
    const restore = installFetch(() => mockJson({ error: 'bad request' }));
    const p = new OllamaEmbeddingProvider();
    await expect(p.embed('x')).rejects.toThrow(/missing 'embedding'/);
    restore();
  });

  it('embedBatch() 는 순차 호출로 각 결과 누적', async () => {
    let calls = 0;
    const restore = installFetch(() => {
      calls += 1;
      return mockJson({ embedding: [calls, calls, calls] });
    });
    const p = new OllamaEmbeddingProvider({ dim: 3 });
    const out = await p.embedBatch(['a', 'b', 'c']);
    expect(out).toEqual([
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
    ]);
    restore();
  });

  it('embedBatch([]) 는 빈 배열 반환 (네트워크 호출 없음)', async () => {
    let called = false;
    const restore = installFetch(() => {
      called = true;
      return mockJson({});
    });
    const p = new OllamaEmbeddingProvider();
    const out = await p.embedBatch([]);
    expect(out).toEqual([]);
    expect(called).toBe(false);
    restore();
  });

  it('OLLAMA_HOST 환경변수가 host 기본값으로 사용됨', async () => {
    const prev = process.env.OLLAMA_HOST;
    process.env.OLLAMA_HOST = 'http://env-host:9999';
    try {
      let seen = '';
      const restore = installFetch((url) => {
        seen = url;
        return mockJson({ embedding: [0.5] });
      });
      const p = new OllamaEmbeddingProvider();
      await p.embed('x');
      expect(seen).toBe('http://env-host:9999/api/embeddings');
      restore();
    } finally {
      if (prev === undefined) delete process.env.OLLAMA_HOST;
      else process.env.OLLAMA_HOST = prev;
    }
  });
});
