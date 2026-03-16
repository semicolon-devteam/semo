/**
 * @file app/api/bots/route.ts
 * @description 전체 봇 목록 API. semo.bot_status 테이블을 primary source로 사용하며,
 *   DB가 비어 있으면 GitHub bot-workspaces 디렉토리로 폴백한다.
 *
 * @api GET /api/bots
 * @apiSuccess {Bot[]} 200 - 봇 배열 (id, name, emoji, role, status, lastActive, sessionCount, workspacePath)
 * @apiError {object} 500 - { error: string } DB 연결 실패 또는 GitHub API 한도 초과 시
 */

import { NextResponse } from 'next/server';
import { getFileContent, getBotWorkspaces } from '@/lib/github';
import { query } from '@/lib/db';
import type { Bot } from '@/types';

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

/**
 * GitHub IDENTITY.md에서 봇 메타데이터(name, emoji, role)를 파싱한다.
 *
 * @param botId - 봇 식별자
 * @returns 파싱된 메타데이터 (파일 없거나 파싱 실패 시 기본값 반환)
 */
async function parseBotMetadata(botId: string): Promise<{ name: string; emoji: string; role: string }> {
  try {
    const identity = await getFileContent(`semo-system/bot-workspaces/${botId}/IDENTITY.md`).catch(() => '');

    const nameMatch = identity.match(/\*\*Name:\*\*\s*(.+)/);
    const emojiMatch = identity.match(/\*\*Emoji:\*\*\s*(\S+)/);
    const roleMatch = identity.match(/\*\*(?:Creature|Role|직책):\*\*\s*(.+)/);

    return {
      name: nameMatch ? nameMatch[1].trim() : botId,
      emoji: emojiMatch ? emojiMatch[1].trim() : '🤖',
      role: roleMatch ? roleMatch[1].trim() : 'Bot',
    };
  } catch (error) {
    // GitHub API 오류(토큰 만료, 레포 접근 불가 등) 시 기본값으로 폴백
    console.error(`Error parsing bot metadata for ${botId}:`, error);
    return { name: botId, emoji: '🤖', role: 'Bot' };
  }
}

export async function GET() {
  try {
    // Query bot status from PostgreSQL
    const result = await query<BotStatusRow>(`
      SELECT bs.bot_id, bs.name, bs.emoji, bs.role, bs.last_active,
             COALESCE(s.cnt, 0)::int AS session_count,
             bs.workspace_path, bs.status, bs.synced_at
      FROM semo.bot_status bs
      LEFT JOIN (
        SELECT bot_id, COUNT(*) AS cnt FROM semo.bot_sessions GROUP BY bot_id
      ) s ON s.bot_id = bs.bot_id
      ORDER BY bs.bot_id
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
            status: 'offline',
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
          // 개별 봇 처리 실패 시 기본값으로 폴백 (전체 응답 실패 방지)
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
    // DB 연결 실패(DATABASE_URL 미설정) 또는 GitHub API 한도 초과 시
    console.error('Error fetching bots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bots' },
      { status: 500 }
    );
  }
}
