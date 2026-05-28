import { ScreenKnowledge } from '../../_ui/screen-knowledge';
import { DEMO_TENANT, getKnowledgeGraph } from '@/lib/customer/data';

export const dynamic = 'force-dynamic';

/** 공개 데모 — 지식 그래프(데모 테넌트 고정). */
export default async function DemoKnowledgePage() {
  const graph = await getKnowledgeGraph(DEMO_TENANT);
  return <ScreenKnowledge mode="2d" graph={graph} />;
}
