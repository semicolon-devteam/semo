import { NextRequest, NextResponse } from 'next/server';
import { listDomains } from '@/lib/kb';

export async function GET(request: NextRequest) {
  try {
    const results = await listDomains();
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error listing KB domains:', error);
    return NextResponse.json(
      { error: 'Failed to list KB domains', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
