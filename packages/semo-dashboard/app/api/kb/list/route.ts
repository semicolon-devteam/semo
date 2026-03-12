import { NextRequest, NextResponse } from 'next/server';
import { list } from '@/lib/kb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain') || undefined;
    const bot_id = searchParams.get('bot_id') || undefined;

    const results = await list(domain, bot_id);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error listing KB:', error);
    return NextResponse.json(
      { error: 'Failed to list KB', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
