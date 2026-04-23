export type { EmbeddingProvider } from './types.js';
export { OpenAIEmbeddingProvider, type OpenAIEmbeddingProviderOptions } from './openai-provider.js';
export { OllamaEmbeddingProvider, type OllamaEmbeddingProviderOptions } from './ollama-provider.js';

import { OpenAIEmbeddingProvider } from './openai-provider.js';
import type { EmbeddingProvider } from './types.js';

let defaultProvider: EmbeddingProvider | null = null;

/**
 * 프로세스 기본 EmbeddingProvider. 환경변수 OPENAI_API_KEY 사용.
 * 테스트에서 대체하려면 setDefaultEmbeddingProvider() 호출.
 */
export function getDefaultEmbeddingProvider(): EmbeddingProvider {
  if (!defaultProvider) {
    defaultProvider = new OpenAIEmbeddingProvider();
  }
  return defaultProvider;
}

export function setDefaultEmbeddingProvider(provider: EmbeddingProvider | null): void {
  defaultProvider = provider;
}
