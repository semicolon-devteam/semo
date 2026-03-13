import { NextRequest, NextResponse } from 'next/server';
import { stats } from '@/lib/kb';

export async function GET(request: NextRequest) {
  try {
    const results = await stats();
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error getting KB stats:', error);
    return NextResponse.json(
      { error: 'Failed to get KB stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
