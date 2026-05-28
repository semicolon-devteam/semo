import { ScreenTeam } from '../../_ui/screen-team';
import { DEMO_TENANT, getInstalledAgents } from '@/lib/customer/data';

export const dynamic = 'force-dynamic';

/** 공개 데모 — 직원 목록(데모 테넌트 고정). */
export default async function DemoTeamPage() {
  const agents = await getInstalledAgents(DEMO_TENANT);
  return <ScreenTeam agents={agents} demo />;
}
