import { BotCard } from '@/lib/shared-ui';
import type { Bot } from '@/types';
import { query } from '@/lib/db';
import { getItem } from '@/lib/kb';
import RuntimeSourceChart from '@/components/RuntimeSourceChart';
import SystemHealthBanner from '@/components/SystemHealthBanner';
import { PageBody, PageHeader, Card } from '@/components/ui/semo';

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
    <PageBody>
      <PageHeader title="봇 팀 현황" sub="모든 봇의 활동과 상태를 모니터링합니다" />

      <div style={{ display: 'grid', gap: 20 }}>
        <SystemHealthBanner />
        <RuntimeSourceChart days={7} />

        {error ? (
          <Card style={{ textAlign: 'center', padding: 48, color: 'var(--semo-danger)' }}>
            DB 연결에 실패했습니다.
          </Card>
        ) : bots.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 48, color: 'var(--semo-fg-3)' }}>
            등록된 봇이 없습니다.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bots.map((bot) => (
              <BotCard key={bot.id} bot={bot} />
            ))}
          </div>
        )}
      </div>
    </PageBody>
  );
}
