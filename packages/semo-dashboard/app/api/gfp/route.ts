import { NextRequest, NextResponse } from 'next/server';

// Legacy redirect: /api/gfp → /api/projects
export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/api/projects';
  return NextResponse.redirect(url, 307);
}

export const POST = GET;
