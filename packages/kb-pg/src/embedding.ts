/**
 * 임베딩 공급자의 최소 계약.
 *
 * `@team-semicolon/semo-common` 의 `EmbeddingProvider` 와 동일한 shape 이지만,
 * kb-pg 가 common 에 강결합되지 않도록 로컬에 재정의한다.
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}
