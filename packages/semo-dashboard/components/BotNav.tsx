'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BotNavProps {
  currentBotId: string;
}

interface BotSummary {
  id: string;
  name: string;
  emoji: string;
  status: 'online' | 'offline';
}

export default function BotNav({ currentBotId }: BotNavProps) {
  const [bots, setBots] = useState<BotSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bots')
      .then(r => r.ok ? r.json() : [])
      .then((data: BotSummary[]) => setBots(data))
      .catch(() => setBots([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  if (bots.length === 0) return null;

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {bots.map(bot => {
        const isCurrent = bot.id === currentBotId;
        const isOnline = bot.status === 'online';

        return (
          <Link
            key={bot.id}
            href={`/bots/${bot.id}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              isCurrent
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span>{bot.emoji}</span>
            <span>{bot.name}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isOnline ? 'bg-green-400' : isCurrent ? 'bg-blue-300' : 'bg-gray-500'
              }`}
            />
          </Link>
        );
      })}
    </div>
  );
}
