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

// 알림 탭 처리 — guild_id 에 따라 분기
//   - 'pwa' → /voice (softphone 자체 ring overlay 가 이미 떠 있음)
//   - 그 외 → /voice/join (Discord deep link 중계, Phase A3)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'reject') return;

  const data = event.notification.data || {};
  const isPwa = String(data.guild_id || '') === 'pwa';

  let url;
  if (isPwa) {
    url = '/voice';
  } else {
    const params = new URLSearchParams({
      call_id: String(data.call_id || ''),
      guild: String(data.guild_id || ''),
      channel: String(data.channel_id || ''),
    });
    url = `/voice/join?${params.toString()}`;
  }

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // 같은 url 이미 열린 탭 있으면 focus
      for (const c of allClients) {
        if (c.url.includes(isPwa ? '/voice' : '/voice/join') && 'focus' in c) {
          await c.focus();
          if ('navigate' in c) await c.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
