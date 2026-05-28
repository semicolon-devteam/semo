import { ScreenHome } from '../_ui/screen-home';
import {
  DEMO_TENANT,
  getInstalledAgents,
  getActivity,
  getHomeStats,
  getNudges,
} from '@/lib/customer/data';

// 공개 데모 — 시드된 데모 테넌트(정민 카페) 데이터를 매 요청 렌더.
export const dynamic = 'force-dynamic';

/** 공개 데모 홈. /my 와 동일 화면이지만 항상 데모 테넌트 고정(인증 무관). */
export default async function DemoHomePage() {
  const [agents, activity, stats, nudges] = await Promise.all([
    getInstalledAgents(DEMO_TENANT),
    getActivity(DEMO_TENANT),
    getHomeStats(DEMO_TENANT),
    getNudges(),
  ]);
  return <ScreenHome agents={agents} activity={activity} stats={stats} nudges={nudges} demo />;
}
