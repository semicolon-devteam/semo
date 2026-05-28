/**
 * Persona 표현(viewmodel) 레이어 — 실데이터와 분리.
 *
 * 핵심 원칙(디자인 요청 결론): persona 는 **카피/라벨/추천**만 좌우하고, 실제 대시보드
 * 데이터(agent_installs/agent_activity/billing)는 그대로 둔다. 이 모듈은 persona pack에서
 * "표현용 문구"만 뽑아 viewmodel 로 만든다. 화면은 (실데이터 + 이 viewmodel)을 받아 렌더한다.
 *
 * pure(서버/클라 공용, pg 의존 없음). SoT = personas/*.json (registry).
 */
import { getPersonaPack } from './registry';
import type { PersonaId } from './schema';

export interface PersonaHomeCopy {
  eyebrow?: string;
  greetingTitle?: string;
  greetingSubtitle?: string;
  feedTitle?: string;
  nudgeTitle?: string;
  workingTitle?: string;
  weekKB?: string;
  planLabel?: string;
}

export interface PersonaViewModel {
  id: PersonaId;
  /** 모드 배지 라벨 (예: "소상공인 모드"). */
  modeBadge: string;
  /** 소유자 호칭 (예: "사장님" / "님"). */
  ownerLabel: string;
  /** 워크스페이스 표시명 (사이드바). */
  workspaceName: string;
  /** Home 화면 카피(없는 건 화면이 자체 fallback). */
  home: PersonaHomeCopy;
  /** persona 가 추천하는 직원 slug 목록(library 추천/정렬용). 실 카탈로그는 별도. */
  recommendedAgents: string[];
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

export function getPersonaViewModel(id: PersonaId): PersonaViewModel {
  const pack = getPersonaPack(id);
  const home = (pack.home ?? {}) as Record<string, unknown>;
  const label = str(pack.label) ?? id;
  return {
    id: pack.id,
    modeBadge: `${label} 모드`,
    ownerLabel: str(pack.ownerLabel) ?? '사장님',
    workspaceName: str(pack.workspace?.name) ?? label,
    home: {
      eyebrow: str(home.eyebrow),
      greetingTitle: str(home.greetingTitle),
      greetingSubtitle: str(home.greetingSubtitle),
      feedTitle: str(home.feedTitle),
      nudgeTitle: str(home.nudgeTitle),
      workingTitle: str(home.workingTitle),
      weekKB: str(home.weekKB),
      planLabel: str(home.planLabel),
    },
    recommendedAgents: Array.isArray(pack.agents)
      ? pack.agents.map((a) => a.id).filter((s): s is string => typeof s === 'string')
      : [],
  };
}
