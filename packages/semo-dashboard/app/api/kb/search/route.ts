/**
 * @file app/api/kb/search/route.ts
 * @description KB 시맨틱 검색 API. Voyage-3 임베딩 + pgvector 코사인 유사도로 검색한다.
 *
 * @api POST /api/kb/search
 * @apiBody {string} query - 검색 쿼리 텍스트 (필수)
 * @apiBody {number} [limit=10] - 최대 반환 건수
 * @apiBody {string} [bot_id] - 봇 ID 지정 시 해당 봇 KB만 검색
 * @apiSuccess {KBItem[]} 200 - 유사도 내림차순 결과
 * @apiError {object} 400 - { error: 'query is required' }
 * @apiError {object} 500 - { error: string } 임베딩 생성 실패 또는 DB 오류 시
 */

import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/kb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10, bot_id } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    const results = await search(query, limit, bot_id);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching KB:', error);
    return NextResponse.json(
      { error: 'Failed to search KB', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
