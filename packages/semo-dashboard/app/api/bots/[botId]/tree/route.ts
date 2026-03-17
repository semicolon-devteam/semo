import { NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { getBotFiles } from '@/lib/github';
import type { FileTreeEntry } from '@/types';

const WORKSPACES_DIR = path.resolve(process.cwd(), '../../semo-system/bot-workspaces');

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;

    if (!/^[a-zA-Z0-9_-]+$/.test(botId)) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const subpath = searchParams.get('path') || '';

    // Validate path to prevent traversal
    const botDir = path.join(WORKSPACES_DIR, botId);
    const targetDir = path.join(botDir, path.normalize(subpath));
    if (!targetDir.startsWith(botDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    let entries: FileTreeEntry[] = [];

    // Try local filesystem first
    try {
      const dirEntries = await readdir(targetDir, { withFileTypes: true });
      entries = await Promise.all(
        dirEntries
          .filter(e => !e.name.startsWith('.'))
          .map(async (e) => {
            const entryPath = subpath ? `${subpath}/${e.name}` : e.name;
            const entry: FileTreeEntry = {
              name: e.name,
              path: entryPath,
              type: e.isDirectory() ? 'directory' : 'file',
            };
            if (!e.isDirectory()) {
              try {
                const s = await stat(path.join(targetDir, e.name));
                entry.size = s.size;
              } catch { /* ignore */ }
            }
            return entry;
          })
      );
    } catch {
      // Fallback to GitHub API
      try {
        const ghFiles = await getBotFiles(botId, subpath);
        entries = ghFiles.map(f => ({
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
