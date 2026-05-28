/**
 * Persona Pack 레지스트리 (기획 §3.1, P0.2).
 * 정본 = packages/semo-dashboard/personas/*.json (코드 저장소 버전관리).
 * 서버·클라이언트 양쪽 import 가능(순수 데이터 + 스키마, pg/server-only 의존 없음).
 */
import shopPack from '@/personas/shop.json';
import personalPack from '@/personas/personal.json';
import workerPack from '@/personas/worker.json';
import {
  type PersonaPack,
  type PersonaId,
  PERSONA_IDS,
  DEFAULT_PERSONA_ID,
  validatePersonaPack,
} from './schema';

const PACKS: Record<PersonaId, PersonaPack> = {
  shop: shopPack as unknown as PersonaPack,
  personal: personalPack as unknown as PersonaPack,
  worker: workerPack as unknown as PersonaPack,
};

export function getPersonaPack(id: PersonaId): PersonaPack {
  return PACKS[id] ?? PACKS[DEFAULT_PERSONA_ID];
}

export interface PersonaMeta {
  id: PersonaId;
  label: string;
  longLabel?: string;
  icon?: string;
}

export function listPersonaMeta(): PersonaMeta[] {
  return PERSONA_IDS.map((id) => {
    const p = PACKS[id];
    return { id, label: p.label, longLabel: p.longLabel, icon: p.icon };
  });
}

/** 로드 시점 정합성 점검(개발/테스트용). 잘못된 팩이 있으면 errors 반환. */
export function validateAllPacks() {
  return PERSONA_IDS.map((id) => ({ id, ...validatePersonaPack(PACKS[id]) }));
}
