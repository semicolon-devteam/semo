/**
 * EmbeddingProvider 추상화 — 텍스트 임베딩 생성기.
 *
 * 현 구현체는 OpenAI text-embedding-3-small (1024dim)뿐이지만,
 * 로컬 임베딩(nomic-embed-text, bge-m3 등) 또는 Voyage/Cohere 추가 시
 * 같은 인터페이스로 플러그인.
 *
 * 주의: 차원(dim)이 다르면 기존 pgvector 컬럼과 공존 불가.
 * 로컬 provider 도입 시 `kb_embeddings_local` 별도 테이블 필요.
 */
export interface EmbeddingProvider {
  /** 프로바이더 식별자 (로그·감사용). 예: "openai:text-embedding-3-small". */
  readonly id: string;
  /** 출력 벡터 차원. */
  readonly dim: number;
  /** 단일 텍스트 임베딩. */
  embed(text: string): Promise<number[]>;
  /** 배치 임베딩. 기본 구현은 embed() 순차 호출이라도 무방. */
  embedBatch(texts: string[]): Promise<number[][]>;
}
