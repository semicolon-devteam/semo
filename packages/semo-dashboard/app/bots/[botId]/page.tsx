/**
 * @file app/bots/[botId]/page.tsx
 * @description 특정 봇 상세 페이지. Files·Sessions·Bot KB 탭으로 구성된다.
 *   봇 정보·세션·KB를 동시에 fetch하여 렌더링한다.
 * @route /bots/[botId]
 * @renderMode CSR ('use client')
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import FilesTab from './FilesTab';
import type { Session } from '@/types';

/**
 * 봇 상세 정보 (Bot 타입에 syncedAt 추가).
 * SEMO sync 타임스탬프는 bot_status.synced_at에서 온다.
 */
interface BotInfo {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'online' | 'offline';
  lastActive: string;
  sessionCount: number;
  workspacePath: string;
  /** SEMO sync 타임스탬프 (bot_status.synced_at) */
  syncedAt: string;
}

/**
 * KB API 응답 행 형태 (lib/kb.ts list() 반환값).
 * @remarks @/types KBItem과 다른 스키마 — DB 행을 직접 반영.
 */
interface BotKBItem {
  kb_id: number;
  domain: string;
  key: string;
  content: string;
  updated_at?: string;
}

type Tab = 'sessions' | 'kb' | 'files';

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>();

  const [bot, setBot] = useState<BotInfo | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [kbItems, setKbItems] = useState<BotKBItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKbItem, setSelectedKbItem] = useState<BotKBItem | null>(null);
  const [sessionKindFilter, setSessionKindFilter] = useState<'all' | 'main' | 'isolated'>('all');
  const [sessionChatFilter, setSessionChatFilter] = useState<'all' | 'channel' | 'direct'>('all');

  /** @sideEffect 봇 상세/세션/KB 동시 fetch */
  useEffect(() => {
    if (!botId) return;

    setLoading(true);
    Promise.all([
      fetch(`/api/bots/${botId}`).then((r) => {
        if (!r.ok) throw new Error('Bot not found');
        return r.json();
      }),
      fetch(`/api/bots/${botId}/detail`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/kb?bot_id=${botId}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([botData, detail, kb]) => {
        setBot(botData);
        setSessions(detail?.activity?.sessions ?? []);
        setKbItems(Array.isArray(kb) ? kb : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [botId]);

  /**
   * ISO 타임스탬프를 한국 표기 날짜/시간으로 변환한다.
   *
   * @param iso - ISO 8601 타임스탬프 (undefined면 '-' 반환)
   * @returns "MM/DD HH:mm" 형식 문자열
   */
  function formatTimestamp(iso?: string) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function parseSessionKey(key: string) {
    const parts = key.split(':');
    return {
      kind: parts[1] ?? '',
      chatType: parts[3] ?? '',
      channelId: parts[4] ?? '',
      threadId: parts[6] ?? '',
    };
  }

  const filteredSessions = sessions.filter((s) => {
    const { kind, chatType } = parseSessionKey(s.sessionKey);
    if (sessionKindFilter !== 'all' && kind !== sessionKindFilter) return false;
    if (sessionChatFilter !== 'all' && chatType !== sessionChatFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/bots" className="text-sm text-blue-600 hover:underline">← Bot Team</Link>
        <div className="mt-8 text-center text-gray-500">
          <p className="text-lg">{error || 'Bot not found'}</p>
        </div>
      </div>
    );
  }

  const isOnline = bot.status === 'online';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back */}
      <Link href="/bots" className="text-sm text-blue-600 hover:underline">
        ← Bot Team
      </Link>

      {/* Bot Header */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-start gap-5">
        <span className="text-5xl">{bot.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{bot.name}</h1>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isOnline
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">{bot.role}</p>

          <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Sessions</span>
              <span className="font-semibold text-gray-900 dark:text-white">{bot.sessionCount}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Last Active</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatTimestamp(bot.lastActive)}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Synced</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatTimestamp(bot.syncedAt)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Workspace</span>
              <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate block">{bot.workspacePath}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {(['files', 'sessions', 'kb'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'sessions' ? `Sessions (${sessions.length})` : tab === 'kb' ? `Bot KB (${kbItems.length})` : 'Files'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'sessions' && (
          <>
            <div className="flex gap-2 flex-wrap mb-4">
              <div className="flex gap-1">
                {(['all', 'main', 'isolated'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSessionKindFilter(k)}
                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                      sessionKindFilter === k
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {k === 'all' ? '전체' : k}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['all', 'channel', 'direct'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setSessionChatFilter(c)}
                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                      sessionChatFilter === c
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {c === 'all' ? '전체' : c}
                  </button>
                ))}
              </div>
            </div>
            {filteredSessions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p>세션 기록 없음</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSessions.slice(0, 60).map((s) => {
                    const { kind, chatType, channelId, threadId } = parseSessionKey(s.sessionKey);
                    return (
                      <div
                        key={s.sessionKey}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              kind === 'main'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}
                          >
                            {kind || 'unknown'}
                          </span>
                          {chatType && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {chatType}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {s.label || (channelId ? `#${channelId}` : s.sessionKey)}
                        </p>
                        {threadId && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">thread: {threadId}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-auto">{formatTimestamp(s.lastActivity)}</p>
                      </div>
                    );
                  })}
                </div>
                {filteredSessions.length > 60 && (
                  <p className="text-xs text-center text-gray-400 mt-4">{filteredSessions.length - 60}개 세션이 더 있습니다</p>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'kb' && (
          kbItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>봇 KB 항목 없음</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kbItems.map((item) => (
                <div
                  key={item.kb_id}
                  onClick={() => setSelectedKbItem(item)}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm leading-snug break-all">{item.key}</span>
                    <span className="shrink-0 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{item.domain}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 flex-1">{item.content}</p>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-auto">{formatTimestamp(item.updated_at)}</div>
                </div>
              ))}
            </div>
          )
        )}


        {activeTab === 'files' && <FilesTab botId={botId} />}
      </div>

      {selectedKbItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedKbItem(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-gray-900 dark:text-white text-sm break-all">{selectedKbItem.key}</span>
                <span className="shrink-0 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{selectedKbItem.domain}</span>
              </div>
              <button
                onClick={() => setSelectedKbItem(null)}
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-2 border-b border-gray-100 dark:border-gray-700/50">
              <span className="text-xs text-gray-400">Updated: {formatTimestamp(selectedKbItem.updated_at)}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">{selectedKbItem.content}</pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setSelectedKbItem(null)}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
