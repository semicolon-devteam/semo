/**
 * GET /api/admin/channels — 어드민/dev 매직키 뷰어 전용 cross-tenant 채널 뷰.
 * 어드민이 테넌트 스위처 디버깅 시 어떤 테넌트가 어떤 채널을 붙였는지 한눈에 확인.
 * 비-어드민 → 403.
 */
import { NextResponse } from 'next/server';
import { isTeamOrDevViewer } from '@/lib/customer/data';
import { listAllTenantChannelsForAdmin } from '@/lib/channels/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isTeamOrDevViewer())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const channels = await listAllTenantChannelsForAdmin();
  return NextResponse.json({ channels });
}
