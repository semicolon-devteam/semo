/**
 * SEMO Voice — Service Worker
 * PWA 기본 캐싱 + push notification 수신
 */

const CACHE_NAME = 'semo-voice-v1';
const CACHE_FILES = ['./index.html', './app.js', './manifest.json'];

// Install — 정적 파일 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES)));
  self.skipWaiting();
});

// Activate — 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

// Fetch — GET만 캐시, 네트워크 우선
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// Push notification 수신
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* non-JSON payload fallback */
  }
  const title = data.title || 'SEMO Voice';
  const options = {
    body: data.body || '새 통화 요청이 있습니다',
    icon: '/softphone/icon-192.png',
    badge: '/softphone/icon-192.png',
    tag: 'semo-voice-call',
    renotify: true,
    data: { url: data.url || '/softphone/index.html' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 → 앱 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/softphone/index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes('/softphone'));
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
