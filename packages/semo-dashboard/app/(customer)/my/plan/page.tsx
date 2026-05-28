import { ScreenPlan } from '../../_ui/screen-plan';
import { resolveTenantSlug, getBilling } from '@/lib/customer/data';

// 실 구독/사용량/청구이력을 매 요청 반영.
export const dynamic = 'force-dynamic';

/** 서버에서 결제 현황을 페치해 ScreenPlan 에 주입. 비면 화면이 mock 폴백. */
export default async function MyPlanPage() {
  const tenant = await resolveTenantSlug();
  const billing = await getBilling(tenant);
  return <ScreenPlan billing={billing} />;
}
