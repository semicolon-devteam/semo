import { NextResponse } from 'next/server';
import { getFileContent } from '@/lib/github';
import path from 'path';

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
  
  // Additional check: reject paths containing '..' segments
  if (normalized.includes('..')) {
    throw new Error('Invalid path: ".." not allowed');
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
    const basePath = `semo-system/bot-workspaces/${botId}`;
    try {
      validatePath(basePath, requestedPath);
    } catch (error) {
      console.error('Path validation failed:', error);
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }
    
    // Construct full GitHub path
    const fullPath = `${basePath}/${requestedPath}`;
    
    // Fetch file content from GitHub
    const content = await getFileContent(fullPath);
    
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
