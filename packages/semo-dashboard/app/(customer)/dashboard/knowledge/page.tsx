import { ScreenKnowledge } from '../../_ui/screen-knowledge';
import { requireOwnedTenantSlug, getKnowledgeGraph } from '@/lib/customer/data';

// 실 지식 그래프를 매 요청 반영 (정적 프리렌더 고정 방지).
export const dynamic = 'force-dynamic';

/** 서버에서 테넌트 활동 기반 지식 그래프를 페치해 주입. 비면 화면이 mock SVG 폴백. */
export default async function MyKnowledgePage() {
  const tenant = await requireOwnedTenantSlug();
  const graph = await getKnowledgeGraph(tenant);
  return <ScreenKnowledge mode="2d" graph={graph} />;
}
