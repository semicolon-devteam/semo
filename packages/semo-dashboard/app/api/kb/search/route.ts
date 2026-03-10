import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const EMBEDDING_MODEL = "voyage-3";
const EMBEDDING_DIMENSIONS = 1024;

/**
 * Generate embedding for search query using Voyage AI
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.substring(0, 8000),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      console.error(`Embedding API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.error(`Embedding error: ${err}`);
    return null;
  }
}

interface SearchResult {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  version?: number;
  updated_at?: string;
  score?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q');
    const domain = searchParams.get('domain');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100);

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    // Generate embedding for semantic search
    const queryEmbedding = await generateEmbedding(q);

    let results: SearchResult[] = [];

    // Semantic search (if embedding available)
    if (queryEmbedding) {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      let sql = `
        SELECT domain, key, content, metadata, created_by, version, updated_at::text,
               1 - (embedding <=> $1::vector) as score
        FROM semo.knowledge_base
        WHERE embedding IS NOT NULL
      `;
      const params: (string | number)[] = [embeddingStr];
      let paramIdx = 2;

      if (domain) {
        sql += ` AND domain = $${paramIdx++}`;
        params.push(domain);
      }
      sql += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIdx++}`;
      params.push(limit);

      const result = await query<SearchResult>(sql, params);
      results = result.rows;
    }

    // Text fallback (if no semantic results)
    if (results.length === 0) {
      let textSql = `
        SELECT domain, key, content, metadata, created_by, version, updated_at::text,
               0.0 as score
        FROM semo.knowledge_base
        WHERE content ILIKE $1 OR key ILIKE $1
      `;
      const textParams: (string | number)[] = [`%${q}%`];
      let tIdx = 2;

      if (domain) {
        textSql += ` AND domain = $${tIdx++}`;
        textParams.push(domain);
      }
      textSql += ` ORDER BY updated_at DESC LIMIT $${tIdx++}`;
      textParams.push(limit);

      const textResult = await query<SearchResult>(textSql, textParams);
      results = textResult.rows;
    }

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    console.error('KB search error:', error);
    return NextResponse.json(
      { error: 'Failed to search KB' },
      { status: 500 }
    );
  }
}
