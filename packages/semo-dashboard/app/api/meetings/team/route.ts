import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface TeamMember {
  domain: string;   // KB domain e.g. "reus"
  name: string;     // e.g. "전준영 (Reus)"
  role: string;     // e.g. "프론트 리드/팀 리더"
}

/**
 * Parse KB team content first line: "전준영 (Reus). 프론트 리드/팀 리더. ..."
 * Returns { name, role }
 */
function parseTeamContent(content: string): { name: string; role: string } {
  const firstLine = content.split('\n')[0].trim();
  // Split by ". " to get name and role parts
  const parts = firstLine.split('. ');
  const name = parts[0] || 'Unknown';
  const role = parts[1] || '';
  return { name, role };
}

/** GET /api/meetings/team — fetch team members from KB */
export async function GET() {
  try {
    const result = await query<{ sub_key: string; content: string }>(
      `SELECT sub_key, content FROM semo.knowledge_base
       WHERE domain = 'semicolon' AND key = 'team' AND sub_key != ''
       ORDER BY sub_key`,
    );

    const members: TeamMember[] = result.rows
      .filter((row) => {
        // Filter out non-person entries (e.g. "bot-ids" which starts with "#")
        const firstLine = row.content.split('\n')[0].trim();
        return !firstLine.startsWith('#') && !firstLine.startsWith('|');
      })
      .map((row) => {
        const { name, role } = parseTeamContent(row.content);
        return { domain: row.sub_key, name, role };
      });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}
