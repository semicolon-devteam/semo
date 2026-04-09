/**
 * Sandbox Report API — 런 리포트 조회.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSandboxReport } from '@/lib/sandbox';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');

    if (!serviceId) {
      return NextResponse.json({ error: 'service_id required' }, { status: 400 });
    }

    const report = await getSandboxReport(serviceId);
    if (!report) {
      return NextResponse.json({ error: 'Sandbox report not found' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('[SANDBOX REPORT] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
