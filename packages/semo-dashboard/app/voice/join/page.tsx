'use client';

import { useEffect, useMemo, useRef } from 'react';

/**
 * Push notification 탭 후 진입하는 fallback 중계 페이지 (Codex 권장).
 * Discord deep link chain (PWA SW → discord://) 보장 안 되므로
 * 이 페이지가 안전망 — userAgent 따라 자동 redirect 시도 + 수동 버튼.
 */
export default function VoiceJoinPage() {
  const autoRedirectFired = useRef(false);

  const params = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    return {
      callId: sp.get('call_id') || '',
      guild: sp.get('guild') || '',
      channel: sp.get('channel') || '',
    };
  }, []);

  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
  }, []);

  const deepLink = useMemo(() => {
    if (!params?.guild || !params?.channel) return '';
    return isMobile
      ? `discord://channels/${params.guild}/${params.channel}`
      : `https://discord.com/channels/${params.guild}/${params.channel}`;
  }, [isMobile, params]);

  const webLink = useMemo(() => {
    if (!params?.guild || !params?.channel) return '';
    return `https://discord.com/channels/${params.guild}/${params.channel}`;
  }, [params]);

  useEffect(() => {
    if (!deepLink || autoRedirectFired.current) return;
    autoRedirectFired.current = true;
    const t = setTimeout(() => {
      window.location.href = deepLink;
    }, 250);
    return () => clearTimeout(t);
  }, [deepLink]);

  if (!params || !params.guild || !params.channel) {
    return (
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        <h1 className="text-xl font-bold mb-3">잘못된 링크</h1>
        <p className="text-gray-600">guild_id 또는 channel_id 가 빠져 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">📞</div>
        <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">SemoBot 통화</h1>
        <p className="text-gray-500 text-sm">
          Discord 음성 채널로 이동합니다.
          {params.callId && (
            <>
              <br />
              <span className="text-xs">call_id: {params.callId}</span>
            </>
          )}
        </p>
      </div>

      <div className="space-y-3">
        <a
          href={deepLink}
          className="block w-full text-center py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-95 transition"
        >
          {isMobile ? 'Discord 앱으로 받기' : 'Discord 데스크톱으로 받기'}
        </a>
        {isMobile && (
          <a
            href={webLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            웹에서 받기
          </a>
        )}
        <button
          onClick={() => window.close()}
          className="block w-full text-center py-3 rounded-xl bg-transparent text-gray-500 hover:text-gray-700"
        >
          닫기
        </button>
      </div>

      <p className="mt-8 text-xs text-gray-500 text-center leading-relaxed">
        Discord 가 열리지 않으면 위 버튼을 다시 눌러주세요.
        <br />
        앱이 설치되어 있어야 자동 전환됩니다.
      </p>
    </div>
  );
}
