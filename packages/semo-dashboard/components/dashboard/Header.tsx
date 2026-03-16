/**
 * @file components/dashboard/Header.tsx
 * @description 대시보드 상단 헤더. SEMO HQ 타이틀, ACTIVE 배지,
 *   활성 에이전트 수(온라인/전체)를 표시한다.
 * @module components/dashboard
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * @component Header
 * @description 대시보드 헤더 바. /api/bots 에서 봇 목록을 가져와 온라인 수를 계산한다.
 */
export default function Header() {
  const [totalBots, setTotalBots] = useState<number>(0);
  const [onlineBots, setOnlineBots] = useState<number>(0);

  /** @sideEffect /api/bots 에서 봇 상태를 가져와 온라인 수 계산 */
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
