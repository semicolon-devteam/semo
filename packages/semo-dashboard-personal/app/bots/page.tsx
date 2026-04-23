import { BotCard } from '@team-semicolon/dashboard-ui';
import type { Bot } from '@team-semicolon/dashboard-ui';
import { scanBots } from '@/lib/bots-scanner';

export const dynamic = 'force-dynamic';

async function loadBots(): Promise<Bot[]> {
  return scanBots();
}

export default async function BotsPage() {
  const bots = await loadBots();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">봇</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          로컬 Claude 세션 기반 봇 현황 (ops.db SoT)
        </p>
      </div>

      {bots.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-base mb-1">등록된 봇이 없습니다</div>
          <div className="text-xs">
            ops.db의 bot_status 테이블이 비어있습니다. <code>semo onboard</code> 로 초기 봇 세팅을
            진행하거나 PR-E에서 봇 로딩이 연결되면 표시됩니다
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
