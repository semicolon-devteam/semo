import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { resolveTenantSlug } from '@/lib/customer/data';

export const dynamic = 'force-dynamic';

/**
 * 대시보드 direct chat (채널 정책: Dashboard = 모든 (소유) 에이전트와 직접 대화).
 *
 * 흐름: 테넌트 소유(설치된) 직원만 대화 가능 → SEMO Runtime 브릿지로 전달.
 * 브릿지(SEMO_RUNTIME_URL)가 설정돼 있으면 프록시, 없으면 graceful "준비 중" 응답.
 * (대시보드는 container, agent mailbox 는 host fs → 런타임 HTTP endpoint 또는 shared
 *  volume 브릿지가 필요. 설계: docs/plans/2026-05-29-semo-integrated-product-architecture.md §1.1)
 */
export async function POST(req: NextRequest) {
  let body: { agentSlug?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }
  const agentSlug = body.agentSlug?.trim();
  const message = body.message?.trim();
  if (!agentSlug || !message) {
    return NextResponse.json(
      { ok: false, error: 'agentSlug and message required' },
      { status: 400 },
    );
  }

  const tenant = await resolveTenantSlug();

  // 채널 정책: 테넌트가 소유(설치)한 직원만 직접 대화 대상.
  let owned = false;
  try {
    const { rows } = await query<{ n: number }>(
      `select count(*)::int n
         from public.agent_installs i
         join public.agent_listings l on l.id = i.listing_id
         join public.tenants t on t.id = i.tenant_id
        where t.slug = $1 and l.agent_slug = $2 and i.install_status = 'active'`,
      [tenant, agentSlug],
    );
    owned = (rows[0]?.n ?? 0) > 0;
  } catch {
    owned = false;
  }
  if (!owned) {
    return NextResponse.json(
      {
        ok: false,
        error: 'not_hired',
        message: '아직 채용하지 않은 직원이에요. 먼저 채용해 주세요.',
      },
      { status: 403 },
    );
  }

  // SEMO Runtime 브릿지 — 설정돼 있으면 프록시, 없으면 준비 중.
  const runtimeUrl = process.env.SEMO_RUNTIME_URL;
  if (!runtimeUrl) {
    return NextResponse.json({
      ok: false,
      pending: true,
      message: '직원과의 직접 대화 연결을 준비하고 있어요. 곧 사용하실 수 있어요.',
    });
  }
  try {
    const res = await fetch(
      `${runtimeUrl.replace(/\/$/, '')}/agent/${encodeURIComponent(agentSlug)}/message`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.SEMO_RUNTIME_TOKEN
            ? { 'x-semo-runtime-token': process.env.SEMO_RUNTIME_TOKEN }
            : {}),
        },
        body: JSON.stringify({ tenant, agentSlug, message }),
      },
    );
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `runtime ${res.status}`,
          message: '응답을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.',
        },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, reply: data.reply ?? data.text ?? '', raw: data });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'runtime_unreachable', message: '직원 연결에 일시적인 문제가 있어요.' },
      { status: 502 },
    );
  }
}
