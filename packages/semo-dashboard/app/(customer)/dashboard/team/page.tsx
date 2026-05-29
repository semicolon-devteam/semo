import { ScreenTeam } from '../../_ui/screen-team';
import { requireOwnedTenantSlug, getInstalledAgents } from '@/lib/customer/data';

/** 서버에서 실데이터(채용된 직원)를 페치해 ScreenTeam 에 주입. 비면 화면이 mock 폴백. */
export default async function MyTeamPage() {
  const tenant = await requireOwnedTenantSlug();
  const agents = await getInstalledAgents(tenant);
  return <ScreenTeam agents={agents} />;
}
