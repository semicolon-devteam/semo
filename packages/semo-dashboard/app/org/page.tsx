import { headers } from 'next/headers';
import OrgChart from '@/components/OrgChart';
import { PageBody, PageHeader } from '@/components/ui/semo';

export const dynamic = 'force-dynamic';

async function getOrgData() {
  // 자기 origin 으로 페치 — 하드코딩 :3000 폴백은 dev 포트/배포에서 깨짐.
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    const h = await headers();
    const host = h.get('host');
    const proto = h.get('x-forwarded-proto') || 'http';
    baseUrl = host ? `${proto}://${host}` : 'http://localhost:3000';
  }
  try {
    const response = await fetch(`${baseUrl}/api/org`, { cache: 'no-store' });
    if (!response.ok) return { nodes: [], edges: [] };
    return response.json();
  } catch {
    return { nodes: [], edges: [] };
  }
}

export default async function OrgPage() {
  const data = await getOrgData();

  return (
    <PageBody>
      <PageHeader
        title="조직도"
        sub={`봇 팀 위임 구조 — ${data.nodes.length}개 봇, ${data.edges.length}개 위임 흐름`}
      />
      <OrgChart data={data} />
    </PageBody>
  );
}
