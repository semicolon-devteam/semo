/**
 * Web Push helper — VAPID 초기화 + 멀티 endpoint 송신.
 * Codex 권장: payload <4KB, TTL 30s, 410 GONE → subscription 자동 정리.
 */

import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { query } from './db';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@semi-colon.space';

let _vapidConfigured = false;
function ensureVapid() {
  if (_vapidConfigured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set');
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  _vapidConfigured = true;
}

export interface PushPayload {
  title: string;
  body?: string;
  call_id: string;
  guild_id: string;
  channel_id: string;
}

export interface SubscriptionRow {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failed_count: number;
}

export async function getSubscriptionsForUser(userId: string): Promise<SubscriptionRow[]> {
  const res = await query<SubscriptionRow>(
    `SELECT id, user_id, endpoint, p256dh, auth, failed_count
       FROM dashboard_push_subscriptions
      WHERE user_id = $1
        AND failed_count < 5`,
    [userId],
  );
  return res.rows;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  ttl = 30,
): Promise<{ ok: number; gone: number; failed: number }> {
  ensureVapid();
  const subs = await getSubscriptionsForUser(userId);
  let ok = 0;
  let gone = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      const subscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: ttl,
          urgency: 'high',
        });
        await query(
          `UPDATE dashboard_push_subscriptions
              SET last_seen_at = NOW(), failed_count = 0
            WHERE id = $1`,
          [sub.id],
        );
        ok++;
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const status = (err as any)?.statusCode;
        if (status === 404 || status === 410) {
          await query(`DELETE FROM dashboard_push_subscriptions WHERE id = $1`, [sub.id]);
          gone++;
        } else {
          await query(
            `UPDATE dashboard_push_subscriptions
                SET failed_count = failed_count + 1
              WHERE id = $1`,
            [sub.id],
          );
          failed++;
          console.error('[web-push] send failed:', status, (err as Error).message);
        }
      }
    }),
  );
  return { ok, gone, failed };
}

export async function upsertSubscription(opts: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel?: string;
  expiresAt?: Date;
}): Promise<void> {
  await query(
    `INSERT INTO dashboard_push_subscriptions
       (user_id, endpoint, p256dh, auth, device_label, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            device_label = COALESCE(EXCLUDED.device_label, dashboard_push_subscriptions.device_label),
            expires_at = EXCLUDED.expires_at,
            last_seen_at = NOW(),
            failed_count = 0`,
    [
      opts.userId,
      opts.endpoint,
      opts.p256dh,
      opts.auth,
      opts.deviceLabel ?? null,
      opts.expiresAt ?? null,
    ],
  );
}
