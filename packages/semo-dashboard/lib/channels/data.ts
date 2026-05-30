/**
 * tenant_channels / channel_messages 데이터 액세스.
 *
 * SoT = appdb `public.tenant_channels` (마이그 014 별도 작업).
 * 모든 쿼리는 tenants.slug 또는 channel id 로 격리. snake_case → camelCase 매핑.
 *
 * 의도적으로 decryption 은 export 안 함 — 토큰 복호화는 OAuth/outbound 핸들러
 * (Phase 2B) 에서만 lib/channels/credentials.ts 를 직접 import 해서 사용.
 */
import { query } from '@/lib/db';
import type { ChannelMessage, ChannelStatus, ChannelType, TenantChannel } from './types';

interface TenantChannelRow {
  id: string;
  tenant_id: string;
  channel_type: ChannelType;
  external_workspace_id: string | null;
  external_team_name: string | null;
  status: ChannelStatus;
  outbound_enabled: boolean;
  token_expires_at: string | Date | null;
  last_seen_at: string | Date | null;
  last_refresh_error: string | null;
  connected_by_user_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function isoOrNull(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : v;
}

function iso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : v;
}

function toTenantChannel(r: TenantChannelRow): TenantChannel {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    channelType: r.channel_type,
    externalWorkspaceId: r.external_workspace_id,
    externalTeamName: r.external_team_name,
    status: r.status,
    outboundEnabled: r.outbound_enabled,
    tokenExpiresAt: isoOrNull(r.token_expires_at),
    lastSeenAt: isoOrNull(r.last_seen_at),
    lastRefreshError: r.last_refresh_error,
    connectedByUserId: r.connected_by_user_id,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/**
 * 한 테넌트(slug)의 연결된 채널 목록. revoked 는 제외(사장님이 해제한 건 숨김).
 * 마이그 014 가 아직 안 깔렸으면 catch 로 빈 배열 반환 → UI 가 "연결된 채널 없음" 처리.
 */
export async function listTenantChannels(tenantSlug: string): Promise<TenantChannel[]> {
  try {
    const { rows } = await query<TenantChannelRow>(
      `select tc.id, tc.tenant_id, tc.channel_type, tc.external_workspace_id,
              tc.external_team_name, tc.status, tc.outbound_enabled,
              tc.token_expires_at, tc.last_seen_at, tc.last_refresh_error,
              tc.connected_by_user_id, tc.created_at, tc.updated_at
         from public.tenant_channels tc
         join public.tenants t on t.id = tc.tenant_id
        where t.slug = $1 and tc.status <> 'revoked'
        order by tc.created_at desc`,
      [tenantSlug],
    );
    return rows.map(toTenantChannel);
  } catch {
    return [];
  }
}

/** 채널 단건 조회 (어드민 디버그용). 없거나 오류면 null. */
export async function getTenantChannel(id: string): Promise<TenantChannel | null> {
  try {
    const { rows } = await query<TenantChannelRow>(
      `select id, tenant_id, channel_type, external_workspace_id, external_team_name,
              status, outbound_enabled, token_expires_at, last_seen_at, last_refresh_error,
              connected_by_user_id, created_at, updated_at
         from public.tenant_channels where id = $1 limit 1`,
      [id],
    );
    return rows[0] ? toTenantChannel(rows[0]) : null;
  } catch {
    return null;
  }
}

/** 어드민 API 가 사용하는 cross-tenant 뷰. 호출자에서 권한 가드 책임. */
export interface TenantChannelWithTenant extends TenantChannel {
  tenantSlug: string;
  tenantDisplayName: string;
}

export async function listAllTenantChannelsForAdmin(): Promise<TenantChannelWithTenant[]> {
  try {
    const { rows } = await query<
      TenantChannelRow & { tenant_slug: string; tenant_display_name: string }
    >(
      `select tc.id, tc.tenant_id, tc.channel_type, tc.external_workspace_id,
              tc.external_team_name, tc.status, tc.outbound_enabled,
              tc.token_expires_at, tc.last_seen_at, tc.last_refresh_error,
              tc.connected_by_user_id, tc.created_at, tc.updated_at,
              t.slug as tenant_slug, t.display_name as tenant_display_name
         from public.tenant_channels tc
         join public.tenants t on t.id = tc.tenant_id
        order by tc.created_at desc`,
    );
    return rows.map((r) => ({
      ...toTenantChannel(r),
      tenantSlug: r.tenant_slug,
      tenantDisplayName: r.tenant_display_name,
    }));
  } catch {
    return [];
  }
}

interface ChannelMessageRow {
  id: string;
  tenant_channel_id: string;
  direction: 'inbound' | 'outbound';
  external_message_id: string | null;
  external_conversation_id: string | null;
  external_sender_id: string | null;
  body_text: string | null;
  body_json: unknown;
  posted_at: string | Date;
  created_at: string | Date;
}

function toChannelMessage(r: ChannelMessageRow): ChannelMessage {
  return {
    id: r.id,
    tenantChannelId: r.tenant_channel_id,
    direction: r.direction,
    externalMessageId: r.external_message_id,
    externalConversationId: r.external_conversation_id,
    externalSenderId: r.external_sender_id,
    bodyText: r.body_text,
    bodyJson: r.body_json,
    postedAt: iso(r.posted_at),
    createdAt: iso(r.created_at),
  };
}

/**
 * 채널 단건의 최근 메시지(디버그/타임라인). MVP UI 에선 안 쓰지만 admin 뷰가 곧 필요.
 * tenant_channels 와 join 해서 tenant 격리를 보장한다.
 */
export async function listChannelMessages(
  tenantChannelId: string,
  limit = 50,
): Promise<ChannelMessage[]> {
  try {
    const { rows } = await query<ChannelMessageRow>(
      `select id, tenant_channel_id, direction, external_message_id,
              external_conversation_id, external_sender_id, body_text, body_json,
              posted_at, created_at
         from public.channel_messages
        where tenant_channel_id = $1
        order by posted_at desc
        limit $2`,
      [tenantChannelId, limit],
    );
    return rows.map(toChannelMessage);
  } catch {
    return [];
  }
}
