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
          Org Chart
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Bot team delegation structure — {data.nodes.length} bots, {data.edges.length} delegation flows
        </p>
      </div>

      <OrgChart data={data} />
    </div>
  );
}
