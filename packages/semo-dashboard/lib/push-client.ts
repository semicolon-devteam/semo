/**
 * 브라우저(클라이언트) 측 Web Push 헬퍼.
 * Service Worker register + permission + subscribe + 서버 endpoint 등록.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission | 'unknown';
  subscribed: boolean;
  endpoint?: string;
  reason?: string;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined')
    return { supported: false, permission: 'unknown', subscribed: false };
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  if (!supported)
    return {
      supported: false,
      permission: 'unknown',
      subscribed: false,
      reason: 'browser_unsupported',
    };
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return {
    supported,
    permission: Notification.permission,
    subscribed: !!sub,
    endpoint: sub?.endpoint,
  };
}

export async function enablePush(): Promise<PushStatus> {
  if (typeof window === 'undefined') {
    return { supported: false, permission: 'unknown', subscribed: false, reason: 'ssr' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      supported: false,
      permission: 'unknown',
      subscribed: false,
      reason: 'browser_unsupported',
    };
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: false,
      reason: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY not set',
    };
  }

  const reg =
    (await navigator.serviceWorker.getRegistration('/sw.js')) ||
    (await navigator.serviceWorker.register('/sw.js'));

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { supported: true, permission, subscribed: false, reason: 'permission_denied' };
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // 서버 등록
  const json = sub.toJSON();
  const res = await fetch('/api/voice/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      expirationTime: json.expirationTime,
      deviceLabel: navigator.userAgent.slice(0, 120),
    }),
  });
  if (!res.ok) {
    return {
      supported: true,
      permission,
      subscribed: false,
      endpoint: json.endpoint,
      reason: `subscribe API ${res.status}`,
    };
  }

  return { supported: true, permission, subscribed: true, endpoint: json.endpoint };
}

export async function disablePush(): Promise<PushStatus> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { supported: false, permission: 'unknown', subscribed: false };
  }
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return { supported: true, permission: Notification.permission, subscribed: false };
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch('/api/voice/push-subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
  return { supported: true, permission: Notification.permission, subscribed: false };
}
