/**
 * @file app/bots/page.tsx
 * @description 봇 팀 전체 목록 페이지. 서버 사이드에서 /api/bots를 호출하여
 *   BotCard 그리드를 렌더링한다.
 * @route /bots
 * @renderMode SSR (서버 컴포넌트)
 */

import BotCard from '@/components/BotCard';
import type { Bot } from '@/types';

/**
 * 전체 봇 목록을 서버 사이드에서 가져온다.
 *
 * @returns Bot 배열
 * @throws {Error} API 응답이 실패하거나 NEXT_PUBLIC_BASE_URL이 잘못된 경우
 */
async function getBots(): Promise<Bot[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/bots`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch bots');
  }

  return response.json();
}

/**
 * @component BotsPage
 * @description 봇 팀 목록 페이지. 전체 봇을 3열 그리드로 표시.
 */
export default async function BotsPage() {
  const bots = await getBots();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Bot Team Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor all bot activities and status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>
    </div>
  );
}
