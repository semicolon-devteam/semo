import { NextResponse } from 'next/server';
import { getBotFiles } from '@/lib/github';
import { query } from '@/lib/db';
import type { FileTreeEntry } from '@/types';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;

    if (!/^[a-zA-Z0-9_-]+$/.test(botId)) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const subpath = searchParams.get('path') || '';

    // Validate path to prevent traversal
    if (subpath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    let entries: FileTreeEntry[] = [];

    // Try DB first
    try {
      const prefix = subpath ? `${subpath}/` : '';
      const result = await query<{ file_path: string; file_size: number }>(
        `SELECT file_path, file_size FROM ${DB_SCHEMA}.bot_workspace_files
         WHERE bot_id = $1 AND file_path LIKE $2`,
        [botId, `${prefix}%`],
      );

      if (result.rows.length > 0) {
        // Build tree entries from flat file paths
        const immediateEntries = new Map<string, { type: 'file' | 'directory'; size?: number }>();

        for (const row of result.rows) {
          // Get the part after prefix
          const relative = subpath ? row.file_path.slice(prefix.length) : row.file_path;
          const parts = relative.split('/');

          if (parts.length === 1) {
            // Direct child file
            if (!parts[0].startsWith('.')) {
              immediateEntries.set(parts[0], { type: 'file', size: row.file_size });
            }
          } else if (parts.length > 1) {
            // Directory (first segment)
            if (!parts[0].startsWith('.')) {
              immediateEntries.set(parts[0], { type: 'directory' });
            }
          }
        }

        entries = Array.from(immediateEntries.entries()).map(([name, info]) => ({
          name,
          path: subpath ? `${subpath}/${name}` : name,
          type: info.type,
          size: info.size,
        }));
      } else {
        // No DB data, fallback to GitHub
        throw new Error('No data in DB');
      }
    } catch {
      // Fallback to GitHub API
      try {
        const ghFiles = await getBotFiles(botId, subpath);
        entries = ghFiles.map((f) => ({
          name: f.name,
          path: subpath ? `${subpath}/${f.name}` : f.name,
          type: f.type === 'dir' ? 'directory' : 'file',
          size: f.type === 'file' ? f.size : undefined,
        }));
      } catch {
        return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
      }
    }

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error listing directory:', error);
    return NextResponse.json({ error: 'Failed to list directory' }, { status: 500 });
  }
}
