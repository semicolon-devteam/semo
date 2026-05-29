import OrgChart from '@/components/OrgChart';
import { PageBody, PageHeader } from '@/components/ui/semo';

export const dynamic = 'force-dynamic';

async function getOrgData() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/org`, { cache: 'no-store' });
  if (!response.ok) return { nodes: [], edges: [] };
  return response.json();
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
