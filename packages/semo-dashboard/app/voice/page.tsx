'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { disablePush, enablePush, getPushStatus, type PushStatus } from '@/lib/push-client';

type CallState = 'idle' | 'connecting' | 'in-call' | 'reconnecting' | 'ended';

const STATE_LABELS: Record<CallState, { label: string; color: string }> = {
  idle: { label: '대기', color: 'bg-gray-500' },
  connecting: { label: '연결 중', color: 'bg-yellow-500 animate-pulse' },
  'in-call': { label: '통화 중', color: 'bg-green-500' },
  reconnecting: { label: '재연결 중', color: 'bg-yellow-500 animate-pulse' },
  ended: { label: '종료됨', color: 'bg-gray-400' },
};

export default function VoicePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const tokenFetching = useRef(false);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const refreshPushStatus = useCallback(async () => {
    try {
      const s = await getPushStatus();
      setPushStatus(s);
    } catch (err) {
      console.error('[push] status error:', err);
    }
  }, []);

  useEffect(() => {
    void refreshPushStatus();
  }, [refreshPushStatus]);

  const onEnablePush = useCallback(async () => {
    setPushBusy(true);
    try {
      const s = await enablePush();
      setPushStatus(s);
    } finally {
      setPushBusy(false);
    }
  }, []);

  const onDisablePush = useCallback(async () => {
    setPushBusy(true);
    try {
      const s = await disablePush();
      setPushStatus(s);
    } finally {
      setPushBusy(false);
    }
  }, []);

  const VALID_STATES = new Set<CallState>([
    'idle',
    'connecting',
    'in-call',
    'reconnecting',
    'ended',
  ]);

  // iframe postMessage 수신 — call state + token 요청
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // origin 검증 (same-origin iframe)
      if (event.origin !== window.location.origin) return;

      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'VOICE_READY') {
        // softphone이 준비됨 → token 발급 후 전달
        fetchAndSendToken();
      }

      if (msg.type === 'VOICE_STATE' && VALID_STATES.has(msg.state)) {
        setCallState(msg.state);
      }

      if (msg.type === 'VOICE_ERROR') {
        setError(msg.message || 'Unknown error');
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  async function fetchAndSendToken() {
    if (tokenFetching.current) return; // 중복 발급 방지
    tokenFetching.current = true;
    try {
      setError(null);
      const res = await fetch('/api/voice/token');
      if (!res.ok) {
        setError('음성 토큰 발급 실패 — 로그인 상태를 확인하세요');
        return;
      }
      const { token, expiresAt } = await res.json();

      // iframe에 token + signaling URL 전달
      // 배포 환경: wss, 로컬: ws. hostname 기반 자동 결정
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const signalingUrl =
        process.env.NEXT_PUBLIC_VOICE_SIGNALING_URL ||
        (isLocal ? 'ws://localhost:8922/signal' : 'wss://voice.semi-colon.space/signal');
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'VOICE_AUTH', token, expiresAt, signalingUrl },
        window.location.origin,
      );
      setTokenReady(true);
    } catch {
      setError('음성 서비스 연결 실패');
    } finally {
      tokenFetching.current = false;
    }
  }

  const stateInfo = STATE_LABELS[callState];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Voice</h1>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${stateInfo.color}`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">{stateInfo.label}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
          <button onClick={fetchAndSendToken} className="ml-2 underline hover:no-underline">
            재시도
          </button>
        </div>
      )}

      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg text-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="text-gray-700 dark:text-gray-300">
          <span className="font-medium mr-2">🔔 통화 푸시 알림</span>
          {pushStatus?.subscribed ? (
            <span className="text-green-600 dark:text-green-400">활성됨 (이 디바이스)</span>
          ) : pushStatus?.supported === false ? (
            <span className="text-yellow-600 dark:text-yellow-400">
              지원 안 됨 — iOS는 홈 화면에 추가된 PWA에서만 가능
            </span>
          ) : pushStatus?.permission === 'denied' ? (
            <span className="text-yellow-600 dark:text-yellow-400">
              권한 거부됨 — 브라우저 설정에서 알림 허용 필요
            </span>
          ) : (
            <span className="text-gray-500">비활성</span>
          )}
          {pushStatus?.reason && (
            <span className="ml-2 text-xs text-gray-500">({pushStatus.reason})</span>
          )}
        </div>
        <div className="flex gap-2">
          {pushStatus?.subscribed ? (
            <button
              onClick={onDisablePush}
              disabled={pushBusy}
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              비활성화
            </button>
          ) : (
            <button
              onClick={onEnablePush}
              disabled={pushBusy || pushStatus?.supported === false}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              활성화
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <iframe
          ref={iframeRef}
          src="/softphone/index.html"
          className="w-full border-0"
          style={{ height: '680px' }}
          allow="microphone"
          title="SEMO Voice Softphone"
        />
      </div>

      {!tokenReady && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          소프트폰 로딩 중...
        </p>
      )}
    </div>
  );
}
