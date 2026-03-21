import { NextResponse } from 'next/server';
import { getFileContent, getFileMeta, updateFileContent } from '@/lib/github';
import { getBotWorkspacePath } from '@/lib/constants';
import { query } from '@/lib/db';

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

    // Validate: no path traversal
    if (requestedPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // Try DB first, fallback to GitHub API
    let content: string;
    try {
      const result = await query<{ content: string }>(
        `SELECT content FROM semo.bot_workspace_files WHERE bot_id = $1 AND file_path = $2`,
        [botId, requestedPath]
      );
      if (result.rows.length > 0) {
        content = result.rows[0].content;
      } else {
        // Fallback to GitHub API
        const basePath = getBotWorkspacePath(botId);
        content = await getFileContent(`${basePath}/${requestedPath}`);
      }
    } catch {
      // DB unavailable, fallback to GitHub
      const basePath = getBotWorkspacePath(botId);
      content = await getFileContent(`${basePath}/${requestedPath}`);
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
    if (requestedPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const { content, message } = await req.json();
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const basePath = getBotWorkspacePath(botId);
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
