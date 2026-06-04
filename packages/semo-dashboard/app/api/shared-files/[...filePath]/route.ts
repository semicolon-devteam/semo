import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

export const dynamic = 'force-dynamic';

const SHARED_DIR = path.join(os.homedir(), '.semo', 'shared');

function resolveAndValidate(filePath: string): string | null {
  const resolved = path.resolve(SHARED_DIR, filePath);
  if (!resolved.startsWith(SHARED_DIR + path.sep) && resolved !== SHARED_DIR) {
    return null;
  }
  return resolved;
}

export async function GET(_req: Request, { params }: { params: Promise<{ filePath: string[] }> }) {
  try {
    const { filePath } = await params;
    const requestedPath = filePath.join('/');

    if (requestedPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // Try DB first
    try {
      const result = await query<{ content: string }>(
        `SELECT content FROM ${DB_SCHEMA}.bot_workspace_files WHERE bot_id = '_shared' AND file_path = $1`,
        [requestedPath],
      );
      if (result.rows.length > 0) {
        return NextResponse.json({ path: requestedPath, content: result.rows[0].content });
      }
    } catch {
      /* DB unavailable */
    }

    // Fallback: read from local filesystem
    const resolved = resolveAndValidate(requestedPath);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    return NextResponse.json({ path: requestedPath, content });
  } catch (error) {
    console.error('Error fetching shared file:', error);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ filePath: string[] }> }) {
  try {
    const { filePath } = await params;
    const requestedPath = filePath.join('/');

    if (requestedPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const resolved = resolveAndValidate(requestedPath);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const { content } = await req.json();
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Write to local filesystem
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, content, 'utf-8');

    // Update DB
    const fileHash = crypto.createHash('sha256').update(content).digest('hex');
    const fileSize = Buffer.byteLength(content, 'utf-8');
    try {
      await query(
        `INSERT INTO ${DB_SCHEMA}.bot_workspace_files (bot_id, file_path, content, file_size, file_hash, synced_at)
         VALUES ('_shared', $1, $2, $3, $4, NOW())
         ON CONFLICT (bot_id, file_path) DO UPDATE SET
           content = EXCLUDED.content,
           file_size = EXCLUDED.file_size,
           file_hash = EXCLUDED.file_hash,
           synced_at = NOW()`,
        [requestedPath, content, fileSize, fileHash],
      );
    } catch {
      /* DB update best-effort */
    }

    return NextResponse.json({ path: requestedPath, updated: true });
  } catch (error) {
    console.error('Error updating shared file:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}
