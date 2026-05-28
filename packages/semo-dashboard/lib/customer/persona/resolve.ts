/**
 * Persona 해석 (기획 §2.1, P0.1) — server-only (pg 의존).
 * 우선순위: URL ?p= → 사용자 설정 → (온보딩) → fallback(shop).
 *
 * customer_user_settings / customer_onboarding 테이블은 아직 없다 → 조회 실패는
 * graceful 하게 건너뛰고 fallback. 테넌시·온보딩이 준비되면(SEMO Renewel 트랙)
 * 이 함수만 확장한다(화면 수정 불필요).
 */
import { query } from '@/lib/db';
import { type PersonaId, DEFAULT_PERSONA_ID, isPersonaId } from './schema';

type SP = Record<string, string | string[] | undefined> | undefined;

export async function resolvePersonaId(
  searchParams?: SP,
  opts?: { userId?: string; tenantSlug?: string },
): Promise<PersonaId> {
  // 1) URL query (세션 임시 오버라이드)
  const raw = searchParams?.p;
  const q = Array.isArray(raw) ? raw[0] : raw;
  if (isPersonaId(q)) return q;

  // 2) 사용자 저장값 (테이블 없으면 graceful skip)
  if (opts?.userId) {
    try {
      const { rows } = await query<{ persona_id: string }>(
        `select persona_id from public.customer_user_settings where user_id = $1 limit 1`,
        [opts.userId],
      );
      const v = rows[0]?.persona_id;
      if (isPersonaId(v)) return v;
    } catch {
      /* table not provisioned yet → skip */
    }
  }

  // 3) 테넌트 기본값 (테이블 없으면 graceful skip)
  if (opts?.tenantSlug) {
    try {
      const { rows } = await query<{ default_persona_id: string }>(
        `select s.default_persona_id
           from public.customer_tenant_settings s
           join public.tenants t on t.id = s.tenant_id
          where t.slug = $1 limit 1`,
        [opts.tenantSlug],
      );
      const v = rows[0]?.default_persona_id;
      if (isPersonaId(v)) return v;
    } catch {
      /* skip */
    }
  }

  // 4) fallback
  return DEFAULT_PERSONA_ID;
}
