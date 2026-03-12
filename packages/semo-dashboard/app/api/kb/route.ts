import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { KBEntry } from '@/types';

// Force dynamic rendering to prevent build-time DB connection
export const dynamic = 'force-dynamic';

interface KBEntryRow {
  id: string;
  title: string;
  content: string;
  bot_id: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const botId = searchParams.get('bot_id') || '';
    const category = searchParams.get('category') || '';
    const tag = searchParams.get('tag') || '';

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (botId) {
      conditions.push(`bot_id = $${paramIndex}`);
      params.push(botId);
      paramIndex++;
    }
    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    if (tag) {
      conditions.push(`$${paramIndex} = ANY(tags)`);
      params.push(tag);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query<KBEntryRow>(`
      SELECT id, title, content, bot_id, category, tags, created_at, updated_at
      FROM kb.entries
      ${where}
      ORDER BY updated_at DESC
    `, params);

    const entries: KBEntry[] = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      bot_id: row.bot_id,
      category: row.category,
      tags: row.tags || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching KB entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KB entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, bot_id, category, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400 }
      );
    }

    const result = await query<KBEntryRow>(`
      INSERT INTO kb.entries (title, content, bot_id, category, tags)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, content, bot_id, category, tags, created_at, updated_at
    `, [title, content, bot_id || '', category || '', tags || []]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating KB entry:', error);
    return NextResponse.json(
      { error: 'Failed to create KB entry' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, content, bot_id, category, tags } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const result = await query<KBEntryRow>(`
      UPDATE kb.entries
      SET title = $1, content = $2, bot_id = $3, category = $4, tags = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING id, title, content, bot_id, category, tags, created_at, updated_at
    `, [title, content, bot_id || '', category || '', tags || [], id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'KB entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating KB entry:', error);
    return NextResponse.json(
      { error: 'Failed to update KB entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const result = await query(`
      DELETE FROM kb.entries WHERE id = $1 RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'KB entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting KB entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete KB entry' },
      { status: 500 }
    );
  }
}
