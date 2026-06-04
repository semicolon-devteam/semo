import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

function validateIds(botId: string, skillName: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(botId)) return 'Invalid bot ID';
  if (!/^[a-zA-Z0-9_-]+$/.test(skillName)) return 'Invalid skill name';
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string; skillName: string }> },
) {
  try {
    const { botId, skillName } = await params;
    const err = validateIds(botId, skillName);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    // Read SKILL.md from bot_workspace_files
    let content: string | null = null;

    // 1. bot_workspace_files
    if (content === null) {
      try {
        const wsResult = await query<{ content: string }>(
          `SELECT content FROM ${DB_SCHEMA}.bot_workspace_files
           WHERE bot_id = $1 AND file_path = $2`,
          [botId, `skills/${skillName}/SKILL.md`],
        );
        if (wsResult.rows.length > 0) {
          content = wsResult.rows[0].content;
        }
      } catch {
        // DB unavailable for workspace files
      }
    }

    // Read DB metadata
    let dbMeta = null;
    try {
      const fullName = `${botId}/${skillName}`;
      const result = await query(
        `SELECT name, is_active, category, package, metadata, updated_at
         FROM ${DB_SCHEMA}.skill_definitions
         WHERE name = $1 AND office_id IS NULL`,
        [fullName],
      );
      if (result.rows.length > 0) {
        dbMeta = result.rows[0];
      }
    } catch {
      // DB unavailable
    }

    if (content === null && !dbMeta) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: skillName,
      fullName: `${botId}/${skillName}`,
      content,
      dbMeta,
    });
  } catch (error) {
    console.error('Error fetching skill detail:', error);
    return NextResponse.json({ error: 'Failed to fetch skill' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string; skillName: string }> },
) {
  try {
    const { botId, skillName } = await params;
    const err = validateIds(botId, skillName);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const { content } = await req.json();
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Update bot_workspace_files if it exists
    try {
      await query(
        `UPDATE ${DB_SCHEMA}.bot_workspace_files SET content = $1, file_size = $2, synced_at = NOW()
         WHERE bot_id = $3 AND file_path = $4`,
        [content, Buffer.byteLength(content, 'utf-8'), botId, `skills/${skillName}/SKILL.md`],
      );
    } catch {
      // workspace DB write failed
    }

    // Update DB prompt in skill_definitions
    const fullName = `${botId}/${skillName}`;
    try {
      await query(
        `UPDATE ${DB_SCHEMA}.skill_definitions SET prompt = $1, updated_at = NOW()
         WHERE name = $2 AND office_id IS NULL`,
        [content, fullName],
      );
    } catch {
      // DB unavailable — workspace updated only
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error('Error updating skill:', error);
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string; skillName: string }> },
) {
  try {
    const { botId, skillName } = await params;
    const err = validateIds(botId, skillName);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const { isActive } = await req.json();
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive (boolean) is required' }, { status: 400 });
    }

    const fullName = `${botId}/${skillName}`;
    const result = await query(
      `UPDATE ${DB_SCHEMA}.skill_definitions SET is_active = $1, updated_at = NOW()
       WHERE name = $2 AND office_id IS NULL
       RETURNING name, is_active`,
      [isActive, fullName],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Skill not found in DB' }, { status: 404 });
    }

    return NextResponse.json({ updated: true, isActive });
  } catch (error) {
    console.error('Error patching skill:', error);
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 });
  }
}
