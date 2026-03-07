import { NextResponse } from 'next/server';
import { getBotWorkspaces, getFileContent } from '@/lib/github';
import type { Bot } from '@/types';

export async function GET() {
  try {
    // Get list of bot workspaces
    const botIds = await getBotWorkspaces();
    
    // Fetch bot details for each workspace
    const bots = await Promise.all(
      botIds.map(async (botId): Promise<Bot> => {
        try {
          // Read IDENTITY.md and USER.md
          const [identity, user] = await Promise.all([
            getFileContent(`semo-system/bot-workspaces/${botId}/IDENTITY.md`).catch(() => ''),
            getFileContent(`semo-system/bot-workspaces/${botId}/USER.md`).catch(() => ''),
          ]);

          // Parse IDENTITY.md for name and emoji
          const nameMatch = identity.match(/Name:\*\*\s*(.+)/);
          const emojiMatch = identity.match(/Emoji:\*\*\s*(.+)/);
          
          const name = nameMatch ? nameMatch[1].trim() : botId;
          const emoji = emojiMatch ? emojiMatch[1].trim() : '🤖';

          // Parse USER.md for role (Notes section)
          const roleMatch = user.match(/- (.+)/);
          const role = roleMatch ? roleMatch[1].trim() : 'Bot';

          // TODO: Get session status from OpenClaw Gateway API
          // For now, return placeholder data
          return {
            id: botId,
            name,
            emoji,
            role,
            status: 'idle',
            lastActive: new Date().toISOString(),
            sessionCount: 0,
            workspacePath: `semo-system/bot-workspaces/${botId}`,
          };
        } catch (error) {
          console.error(`Error fetching bot ${botId}:`, error);
          return {
            id: botId,
            name: botId,
            emoji: '🤖',
            role: 'Bot',
            status: 'error',
            lastActive: new Date().toISOString(),
            sessionCount: 0,
            workspacePath: `semo-system/bot-workspaces/${botId}`,
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
