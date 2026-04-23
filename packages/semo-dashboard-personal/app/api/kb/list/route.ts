import { NextResponse } from 'next/server';
import { scanKbDomains } from '@/lib/kb-scanner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const domains = scanKbDomains();
    return NextResponse.json({ domains });
  } catch (err) {
    console.error('[api/kb/list] scan failed:', err);
    return NextResponse.json({ error: 'scan_failed' }, { status: 500 });
  }
}
