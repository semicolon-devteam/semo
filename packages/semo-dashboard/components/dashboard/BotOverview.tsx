'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BotStatus {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: string;
  lastActive: string;
  sessionCount: number;
}

interface KBStats {
  knowledge_base: {
    total: string;
    emb: string;
    by_domain: Array<{ domain: string; cnt: string; emb_cnt: string }>;
  };
}

export default function BotOverview() {
  const [bots, setBots] = useState<BotStatus[]>([]);
  const [kbStats, setKbStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/bots').then(r => r.json()).catch(() => []),
      fetch('/api/kb?action=stats').then(r => r.json()).catch(() => null),
    ]).then(([botsData, statsData]) => {
      setBots(Array.isArray(botsData) ? botsData : []);
      setKbStats(statsData);
      setLoading(false);
    });
  }, []);

  const online = bots.filter(b => b.status === 'online' || b.status === 'active').length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard
          label="전체 봇"
          value={String(bots.length)}
          sub={`온라인 ${online}개`}
          color="blue"
        />
        <StatCard
          label="KB"
          value={kbStats?.knowledge_base.total ?? '-'}
          sub={`임베딩 ${kbStats?.knowledge_base.emb ?? '-'}건`}
          color="green"
        />
      </div>

      {/* 봇 상태 카드 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">봇 상태</h2>
          <Link href="/bots" className="text-xs text-blue-600 hover:underline">
            전체 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {bots.map(bot => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      </div>

      {/* KB 도메인별 현황 */}
      {kbStats && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">KB 도메인</h2>
            <Link href="/kb" className="text-xs text-blue-600 hover:underline">
              KB 보기 →
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">도메인</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">항목</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">임베딩</th>
                </tr>
              </thead>
              <tbody>
                {kbStats.knowledge_base.by_domain.map(d => (
                  <tr key={d.domain} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-gray-800">{d.domain}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{d.cnt}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{d.emb_cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, color,
}: {
  label: string;
  value: string;
  sub: string;
  color: 'blue' | 'green' | 'purple';
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs mt-1 opacity-60">{sub}</p>
    </div>
  );
}

function BotCard({ bot }: { bot: BotStatus }) {
  const isOnline = bot.status === 'online' || bot.status === 'active';
  const lastActive = bot.lastActive
    ? new Date(bot.lastActive).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';

  return (
    <Link href={`/bots/${bot.id}`} className="block">
      <div className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <span className="text-base">{bot.emoji || '🤖'}</span>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
        </div>
        <p className="text-sm font-medium text-gray-800 truncate">{bot.name || bot.id}</p>
        <p className="text-xs text-gray-500 truncate">{bot.role || '-'}</p>
        <p className="text-xs text-gray-400 mt-1">{lastActive}</p>
      </div>
    </Link>
  );
}
