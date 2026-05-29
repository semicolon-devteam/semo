import PersonaSwitcher from '../../_ui/PersonaSwitcher';
import { resolvePersonaId } from '@/lib/customer/persona/resolve';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Persona Pack 미리보기. 한 제품, 멀티 페르소나 — 같은 레이아웃에 소상공인/개인/직장인
 * 팩이 다른 콘텐츠로 렌더된다.
 *
 * 서버에서 persona 를 resolve(§2.1: URL ?p= → 사용자 저장값(customer_user_settings) →
 * fallback shop)한 뒤 클라 스위처에 초기값 주입. 로그인 사용자는 자신이 처음 선택한
 * 페르소나가 기본값이 된다. SoT = personas/*.json (registry). 예: /my/personas?p=worker
 */
export default async function MyPersonasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const initial = await resolvePersonaId(sp, user ? { userId: user.id } : undefined);
  return <PersonaSwitcher initial={initial} />;
}
