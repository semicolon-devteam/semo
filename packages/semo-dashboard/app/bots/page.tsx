import { BotCard } from '@/lib/shared-ui';
import type { Bot } from '@/types';
import { query } from '@/lib/db';
import { getItem } from '@/lib/kb';
import RuntimeSourceChart from '@/components/RuntimeSourceChart';
import SystemHealthBanner from '@/components/SystemHealthBanner';

export const dynamic = 'force-dynamic';

interface BotStatusRow {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  last_active: string | null;
  session_count: number;
  workspace_path: string;
  status: 'online' | 'offline';
}

function parseIdentityContent(
  content: string,
  botId: string,
): { name: string; emoji: string; role: string } {
  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(\S+)/);
  const roleMatch = content.match(/\*\*(?:Creature|Role|직책):\*\*\s*(.+)/);
  return {
    name: nameMatch ? nameMatch[1].trim() : botId,
    emoji: emojiMatch ? emojiMatch[1].trim() : '',
    role: roleMatch ? roleMatch[1].trim() : 'Bot',
  };
}

async function enrichBotMetadata(
  botId: string,
): Promise<{ name: string; emoji: string; role: string }> {
  // 1. KB identity (SoT)
  try {
    const entry = await getItem('bot-config', `${botId}/identity`);
    if (entry?.content) return parseIdentityContent(entry.content, botId);
  } catch {
    /* KB unavailable */
  }
  // 2. bot_workspace_files fallback
  try {
    const dbResult = await query<{ content: string }>(
      `SELECT content FROM semo.bot_workspace_files WHERE bot_id = $1 AND file_path = 'IDENTITY.md'`,
      [botId],
    );
    if (dbResult.rows.length > 0) return parseIdentityContent(dbResult.rows[0].content, botId);
  } catch {
    /* DB fallback failed */
  }
  return { name: botId, emoji: '', role: 'Bot' };
}

async function getBots(): Promise<Bot[]> {
  const result = await query<BotStatusRow>(`
    SELECT bot_id, name, emoji, role, last_active, session_count, workspace_path, status
    FROM semo.bot_status
    ORDER BY bot_id
  `);

  return Promise.all(
    result.rows.map(async (row): Promise<Bot> => {
      let { name, emoji, role } = row;

      if (!name || !emoji || !role) {
        const meta = await enrichBotMetadata(row.bot_id);
        name = name || meta.name;
        emoji = emoji || meta.emoji;
        role = role || meta.role;
      }

      return {
        id: row.bot_id,
        name: name || row.bot_id,
        emoji: emoji || '',
        role: role || 'Bot',
        status: row.status || 'offline',
        lastActive: row.last_active || new Date().toISOString(),
        sessionCount: row.session_count || 0,
        workspacePath: row.workspace_path || `~/.semo/workspaces/${row.bot_id}`,
      };
    }),
  );
}

export default async function BotsPage() {
  let bots: Bot[] = [];
  let error = false;

  try {
    bots = await getBots();
  } catch (e) {
    console.error('Failed to fetch bots:', e);
    error = true;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">봇 팀 현황</h1>
        <p className="text-gray-600 dark:text-gray-400">모든 봇의 활동과 상태를 모니터링합니다</p>
      </div>

      <div className="mb-6">
        <SystemHealthBanner />
      </div>

      <div className="mb-8">
        <RuntimeSourceChart days={7} />
      </div>

      {error ? (
        <div className="text-center py-12 text-red-500">DB 연결에 실패했습니다.</div>
      ) : bots.length === 0 ? (
        <div className="text-center py-12 text-gray-500">등록된 봇이 없습니다.</div>
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
