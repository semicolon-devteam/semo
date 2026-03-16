/**
 * @file app/api/bots/[botId]/files/route.ts
 * @description 봇 워크스페이스 루트 디렉토리 목록 API.
 *   GitHub API를 통해 해당 봇의 워크스페이스 최상위 파일/디렉토리를 반환한다.
 *
 * @api GET /api/bots/:botId/files
 * @apiSuccess {object} 200 - { type: 'dir', items: GitHubFileEntry[] }
 * @apiError {object} 400 - { error: 'Invalid bot ID' } 봇 ID에 허용되지 않은 문자 포함 시
 * @apiError {object} 404 - { error: 'Bot workspace not found' } 워크스페이스 없을 시
 * @apiError {object} 500 - { error: string } GitHub API 오류 시
 */

import { NextResponse } from 'next/server';
import { getContents } from '@/lib/github';
import { getBotWorkspacePath } from '@/lib/constants';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;

    if (!/^[a-zA-Z0-9_-]+$/.test(botId)) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }

    const basePath = getBotWorkspacePath(botId);
    const result = await getContents(basePath);

    if (result.kind !== 'dir') {
      return NextResponse.json({ error: 'Expected directory at workspace root' }, { status: 500 });
    }

    const prefix = basePath + '/';
    const items = result.items.map(item => ({
      ...item,
      path: item.path.startsWith(prefix) ? item.path.slice(prefix.length) : item.path,
    }));

    return NextResponse.json({ type: 'dir', items });
  } catch (error) {
    console.error('Error listing root files:', error);

    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Bot workspace not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
