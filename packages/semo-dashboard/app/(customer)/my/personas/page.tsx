import PersonaSwitcher from '../../_ui/PersonaSwitcher';
import { resolvePersonaId } from '@/lib/customer/persona/resolve';

/**
 * Persona Pack 미리보기 (새 디자인 handoff#2). 한 제품, 멀티 페르소나 —
 * 같은 레이아웃에 소상공인/개인/직장인 팩이 다른 콘텐츠로 렌더된다.
 *
 * 서버에서 persona 를 resolve(기획 §2.1: URL ?p= → 설정 → fallback shop)한 뒤 클라
 * 스위처에 초기값 주입. SoT = personas/*.json (registry). 예: /my/personas?p=worker
 *
 * ⚠️ SEMO Renewel 이 동시 편집 중인 기존 /my·screen-* 은 미접촉. persona 는 신규
 * 레이어(lib/customer/persona/*, _ui/personas·screen-persona·PersonaSwitcher)로만 추가.
 * 실데이터 결선·온보딩·audience_tags 는 docs/plans/2026-05-28-persona-pack-plan.md (Hermes) 참조.
 */
export default async function MyPersonasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initial = await resolvePersonaId(sp);
  return <PersonaSwitcher initial={initial} />;
}
