import type { EmbeddingProvider } from './types.js';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIM = 1024;
const MAX_INPUT_CHARS = 8000;

export interface OpenAIEmbeddingProviderOptions {
  apiKey?: string;
  model?: string;
  dim?: number;
}

/**
 * OpenAI text-embedding-3-small 기반 EmbeddingProvider.
 * 기존 `semo-dashboard/lib/voyage.ts`의 genEmbedding()과 동작 동일 (1024dim, 8000 char cap).
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  public readonly id: string;
  public readonly dim: number;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts: OpenAIEmbeddingProviderOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.model = opts.model ?? DEFAULT_MODEL;
    this.dim = opts.dim ?? DEFAULT_DIM;
    this.id = `openai:${this.model}`;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text.substring(0, MAX_INPUT_CHARS),
        dimensions: this.dim,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts.map((t) => t.substring(0, MAX_INPUT_CHARS)),
        dimensions: this.dim,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }
}
