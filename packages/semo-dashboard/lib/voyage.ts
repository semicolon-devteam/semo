/**
 * Voyage AI 임베딩 생성 라이브러리
 * Voyage-3 모델을 사용하여 텍스트를 1024차원 벡터로 변환
 */

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || '';

export async function genEmbedding(text: string): Promise<number[]> {
  if (!VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY not configured');
  }

  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voyage-3',
      input: [text],
      output_dimension: 1024,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Voyage API error: ${errorText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}
