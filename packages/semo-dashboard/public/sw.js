/**
 * SEMO Call — Web Push Service Worker
 * Phase A3 — push notification + Discord deep link 중계
 */

// 즉시 활성화 (skipWaiting → claim)
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push event — payload JSON: { title, body, call_id, guild_id, channel_id }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: '📞 SemoBot 통화' };
  }

  const title = data.title || '📞 SemoBot 통화';
  const body = data.body || '';
  const tag = data.call_id || 'semo-call';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/softphone/icon-192.png',
      badge: '/softphone/icon-192.png',
      tag,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data,
      actions: [
        { action: 'join', title: '받기' },
        { action: 'reject', title: '거절' },
      ],
    }),
  );
});

// 알림 탭 → /voice/join 중계 페이지 열기 (Codex 권장 fallback)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'reject') return;

  const data = event.notification.data || {};
  const params = new URLSearchParams({
    call_id: String(data.call_id || ''),
    guild: String(data.guild_id || ''),
    channel: String(data.channel_id || ''),
  });
  const url = `/voice/join?${params.toString()}`;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of allClients) {
        if (c.url.includes('/voice/join') && 'focus' in c) {
          await c.focus();
          await c.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
