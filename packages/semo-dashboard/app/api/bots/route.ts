import { NextResponse } from 'next/server';
import { getFileContent, getBotWorkspaces } from '@/lib/github';
import { query } from '@/lib/db';
import type { Bot } from '@/types';

interface BotStatusRow {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  last_active: string | null;
  session_count: number;
  workspace_path: string;
  status: 'active' | 'idle' | 'error';
  synced_at: string;
}

async function parseBotMetadata(botId: string): Promise<{ name: string; emoji: string; role: string }> {
  try {
    const [identity, user] = await Promise.all([
      getFileContent(`semo-system/bot-workspaces/${botId}/IDENTITY.md`).catch(() => ''),
      getFileContent(`semo-system/bot-workspaces/${botId}/USER.md`).catch(() => ''),
    ]);

    // Parse IDENTITY.md for name and emoji
    const nameMatch = identity.match(/Name:\*\*\s*(.+)/);
    const emojiMatch = identity.match(/Emoji:\*\*\s*(.+)/);
    
    const name = nameMatch ? nameMatch[1].trim() : botId;
    const emoji = emojiMatch ? emojiMatch[1].trim() : '🤖';

    // Parse USER.md for role
    const roleMatch = user.match(/- (.+)/);
    const role = roleMatch ? roleMatch[1].trim() : 'Bot';

    return { name, emoji, role };
  } catch (error) {
    console.error(`Error parsing bot metadata for ${botId}:`, error);
    return { name: botId, emoji: '🤖', role: 'Bot' };
  }
}

export async function GET() {
  try {
    // Query bot status from PostgreSQL
    const result = await query<BotStatusRow>(`
      SELECT bot_id, name, emoji, role, last_active, session_count, workspace_path, status, synced_at
      FROM semo.bot_status
      ORDER BY bot_id
    `);

    // If DB is empty, fallback to GitHub
    if (result.rows.length === 0) {
      console.log('DB empty, falling back to GitHub...');
      const botIds = await getBotWorkspaces();
      
      const bots = await Promise.all(
        botIds.map(async (botId): Promise<Bot> => {
          const { name, emoji, role } = await parseBotMetadata(botId);
          
          return {
            id: botId,
            name,
            emoji,
            role,
            status: 'idle',
            lastActive: new Date(0).toISOString(), // Epoch time for bots not yet in DB
            sessionCount: 0,
            workspacePath: `semo-system/bot-workspaces/${botId}`,
          };
        })
      );

      return NextResponse.json(bots);
    }

    // Enrich with GitHub data (name, emoji, role) if missing in DB
    const bots = await Promise.all(
      result.rows.map(async (row: BotStatusRow): Promise<Bot> => {
        try {
          // If DB has metadata, use it; otherwise fetch from GitHub
          let name = row.name || null;
          let emoji = row.emoji || null;
          let role = row.role || null;

          if (!name || !emoji || !role) {
            const metadata = await parseBotMetadata(row.bot_id);
            name = name || metadata.name;
            emoji = emoji || metadata.emoji;
            role = role || metadata.role;

            // Update DB with fetched metadata (optional, async)
            query(`
              UPDATE semo.bot_status
              SET name = $1, emoji = $2, role = $3
              WHERE bot_id = $4
            `, [name, emoji, role, row.bot_id]).catch(err => {
              console.warn(`Failed to update metadata for ${row.bot_id}:`, err);
            });
          }

          return {
            id: row.bot_id,
            name: name!,
            emoji: emoji!,
            role: role!,
            status: row.status,
            lastActive: row.last_active || new Date().toISOString(),
            sessionCount: row.session_count,
            workspacePath: row.workspace_path,
          };
        } catch (error) {
          console.error(`Error enriching bot ${row.bot_id}:`, error);
          return {
            id: row.bot_id,
            name: row.bot_id,
            emoji: '🤖',
            role: 'Bot',
            status: 'error',
            lastActive: new Date().toISOString(),
            sessionCount: 0,
            workspacePath: row.workspace_path,
          };
        }
      })
    );

    return NextResponse.json(bots);
  } catch (error) {
    console.error('Error fetching bots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bots' },
      { status: 500 }
    );
  }
}
