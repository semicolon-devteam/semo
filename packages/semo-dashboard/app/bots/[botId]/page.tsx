'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface BotInfo {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'online' | 'offline';
  lastActive: string;
  sessionCount: number;
  workspacePath: string;
  syncedAt: string;
}

interface Session {
  sessionKey: string;
  label: string;
  kind: string;
  chatType: string;
  lastActivity: string;
  messageCount: number;
}

interface KBItem {
  kb_id: number;
  domain: string;
  key: string;
  content: string;
  updated_at?: string;
}

type Tab = 'sessions' | 'kb';

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>();

  const [bot, setBot] = useState<BotInfo | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [kbItems, setKbItems] = useState<KBItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  function fmt(iso?: string) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

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
              <span className="font-semibold text-gray-900 dark:text-white">{fmt(bot.lastActive)}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-0.5">Synced</span>
              <span className="font-semibold text-gray-900 dark:text-white">{fmt(bot.syncedAt)}</span>
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
          {(['sessions', 'kb'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'sessions' ? `Sessions (${sessions.length})` : `Bot KB (${kbItems.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'sessions' && (
          sessions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>세션 기록 없음</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Label</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden md:table-cell">Kind</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden md:table-cell">Channel</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Messages</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden lg:table-cell">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr
                      key={s.sessionKey}
                      className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${i === sessions.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{s.label || s.sessionKey}</div>
                        <div className="text-xs text-gray-400 font-mono">{s.sessionKey}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{s.kind}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{s.chatType}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{s.messageCount}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 text-xs hidden lg:table-cell whitespace-nowrap">{fmt(s.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'kb' && (
          kbItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>봇 KB 항목 없음</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Key</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden md:table-cell">Domain</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Content</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden lg:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {kbItems.map((item, i) => (
                    <tr
                      key={item.kb_id}
                      className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${i === kbItems.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{item.key}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">{item.domain}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-sm">
                        <p className="line-clamp-2 text-xs">{item.content}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 text-xs hidden lg:table-cell whitespace-nowrap">{fmt(item.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
