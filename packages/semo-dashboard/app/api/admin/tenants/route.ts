/**
 * GET /api/admin/tenants — 어드민/dev 매직키 뷰어 전용 테넌트 목록.
 * TenantSwitcher UI 가 호출. 비-어드민 → 403.
 */
import { NextResponse } from 'next/server';
import { listTenants, isTeamOrDevViewer } from '@/lib/customer/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isTeamOrDevViewer())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const tenants = await listTenants();
  return NextResponse.json({ tenants });
}
