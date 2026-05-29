import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveOwnedTenantSlug } from '@/lib/customer/data';
import PersonaSelect from '../../_ui/PersonaSelect';

export const dynamic = 'force-dynamic';

/**
 * 온보딩 게이트. /dashboard(실 제품)는 소유 테넌트가 없으면 여기로 보낸다.
 * - 비로그인 → 공개 데모 쇼케이스(/demo)로.
 * - 이미 가게(테넌트) 있음 → /dashboard 로.
 * - 가게 없는 로그인 사용자 → 모드 선택 픽커(선택 시 = 가게 생성, PersonaSelect 가 테넌트 보장).
 */
export default async function MyStartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/demo');

  const tenant = await resolveOwnedTenantSlug();
  if (tenant) redirect('/dashboard');

  return <PersonaSelect />;
}
