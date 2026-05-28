import { ScreenHome } from '../_ui/screen-home';
import {
  resolveTenantSlug,
  getInstalledAgents,
  getActivity,
  getHomeStats,
  getNudges,
} from '@/lib/customer/data';

/**
 * Customer Home (/my) — the main page. Brief §4.6: "오늘 직원들이 이런 일을 했어요".
 * 서버에서 실데이터(설치된 직원/활동/집계/nudges)를 페치해 ScreenHome 에 주입.
 * 빈값이면 화면이 디자인 mock 으로 graceful 폴백.
 */
export default async function MyHomePage() {
  const tenant = await resolveTenantSlug();
  const [agents, activity, stats, nudges] = await Promise.all([
    getInstalledAgents(tenant),
    getActivity(tenant),
    getHomeStats(tenant),
    getNudges(),
  ]);
  return <ScreenHome agents={agents} activity={activity} stats={stats} nudges={nudges} />;
}
