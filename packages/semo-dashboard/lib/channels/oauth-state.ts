/**
 * DB-backed one-time OAuth state.
 *
 * 메모리·쿠키만 사용한 state 는 멀티 프로세스 환경에서 race / replay 위험이 있다.
 * 014 마이그레이션의 public.oauth_states 테이블을 사용해
 *   1) 시작 시 HMAC-SHA256(raw) 해시만 저장(raw 는 redirect URL 에만 노출),
 *   2) 콜백에서 UPDATE … RETURNING 으로 원자적 1회 소비.
 *
 * 의도적으로 raw state 자체는 절대 저장하지 않는다 — DB dump 가 새도 replay 불가.
 */
import crypto from 'node:crypto';
import { query } from '@/lib/db';

function hashState(raw: string): string {
  const secret = process.env.SEMO_CHANNEL_STATE_SECRET;
  if (!secret) throw new Error('SEMO_CHANNEL_STATE_SECRET not configured');
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

export interface OAuthStatePayload {
  channelType: string;
  tenantSlug: string;
  userId?: string | null;
  extra?: Record<string, unknown>;
}

/**
 * 새로운 state 를 발급한다. raw 32바이트 base64url 토큰을 반환하고,
 * 그 HMAC 해시는 10분 TTL 로 DB 에 기록한다.
 */
export async function createOAuthState(p: OAuthStatePayload): Promise<string> {
  const raw = crypto.randomBytes(32).toString('base64url');
  await query(
    `insert into public.oauth_states (state_hash, tenant_id, user_id, channel_type, payload, expires_at)
     select $1, t.id, $3, $4, $5::jsonb, now() + interval '10 minutes'
       from public.tenants t where t.slug = $2`,
    [hashState(raw), p.tenantSlug, p.userId ?? null, p.channelType, JSON.stringify(p.extra ?? {})],
  );
  return raw;
}

/**
 * 콜백에서 state 를 1회 소비한다. 이미 소비됐거나 만료된 state 는 null 반환.
 * UPDATE … FROM … RETURNING 으로 race-free.
 */
export async function consumeOAuthState(raw: string): Promise<{
  tenantSlug: string;
  userId: string | null;
  channelType: string;
  extra: Record<string, unknown>;
} | null> {
  const { rows } = await query<{
    tenant_slug: string;
    user_id: string | null;
    channel_type: string;
    payload: Record<string, unknown>;
  }>(
    `with t as (
       select s.*, te.slug as tenant_slug
         from public.oauth_states s
         join public.tenants te on te.id = s.tenant_id
        where s.state_hash = $1
          and s.consumed_at is null
          and s.expires_at > now()
     )
     update public.oauth_states o
        set consumed_at = now()
       from t
      where o.state_hash = t.state_hash
    returning t.tenant_slug, t.user_id, t.channel_type, t.payload`,
    [hashState(raw)],
  );
  if (!rows[0]) return null;
  return {
    tenantSlug: rows[0].tenant_slug,
    userId: rows[0].user_id,
    channelType: rows[0].channel_type,
    extra: rows[0].payload ?? {},
  };
}
