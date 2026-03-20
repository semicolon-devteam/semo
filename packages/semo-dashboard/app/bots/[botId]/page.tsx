'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import LayerModal from '@/components/LayerModal';
import SessionCard from '@/components/SessionCard';
import CronJobCard from '@/components/CronJobCard';

import DomainCard from '@/components/DomainCard';
import FilesTab from '@/components/files/FilesTab';
import SkillsTab from '@/components/skills/SkillsTab';
import AuditChecklist from '@/components/AuditChecklist';
import type { Session, CronJob, BotAudit, BotSkill } from '@/types';

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

interface KBItem {
  kb_id: number;
  domain: string;
  key: string;
  content: string;
  updated_at?: string;
}

type Tab = 'files' | 'skills' | 'sessions' | 'cron' | 'kb' | 'audit';

const DOMAIN_ICONS: Record<string, string> = {
  team: '\u{1F465}',
  project: '\u{1F4CB}',
  decision: '\u2696\uFE0F',
  process: '\u{1F504}',
  infra: '\u{1F3D7}\uFE0F',
  kpi: '\u{1F4CA}',
  'session-log': '\u{1F4DD}',
};

function getDomainIcon(domain: string): string {
  return DOMAIN_ICONS[domain] || '\u{1F4C2}';
}

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>();

  const [bot, setBot] = useState<BotInfo | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [kbItems, setKbItems] = useState<KBItem[]>([]);
  const [skills, setSkills] = useState<BotSkill[]>([]);
  const [audit, setAudit] = useState<BotAudit | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Session modal
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Cron modal
  const [selectedCron, setSelectedCron] = useState<CronJob | null>(null);
  const [cronFormMode, setCronFormMode] = useState<'view' | null>(null);

  // KB modal (2-layer)
  const [selectedKBDomain, setSelectedKBDomain] = useState<string | null>(null);
  const [selectedKBItem, setSelectedKBItem] = useState<KBItem | null>(null);

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
      fetch(`/api/bots/${botId}/audit`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/bots/${botId}/skills`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([botData, detail, kb, auditData, skillsData]) => {
        setBot(botData);
        setSessions(detail?.activity?.sessions ?? []);
        setCronJobs(detail?.activity?.cronJobs ?? []);
        setKbItems(Array.isArray(kb) ? kb : []);
        setAudit(auditData);
        setSkills(Array.isArray(skillsData) ? skillsData : []);
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

  // Group KB items by domain
  const kbByDomain = kbItems.reduce<Map<string, KBItem[]>>((acc, item) => {
    const list = acc.get(item.domain) || [];
    list.push(item);
    acc.set(item.domain, list);
    return acc;
  }, new Map());

  const domainCards = Array.from(kbByDomain.entries()).map(([domain, items]) => ({
    domain,
    entry_count: items.length,
  }));

  const domainKBItems = selectedKBDomain ? kbByDomain.get(selectedKBDomain) ?? [] : [];

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
        <Link href="/bots" className="text-sm text-blue-600 hover:underline">&larr; Bot Team</Link>
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
        &larr; Bot Team
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
          {([
            { key: 'files' as Tab, label: 'Files' },
            { key: 'skills' as Tab, label: `Skills (${skills.length})` },
            { key: 'sessions' as Tab, label: `Sessions (${sessions.length})` },
            { key: 'cron' as Tab, label: `Cron Jobs (${cronJobs.length})` },
            { key: 'kb' as Tab, label: `Bot KB (${kbItems.length})` },
            { key: 'audit' as Tab, label: `Audit${audit ? ` (${audit.score}%)` : ''}` },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'files' && (
          <FilesTab botId={botId} />
        )}

        {activeTab === 'skills' && (
          <SkillsTab botId={botId} />
        )}

        {activeTab === 'sessions' && (
          sessions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>No session records</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((s) => (
                <SessionCard
                  key={s.sessionKey}
                  session={s}
                  onClick={() => setSelectedSession(s)}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'cron' && (
          <div>
            {cronJobs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p>No cron jobs configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {cronJobs.map((cj) => (
                  <CronJobCard
                    key={cj.jobId}
                    cronJob={cj}
                    onClick={() => {
                      setSelectedCron(cj);
                      setCronFormMode('view');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          audit ? (
            <AuditChecklist audit={audit} />
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p>No audit data available</p>
              <p className="text-xs mt-1">Run <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">semo bots audit</code> to generate</p>
            </div>
          )
        )}

        {activeTab === 'kb' && (
          kbItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>No bot KB items</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {domainCards.map((d) => (
                <DomainCard
                  key={d.domain}
                  domain={d}
                  icon={getDomainIcon(d.domain)}
                  onClick={() => {
                    setSelectedKBDomain(d.domain);
                    setSelectedKBItem(null);
                  }}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Cron Job View Modal */}
      <LayerModal
        open={cronFormMode === 'view' && !!selectedCron}
        onClose={() => { setCronFormMode(null); setSelectedCron(null); }}
        title={selectedCron?.name || ''}
        subtitle={selectedCron?.jobId}
      >
        {selectedCron && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Schedule</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                  {selectedCron.schedule.kind === 'cron' && `cron: ${selectedCron.schedule.expression ?? selectedCron.schedule.expr ?? selectedCron.schedule.cron ?? ''}`}
                  {selectedCron.schedule.kind === 'every' && `every ${(selectedCron.schedule.intervalMs ?? selectedCron.schedule.everyMs) ? `${Math.round(Number(selectedCron.schedule.intervalMs ?? selectedCron.schedule.everyMs) / 60000)}m` : '?'}`}
                  {selectedCron.schedule.kind === 'at' && `at ${selectedCron.schedule.datetime ?? ''}`}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Status</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  selectedCron.enabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {selectedCron.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Last Run</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{fmt(selectedCron.lastRun)}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Next Run</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{fmt(selectedCron.nextRun)}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Session Target</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  selectedCron.sessionTarget === 'main'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {selectedCron.sessionTarget ?? 'main'}
                </span>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Job ID</span>
              <code className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg block break-all">
                {selectedCron.jobId}
              </code>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Execution</span>
              {selectedCron.payload?.message ? (
                <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                  {selectedCron.payload.message}
                </pre>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">No execution info</span>
              )}
            </div>
          </div>
        )}
      </LayerModal>

      {/* Session Detail Modal */}
      <LayerModal
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={selectedSession?.label || selectedSession?.sessionKey || ''}
        subtitle={selectedSession?.sessionKey}
      >
        {selectedSession && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Kind</span>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedSession.kind === 'main'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {selectedSession.kind}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Channel</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {selectedSession.chatType}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Messages</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">{selectedSession.messageCount}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Last Activity</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{fmt(selectedSession.lastActivity)}</span>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">Session Key</span>
              <code className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg block break-all">
                {selectedSession.sessionKey}
              </code>
            </div>
          </div>
        )}
      </LayerModal>

      {/* KB Domain Modal (2-layer) */}
      <LayerModal
        open={!!selectedKBDomain}
        onClose={() => {
          setSelectedKBDomain(null);
          setSelectedKBItem(null);
        }}
        icon={selectedKBDomain ? getDomainIcon(selectedKBDomain) : undefined}
        title={selectedKBItem ? selectedKBItem.key : selectedKBDomain ?? ''}
        subtitle={selectedKBItem ? selectedKBItem.domain : undefined}
        showBack={!!selectedKBItem}
        onBack={() => setSelectedKBItem(null)}
      >
        {selectedKBItem ? (
          /* View B: KB Item Detail */
          <div className="space-y-4">
            {selectedKBItem.updated_at && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Updated:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {fmt(selectedKBItem.updated_at)}
                </span>
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                {selectedKBItem.content}
              </pre>
            </div>
          </div>
        ) : (
          /* View A: KB Items List */
          domainKBItems.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No items in this domain
            </p>
          ) : (
            <div className="space-y-1">
              {domainKBItems.map((item) => (
                <div
                  key={item.kb_id}
                  onClick={() => setSelectedKBItem(item)}
                  className="flex items-start justify-between gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.key}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                      {item.content}
                    </p>
                  </div>
                  {item.updated_at && (
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {fmt(item.updated_at)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </LayerModal>
    </div>
  );
}
