'use client';

import { useState, useEffect } from 'react';

export default function Header() {
  const [totalBots, setTotalBots] = useState<number>(0);
  const [onlineBots, setOnlineBots] = useState<number>(0);

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .catch(() => [])
      .then((bots: Array<{ status: string }>) => {
        if (!Array.isArray(bots)) return;
        setTotalBots(bots.length);
        setOnlineBots(bots.filter((b) => b.status === 'online').length);
      });
  }, []);

  return (
    <header className="h-[60px] bg-white border-b border-gray-200 flex items-center px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-gray-900">SEMO HQ</h1>
        <span className="px-3 py-1 rounded-full text-xs font-medium text-white bg-green-500">
          ACTIVE
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Active Agents:</span>
        <span className="text-sm font-semibold text-gray-900">
          {onlineBots} / {totalBots}
        </span>
      </div>

      <div className="ml-6">
        <button className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
          U
        </button>
      </div>
    </header>
  );
}
