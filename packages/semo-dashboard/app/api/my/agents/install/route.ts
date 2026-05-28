import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { resolveTenantSlug, DEMO_TENANT } from '@/lib/customer/data';

export const dynamic = 'force-dynamic';

/**
 * 채용(install) — 채용 마법사 완료 시 호출. 현재 테넌트에 agent_installs 한 행 추가.
 * 데모 테넌트(공개 쇼케이스)는 변형하지 않는다 → 가입 후 실제 테넌트에서만 저장.
 */
export async function POST(req: NextRequest) {
  let body: { slug?: string; instanceName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }
  const slug = body.slug?.trim();
  if (!slug) return NextResponse.json({ ok: false, error: 'slug required' }, { status: 400 });

  const tenant = await resolveTenantSlug();
  if (tenant === DEMO_TENANT) {
    // 데모/미가입 상태 — 실제 저장 안 함(데모 테넌트 보호).
    return NextResponse.json({
      ok: false,
      demo: true,
      message: '데모에서는 채용이 저장되지 않아요. 가입하면 우리 가게에 직원을 들일 수 있어요.',
    });
  }

  try {
    const { rowCount } = await query(
      `insert into public.agent_installs (tenant_id, listing_id, instance_name, install_status, last_activity_at)
       select t.id, l.id, coalesce($3, l.display_name), 'active', now()
         from public.tenants t, public.agent_listings l
        where t.slug = $1 and l.agent_slug = $2
        on conflict (tenant_id, listing_id, instance_name) do nothing`,
      [tenant, slug, body.instanceName?.trim() || null],
    );
    return NextResponse.json({
      ok: true,
      installed: (rowCount ?? 0) > 0,
      alreadyHired: rowCount === 0,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
