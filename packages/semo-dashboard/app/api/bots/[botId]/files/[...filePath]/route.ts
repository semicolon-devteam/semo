import { NextResponse } from 'next/server';
import { getContents, updateFileContent } from '@/lib/github';
import { getBotWorkspacePath } from '@/lib/constants';
import path from 'path';

function validatePath(basePath: string, userPath: string): string {
  const normalized = path.normalize(userPath);
  const resolved = path.join(basePath, normalized);

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

    if (!/^[a-zA-Z0-9_-]+$/.test(botId)) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }

    const requestedPath = filePath.join('/');
    const basePath = getBotWorkspacePath(botId);

    try {
      validatePath(basePath, requestedPath);
    } catch (error) {
      console.error('Path validation failed:', error);
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const fullPath = `${basePath}/${requestedPath}`;
    const result = await getContents(fullPath);

    if (result.kind === 'dir') {
      const prefix = basePath + '/';
      const items = result.items.map(item => ({
        ...item,
        path: item.path.startsWith(prefix) ? item.path.slice(prefix.length) : item.path,
      }));
      return NextResponse.json({ type: 'dir', items });
    }

    if (result.size > 1_000_000) {
      return NextResponse.json({
        type: 'file',
        path: requestedPath,
        sha: result.sha,
        content: null,
        error: 'File too large (>1MB)',
      });
    }

    return NextResponse.json({
      type: 'file',
      path: requestedPath,
      sha: result.sha,
      content: result.content,
    });
  } catch (error) {
    console.error('Error fetching file:', error);

    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
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

    const { content, sha, message } = await req.json();

    if (!content || !sha) {
      return NextResponse.json({ error: 'content and sha are required' }, { status: 400 });
    }

    const fullPath = `${basePath}/${requestedPath}`;
    const fileName = requestedPath.split('/').pop() ?? requestedPath;
    const commitMessage = message ?? `[semo dashboard] update ${fileName}`;

    await updateFileContent(fullPath, content, sha, commitMessage);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}
