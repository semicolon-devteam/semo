import { ScreenPlan } from '../../_ui/screen-plan';
import { DEMO_TENANT, getBilling } from '@/lib/customer/data';

export const dynamic = 'force-dynamic';

/** 공개 데모 — 요금제/결제(데모 테넌트 고정). */
export default async function DemoPlanPage() {
  const billing = await getBilling(DEMO_TENANT);
  return <ScreenPlan billing={billing} />;
}
