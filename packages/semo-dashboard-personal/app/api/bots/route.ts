import { NextResponse } from 'next/server';
import { scanBots } from '@/lib/bots-scanner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bots = scanBots();
    return NextResponse.json({ bots });
  } catch (err) {
    console.error('[api/bots] scan failed:', err);
    return NextResponse.json({ error: 'scan_failed' }, { status: 500 });
  }
}
