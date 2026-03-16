/**
 * @file app/api/bots/[botId]/route.ts
 * @description 특정 봇 단건 조회 API. DB에서 기본 정보를 가져오고,
 *   name/emoji/role이 비어 있으면 GitHub IDENTITY.md로 보완한다.
 *
 * @api GET /api/bots/:botId
 * @apiSuccess {Bot & { syncedAt: string }} 200 - 봇 정보 (syncedAt 포함)
 * @apiError {object} 404 - { error: 'Bot not found' }
 * @apiError {object} 500 - { error: string } DB 연결 실패 시
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getFileContent } from '@/lib/github';

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;

    const result = await query<BotStatusRow>(
      `SELECT bot_id, name, emoji, role, last_active, session_count, workspace_path, status, synced_at
       FROM semo.bot_status
       WHERE bot_id = $1`,
      [botId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const row = result.rows[0];

    // Fill missing metadata from GitHub IDENTITY.md if needed
    let name = row.name;
    let emoji = row.emoji;
    let role = row.role;

    if (!name || !emoji || !role) {
      const identity = await getFileContent(
        `semo-system/bot-workspaces/${botId}/IDENTITY.md`
      ).catch(() => '');
      const nameMatch = identity.match(/\*\*Name:\*\*\s*(.+)/);
      const emojiMatch = identity.match(/\*\*Emoji:\*\*\s*(\S+)/);
      const roleMatch = identity.match(/\*\*(?:Creature|Role|직책):\*\*\s*(.+)/);
      name = name || (nameMatch ? nameMatch[1].trim() : botId);
      emoji = emoji || (emojiMatch ? emojiMatch[1].trim() : '🤖');
      role = role || (roleMatch ? roleMatch[1].trim() : 'Bot');
    }

    return NextResponse.json({
      id: row.bot_id,
      name,
      emoji,
      role,
      status: row.status,
      lastActive: row.last_active || new Date().toISOString(),
      sessionCount: row.session_count,
      workspacePath: row.workspace_path,
      syncedAt: row.synced_at,
    });
  } catch (error) {
    console.error('Error fetching bot:', error);
    return NextResponse.json({ error: 'Failed to fetch bot' }, { status: 500 });
  }
}
