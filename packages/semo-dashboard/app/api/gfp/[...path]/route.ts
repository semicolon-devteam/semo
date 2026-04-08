import { NextRequest, NextResponse } from 'next/server';

// Legacy redirect: /api/gfp/* → /api/projects/*
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = req.nextUrl.clone();
  url.pathname = `/api/projects/${path.join('/')}`;
  return NextResponse.redirect(url, 307);
}

export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
