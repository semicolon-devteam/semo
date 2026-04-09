import BotCard from '@/components/BotCard';
import type { Bot } from '@/types';
import { query } from '@/lib/db';

async function getBots(): Promise<Bot[]> {
  try {
    const result = await query<{
      bot_id: string;
      name: string | null;
      emoji: string | null;
      role: string | null;
      last_active: string | null;
      session_count: number;
      workspace_path: string;
      status: string;
    }>(`
      SELECT bot_id, name, emoji, role, last_active, session_count, workspace_path, status
      FROM semo.bot_status
      ORDER BY bot_id
    `);

    return result.rows.map((row) => ({
      id: row.bot_id,
      name: row.name || row.bot_id,
      emoji: row.emoji || '',
      role: row.role || 'Bot',
      status: (row.status as Bot['status']) || 'offline',
      lastActive: row.last_active || new Date().toISOString(),
      sessionCount: row.session_count || 0,
      workspacePath: row.workspace_path || `~/.openclaw-${row.bot_id}/workspace`,
    }));
  } catch (error) {
    console.error('Failed to fetch bots from DB:', error);
    return [];
  }
}

export default async function BotsPage() {
  const bots = await getBots();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">봇 팀 현황</h1>
        <p className="text-gray-600 dark:text-gray-400">모든 봇의 활동과 상태를 모니터링합니다</p>
      </div>

      {bots.length === 0 ? (
        <div className="text-center py-12 text-gray-500">봇 데이터를 불러올 수 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
