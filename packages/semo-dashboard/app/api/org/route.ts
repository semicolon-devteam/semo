import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

interface BotNode {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'online' | 'offline';
  lastActive: string | null;
  sessionCount: number;
}

interface DelegationEdge {
  from: string;
  to: string;
  type: string;
  domains: string[];
  method: string;
  priority: string;
}

export async function GET() {
  try {
    // 봇 노드
    const botsResult = await query<{
      bot_id: string;
      name: string | null;
      emoji: string | null;
      role: string | null;
      status: string | null;
      last_active: string | null;
      session_count: number;
    }>(`
      SELECT bot_id, name, emoji, role, status, last_active, session_count
      FROM ${DB_SCHEMA}.bot_status
      WHERE status != 'retired'
      ORDER BY bot_id
    `);

    const nodes: BotNode[] = botsResult.rows.map((row) => ({
      id: row.bot_id,
      name: row.name || row.bot_id,
      emoji: row.emoji || '🤖',
      role: row.role || 'Bot',
      status: (row.status === 'online' ? 'online' : 'offline') as 'online' | 'offline',
      lastActive: row.last_active,
      sessionCount: row.session_count || 0,
    }));

    // 위임 엣지
    const delegationsResult = await query<{
      from_bot_id: string;
      to_bot_id: string;
      delegation_type: string;
      domains: string[];
      method: string;
      priority: string;
    }>(`
      SELECT from_bot_id, to_bot_id, delegation_type, domains, method, priority
      FROM ${DB_SCHEMA}.bot_delegation
      WHERE is_active = true
      ORDER BY from_bot_id, to_bot_id
    `);

    const edges: DelegationEdge[] = delegationsResult.rows.map((row) => ({
      from: row.from_bot_id,
      to: row.to_bot_id,
      type: row.delegation_type,
      domains: row.domains || [],
      method: row.method,
      priority: row.priority,
    }));

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    console.error('Org chart API error:', error);
    return NextResponse.json({ nodes: [], edges: [] }, { status: 500 });
  }
}
