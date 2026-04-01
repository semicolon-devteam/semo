import OrgChart from '@/components/OrgChart';

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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          조직도
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          봇 팀 위임 구조 — {data.nodes.length}개 봇, {data.edges.length}개 위임 흐름
        </p>
      </div>

      <OrgChart data={data} />
    </div>
  );
}
