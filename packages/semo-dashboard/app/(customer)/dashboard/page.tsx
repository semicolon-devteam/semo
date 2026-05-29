import { ScreenHome } from '../_ui/screen-home';
import {
  requireOwnedTenantSlug,
  getInstalledAgents,
  getActivity,
  getHomeStats,
  getNudges,
} from '@/lib/customer/data';
import { resolvePersonaId } from '@/lib/customer/persona/resolve';
import { getPersonaViewModel } from '@/lib/customer/persona/viewmodel';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Customer Home (/my) — Brief §4.6 "오늘 직원들이 이런 일을 했어요".
 * 실데이터(설치된 직원/활동/집계)는 appdb 에서, persona 표현(카피/배지)은 viewmodel 에서 —
 * 분리해서 ScreenHome 에 함께 주입. persona 우선순위: ?p= → 사용자설정 → 테넌트 → shop.
 * 빈값이면 화면이 디자인 mock 으로 graceful 폴백.
 */
export default async function MyHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tenant = await requireOwnedTenantSlug();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const personaId = await resolvePersonaId(sp, { userId: user?.id, tenantSlug: tenant });
  const personaVM = getPersonaViewModel(personaId);

  const [agents, activity, stats, nudges] = await Promise.all([
    getInstalledAgents(tenant),
    getActivity(tenant),
    getHomeStats(tenant),
    getNudges(),
  ]);
  return (
    <ScreenHome
      agents={agents}
      activity={activity}
      stats={stats}
      nudges={nudges}
      personaVM={personaVM}
    />
  );
}
