import { NextResponse } from 'next/server';
import { fetchSyncStatus } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await fetchSyncStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Sync status API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
  }
}
