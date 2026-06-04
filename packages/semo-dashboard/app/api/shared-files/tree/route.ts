import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { FileTreeEntry } from '@/types';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subpath = searchParams.get('path') || '';

    if (subpath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const prefix = subpath ? `${subpath}/` : '';
    const result = await query<{ file_path: string; file_size: number }>(
      `SELECT file_path, file_size FROM ${DB_SCHEMA}.bot_workspace_files
       WHERE bot_id = '_shared' AND file_path LIKE $1`,
      [`${prefix}%`],
    );

    if (result.rows.length === 0) {
      return NextResponse.json([]);
    }

    const immediateEntries = new Map<string, { type: 'file' | 'directory'; size?: number }>();

    for (const row of result.rows) {
      const relative = subpath ? row.file_path.slice(prefix.length) : row.file_path;
      const parts = relative.split('/');

      if (parts.length === 1) {
        if (!parts[0].startsWith('.')) {
          immediateEntries.set(parts[0], { type: 'file', size: row.file_size });
        }
      } else if (parts.length > 1) {
        if (!parts[0].startsWith('.')) {
          immediateEntries.set(parts[0], { type: 'directory' });
        }
      }
    }

    const entries: FileTreeEntry[] = Array.from(immediateEntries.entries()).map(([name, info]) => ({
      name,
      path: subpath ? `${subpath}/${name}` : name,
      type: info.type,
      size: info.size,
    }));

    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error listing shared files:', error);
    return NextResponse.json({ error: 'Failed to list shared files' }, { status: 500 });
  }
}
