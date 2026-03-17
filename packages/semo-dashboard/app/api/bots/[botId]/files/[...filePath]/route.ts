import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { getFileContent, getFileMeta, updateFileContent } from '@/lib/github';
import { getBotWorkspacePath } from '@/lib/constants';
import path from 'path';

const WORKSPACES_DIR = path.resolve(process.cwd(), '../../semo-system/bot-workspaces');

/**
 * Safe path validation to prevent path traversal attacks
 * @param basePath Base path (bot workspace root)
 * @param userPath User-provided path
 * @returns Validated safe path
 */
function validatePath(basePath: string, userPath: string): string {
  // Normalize and resolve the path
  const normalized = path.normalize(userPath);
  const resolved = path.join(basePath, normalized);
  
  // Check if resolved path starts with base path (prevents ../ traversal)
  if (!resolved.startsWith(basePath)) {
    throw new Error('Invalid path: Path traversal detected');
  }
  
  return resolved;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string; filePath: string[] }> }
) {
  try {
    const { botId, filePath } = await params;
    
    // Validate botId (alphanumeric + dash/underscore only)
    if (!/^[a-zA-Z0-9_-]+$/.test(botId)) {
      return NextResponse.json(
        { error: 'Invalid bot ID' },
        { status: 400 }
      );
    }
    
    // Join file path segments
    const requestedPath = filePath.join('/');
    
    // Validate path (prevent path traversal)
    const basePath = getBotWorkspacePath(botId);
    try {
      validatePath(basePath, requestedPath);
    } catch (error) {
      console.error('Path validation failed:', error);
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }
    
    // Try local filesystem first, fallback to GitHub API
    const localPath = path.join(WORKSPACES_DIR, botId, requestedPath);
    // Validate local path to prevent traversal
    if (!localPath.startsWith(path.join(WORKSPACES_DIR, botId))) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    let content: string;
    try {
      content = await readFile(localPath, 'utf-8');
    } catch {
      // Fallback to GitHub API
      const fullPath = `${basePath}/${requestedPath}`;
      content = await getFileContent(fullPath);
    }

    return NextResponse.json({
      path: requestedPath,
      content,
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    
    // Check if it's a 404 (file not found)
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch file' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string; filePath: string[] }> }
) {
  try {
    const { botId, filePath } = await params;

    if (!/^[a-zA-Z0-9_-]+$/.test(botId)) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }

    const requestedPath = filePath.join('/');
    const basePath = getBotWorkspacePath(botId);

    try {
      validatePath(basePath, requestedPath);
    } catch {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const { content, message } = await req.json();
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const fullPath = `${basePath}/${requestedPath}`;

    // Get current file SHA for GitHub update
    const meta = await getFileMeta(fullPath);
    await updateFileContent(fullPath, content, meta.sha, message);

    return NextResponse.json({ path: requestedPath, updated: true });
  } catch (error) {
    console.error('Error updating file:', error);

    if (error instanceof Error && error.message.includes('409')) {
      return NextResponse.json(
        { error: 'Conflict: file was modified. Refresh and try again.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    );
  }
}
