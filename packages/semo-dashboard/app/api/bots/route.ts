import { NextResponse } from 'next/server';
import { getFileContent, getBotWorkspaces } from '@/lib/github';
import { query } from '@/lib/db';
import type { Bot } from '@/types';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

// Force dynamic rendering to prevent build-time DB connection
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
  synced_at: string;
}

function parseIdentityContent(content: string, botId: string): { name: string; emoji: string; role: string } {
  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(\S+)/);
  const roleMatch = content.match(/\*\*(?:Creature|Role|직책):\*\*\s*(.+)/);

  return {
    name: nameMatch ? nameMatch[1].trim() : botId,
    emoji: emojiMatch ? emojiMatch[1].trim() : '🤖',
    role: roleMatch ? roleMatch[1].trim() : 'Bot',
  };
}

async function parseBotMetadata(botId: string): Promise<{ name: string; emoji: string; role: string }> {
  try {
    const identity = await getFileContent(`semo-system/bot-workspaces/${botId}/IDENTITY.md`).catch(() => '');
    return parseIdentityContent(identity, botId);
  } catch (error) {
    console.error(`Error parsing bot metadata for ${botId}:`, error);
    return { name: botId, emoji: '🤖', role: 'Bot' };
  }
}

async function fallbackToLocal(): Promise<Bot[]> {
  // Resolve bot-workspaces relative to project root
  const workspacesDir = path.resolve(process.cwd(), '../../semo-system/bot-workspaces');
  const entries = await readdir(workspacesDir, { withFileTypes: true });
  const botIds = entries.filter(e => e.isDirectory()).map(e => e.name);

  return Promise.all(
    botIds.map(async (botId): Promise<Bot> => {
      let identity = '';
      try {
        identity = await readFile(path.join(workspacesDir, botId, 'IDENTITY.md'), 'utf-8');
      } catch { /* no IDENTITY.md */ }
      const { name, emoji, role } = parseIdentityContent(identity, botId);
      return {
        id: botId,
        name,
        emoji,
        role,
        status: 'offline',
        lastActive: new Date(0).toISOString(),
        sessionCount: 0,
        workspacePath: `semo-system/bot-workspaces/${botId}`,
      };
    })
  );
}

async function fallbackToGitHub(): Promise<Bot[]> {
  try {
    const botIds = await getBotWorkspaces();
    return Promise.all(
      botIds.map(async (botId): Promise<Bot> => {
        const { name, emoji, role } = await parseBotMetadata(botId);
        return {
          id: botId,
          name,
          emoji,
          role,
          status: 'offline',
          lastActive: new Date(0).toISOString(),
          sessionCount: 0,
          workspacePath: `semo-system/bot-workspaces/${botId}`,
        };
      })
    );
  } catch (githubError) {
    console.warn('GitHub API unavailable, falling back to local filesystem:', (githubError as Error).message);
    return fallbackToLocal();
  }
}

export async function GET() {
  try {
    // Query bot status from PostgreSQL
    let result;
    try {
      result = await query<BotStatusRow>(`
        SELECT bot_id, name, emoji, role, last_active, session_count, workspace_path, status, synced_at
        FROM semo.bot_status
        ORDER BY bot_id
      `);
    } catch (dbError) {
      console.warn('DB unavailable, falling back to GitHub:', (dbError as Error).message);
      return NextResponse.json(await fallbackToGitHub());
    }

    // If DB is empty, fallback to GitHub
    if (result.rows.length === 0) {
      console.log('DB empty, falling back to GitHub...');
      return NextResponse.json(await fallbackToGitHub());
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
            status: 'offline',
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
