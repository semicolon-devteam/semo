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
