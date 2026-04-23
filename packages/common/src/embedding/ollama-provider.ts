/**
 * OllamaEmbeddingProvider — 로컬 Ollama 기반 EmbeddingProvider
 *
 * Personal 프로파일에서 KB 한국어 검색 품질을 확보하기 위한 무료 옵션.
 * 기본 모델: nomic-embed-text (768dim) — 한국어/영어/다국어 모두 무난.
 * 대안: bge-m3 (1024dim, 더 우수한 multilingual 성능, 느림)
 *
 * 호출 규약: `POST {host}/api/embeddings { model, prompt }` → `{ embedding: number[] }`
 * Ollama 0.1.26+ 에서 지원. 미설치 시 `ollama pull nomic-embed-text` 필요.
 *
 * 차원 충돌 주의:
 *   - pgvector (`embeddings` 1024dim) 와 호환 불가 (OpenAI 전용 테이블).
 *   - SQLite `knowledge_base_vectors` 는 dim 컬럼에 실제 차원 기록하므로 혼재 가능.
 *     단, search 시 동일 provider 로 쿼리해야 의미 있는 유사도.
 */
import type { EmbeddingProvider } from './types.js';

const DEFAULT_HOST = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'nomic-embed-text';
/** nomic-embed-text 의 출력 차원. bge-m3 는 1024. 모델 변경 시 옵션으로 재지정. */
const DEFAULT_DIM = 768;
const MAX_INPUT_CHARS = 8000;

export interface OllamaEmbeddingProviderOptions {
  host?: string;
  model?: string;
  /** 출력 차원. 기본 768 (nomic-embed-text). bge-m3 는 1024. */
  dim?: number;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  public readonly id: string;
  public readonly dim: number;
  private readonly host: string;
  private readonly model: string;

  constructor(opts: OllamaEmbeddingProviderOptions = {}) {
    this.host = (opts.host ?? process.env.OLLAMA_HOST ?? DEFAULT_HOST).replace(/\/$/, '');
    this.model = opts.model ?? DEFAULT_MODEL;
    this.dim = opts.dim ?? DEFAULT_DIM;
    this.id = `ollama:${this.model}`;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.host}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text.substring(0, MAX_INPUT_CHARS),
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama embeddings error (${res.status}): ${errorText}`);
    }
    const data = (await res.json()) as { embedding?: number[]; error?: string };
    if (!data.embedding) {
      throw new Error(
        `Ollama embeddings response missing 'embedding': ${data.error ?? JSON.stringify(data)}`,
      );
    }
    return data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama 는 batch embedding 을 네이티브로 지원하지 않음. 순차 호출.
    // 체크포인트 없이 N 번 호출이므로 호출자가 청크 크기를 제어해야 함.
    const out: number[][] = [];
    for (const t of texts) {
      out.push(await this.embed(t));
    }
    return out;
  }
}
