import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';
import PersonaSelect from '../../_ui/PersonaSelect';

export const dynamic = 'force-dynamic';

/**
 * 처음 모드(페르소나) 선택 게이트. 가입/첫 진입 시 여기로 온다.
 * - 비로그인 → 공개 쇼케이스(/my)로.
 * - 이미 선택함 → /my 로.
 * - 미선택 로그인 사용자 → 픽커 렌더.
 */
export default async function MyStartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/my');

  try {
    const { rows } = await query<{ persona_id: string }>(
      `select persona_id from public.customer_user_settings where user_id = $1 limit 1`,
      [user.id],
    );
    if (rows[0]) redirect('/my');
  } catch {
    /* 테이블 미적용 등 — 픽커 노출(저장은 API가 처리) */
  }

  return <PersonaSelect />;
}
