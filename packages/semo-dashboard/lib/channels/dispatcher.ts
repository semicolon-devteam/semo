/**
 * Inbound channel message dispatcher — Codex 리뷰 반영.
 *
 * - channel_messages INSERT (UNIQUE 제약이 Slack/Kakao at-least-once 재시도 dedup 처리).
 * - 동시에 agent_activity INSERT (첫 active 직원 명의) — 고객 Home 피드에 자연스럽게 나타남.
 * - **Outbound stub 자동응답 금지** (Codex CRITICAL). SEMO_RUNTIME_URL 실연동은 후속.
 *   현재는 persist + log 만; outbound 는 tenant_channels.outbound_enabled=true 일 때만,
 *   그것도 별도 outbound poster 가 명시적으로 호출(이번 PR 범위 밖).
 */
import { query } from '@/lib/db';

export interface InboundDispatchInput {
  tenantChannelId: string;
  externalMessageId: string;
  externalChannelId?: string | null;
  externalUserId?: string | null;
  payload: Record<string, unknown>;
  /** agent_activity 표시용. */
  agentVerb: string;
  agentTarget?: string | null;
  agentDetail?: string | null;
}

export type DispatchResult =
  | { duplicate: true }
  | { duplicate: false; messageId: string; activityId: string | null };

/**
 * 인바운드 메시지를 channel_messages 에 적재하고 agent_activity 에 미러링.
 * dedup: (tenant_channel_id, direction='inbound', external_message_id) UNIQUE.
 * agent_activity 미러는 첫 active install 을 emitter 로 사용(MVP 라우팅).
 */
export async function dispatchInboundMessage(input: InboundDispatchInput): Promise<DispatchResult> {
  const msgRes = await query<{ id: string; tenant_id: string }>(
    `with ins as (
       insert into public.channel_messages
         (tenant_channel_id, direction, external_message_id, external_channel_id,
          external_user_id, payload, status)
       values ($1, 'inbound', $2, $3, $4, $5::jsonb, 'received')
       on conflict (tenant_channel_id, direction, external_message_id) do nothing
       returning id, tenant_channel_id
     )
     select i.id, tc.tenant_id
       from ins i
       join public.tenant_channels tc on tc.id = i.tenant_channel_id`,
    [
      input.tenantChannelId,
      input.externalMessageId,
      input.externalChannelId ?? null,
      input.externalUserId ?? null,
      JSON.stringify(input.payload),
    ],
  );
  if (msgRes.rows.length === 0) return { duplicate: true };

  const { id: messageId, tenant_id: tenantId } = msgRes.rows[0];

  const actRes = await query<{ id: string }>(
    `insert into public.agent_activity
       (tenant_id, listing_id, verb, target, detail, is_ai, status, occurred_at)
     select $1::uuid, i.listing_id, $2, $3, $4, true, 'done', now()
       from public.agent_installs i
      where i.tenant_id = $1 and i.install_status = 'active'
      order by i.installed_at
      limit 1
     returning id`,
    [tenantId, input.agentVerb, input.agentTarget ?? null, input.agentDetail ?? null],
  );

  return { duplicate: false, messageId, activityId: actRes.rows[0]?.id ?? null };
}
