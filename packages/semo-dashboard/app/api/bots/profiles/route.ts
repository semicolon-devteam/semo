import { NextResponse } from 'next/server';
import { getBotSlackProfiles } from '@/lib/bot-profiles';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profiles = await getBotSlackProfiles();
  return NextResponse.json(profiles, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
