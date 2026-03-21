import { NextRequest, NextResponse } from 'next/server';
import { getItem } from '@/lib/kb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string; key: string }> }
) {
  try {
    const { domain, key } = await params;

    const result = await getItem(domain, key);

    if (!result) {
      return NextResponse.json(
        { error: 'KB item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting KB item:', error);
    return NextResponse.json(
      { error: 'Failed to get KB item', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
