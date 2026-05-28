import { NextResponse } from 'next/server';
import { getInstalledAgents } from '@/lib/customer/data';

/** 테넌트가 채용한 직원 목록 (현재 데모 테넌트 고정). */
export async function GET() {
  const agents = await getInstalledAgents();
  return NextResponse.json({ agents });
}
