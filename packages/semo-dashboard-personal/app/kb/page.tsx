'use client';

import { useEffect, useState } from 'react';
import { DomainCard } from '@team-semicolon/dashboard-ui';
import type { KBDomain } from '@team-semicolon/dashboard-ui';

const ICON_MAP: Record<string, string> = {
  service: '🧩',
  platform: '🛰️',
  person: '👤',
  bot: '🤖',
  org: '🏢',
  module: '📦',
};

function iconFor(domain: string): string {
  if (domain.endsWith('claw') || domain.endsWith('bot')) return ICON_MAP.bot;
  if (domain === 'semo') return ICON_MAP.platform;
  if (domain === 'semicolon') return ICON_MAP.org;
  return ICON_MAP.service;
}

export default function KBPage() {
  const [domains, setDomains] = useState<KBDomain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/kb/list')
      .then((res) => res.json())
      .then((data) => setDomains(data.domains || []))
      .catch((err) => console.error('[kb] list failed', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Knowledge Base</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">SQLite kb.db 도메인 목록</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">로딩 중...</div>
      ) : domains.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-base mb-1">KB 엔트리가 없습니다</div>
          <div className="text-xs">
            <code>
              semo kb upsert {'{domain}'} {'{key}'} --content &quot;...&quot;
            </code>{' '}
            로 추가할 수 있습니다
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {domains.map((d) => (
            <DomainCard
              key={d.domain}
              domain={d}
              icon={iconFor(d.domain)}
              onClick={() => {
                window.location.href = `/kb/${encodeURIComponent(d.domain)}`;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
