import { NextResponse } from 'next/server';
import { SYNC_FLOWS } from '@/lib/sync';

export async function GET() {
  return NextResponse.json(SYNC_FLOWS);
}
