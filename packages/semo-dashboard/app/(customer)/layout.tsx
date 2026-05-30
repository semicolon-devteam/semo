import 'server-only';
import type { ReactNode } from 'react';
import './_ui/tokens.css';
import { resolveTenantSlug, listTenants, getInstalledAgents } from '@/lib/customer/data';
import CustomerChrome from './_ui/CustomerChrome';

/**
 * Customer-facing shell (SEMO v5 design) — Codex 리뷰 반영 RSC 래퍼.
 *
 * RSC 단에서 1회 fetch:
 *   - resolveTenantSlug() → 현재 뷰어가 볼 테넌트(어드민 override / 본인 소유 / 데모 폴백).
 *   - listTenants() + getInstalledAgents() → 표시명·직원수.
 * 그 정보를 클라 `<CustomerChrome/>` 에 props 로 주입 → 사이드바 useTenantInfo() 가 소비.
 * 페이지별 callsite 가 workspace prop 을 일일이 전달하지 않아도 chrome 이 자동 정합.
 *
 * tokens.css 는 모든 것을 --semo-* / --agent-* 로 스코프. 테마 토글은 CustomerChrome 가 담당.
 * /demo, /dashboard/signup 등 비로그인 라우트도 layout 을 거치지만 resolveTenantSlug 가
 * DEMO_TENANT 폴백이므로 안전(redirect 하지 않음).
 */
export default async function CustomerLayout({ children }: { children: ReactNode }) {
  let tenantSlug = '';
  let tenantDisplayName: string | null = null;
  let agentCount = 0;
  let planSlug: string | null = null;
  try {
    tenantSlug = await resolveTenantSlug();
    const [tenants, agents] = await Promise.all([listTenants(), getInstalledAgents(tenantSlug)]);
    const t = tenants.find((x) => x.slug === tenantSlug);
    tenantDisplayName = t?.displayName ?? null;
    planSlug = t?.planSlug ?? null;
    agentCount = agents.length;
  } catch {
    // 비치명적 — chrome 폴백.
  }

  return (
    <CustomerChrome
      tenantSlug={tenantSlug}
      tenantDisplayName={tenantDisplayName}
      agentCount={agentCount}
      planSlug={planSlug}
    >
      {children}
    </CustomerChrome>
  );
}
