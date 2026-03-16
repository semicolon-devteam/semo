/**
 * @file lib/voyage.ts
 * @description OpenAI 임베딩 생성 라이브러리.
 *   text-embedding-3-small 모델을 사용하여 텍스트를 1024차원 벡터로 변환한다.
 * @dependencies OPENAI_API_KEY 환경변수
 * @usage
 *   import { genEmbedding } from '@/lib/voyage';
 *   const vector = await genEmbedding('검색할 텍스트');
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1024;

/**
 * 텍스트를 1024차원 임베딩 벡터로 변환한다.
 *
 * @param text - 임베딩할 텍스트 (8000자 초과 시 잘림)
 * @returns 1024차원 float 배열
 * @throws {Error} OPENAI_API_KEY 미설정 또는 API 호출 실패
 *
 * @example
 * const embedding = await genEmbedding('배포 프로세스 설명');
 * // pgvector: '[0.123, -0.456, ...]' 형식으로 변환 필요
 */
export async function genEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000),
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}
