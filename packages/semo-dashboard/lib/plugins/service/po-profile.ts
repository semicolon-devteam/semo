import type { PoProfile } from '@/types';

export const DEFAULT_PO_PROFILE: PoProfile = {
  tech_level: 'intermediate',
  design_sensitivity: 'medium',
  domain_area: 'product',
  interaction_style: 'detailed',
  decision_style: 'options',
};

export function getPoProfile(metadata: Record<string, unknown>): PoProfile {
  return (metadata?.po_profile as PoProfile) ?? DEFAULT_PO_PROFILE;
}

export function shouldShowCode(profile: PoProfile): boolean {
  return profile.tech_level === 'intermediate' || profile.tech_level === 'advanced';
}

export function shouldShowDesignDetail(profile: PoProfile): boolean {
  return profile.design_sensitivity !== 'low';
}

export function getDetailLevel(profile: PoProfile): 'minimal' | 'standard' | 'detailed' {
  if (profile.tech_level === 'non-technical') return 'minimal';
  if (profile.tech_level === 'advanced') return 'detailed';
  return 'standard';
}

/** 봇 dispatch 시 PO 프로파일 컨텍스트 문자열 생성 */
export function buildProfileContext(profile: PoProfile): string {
  const lines = [
    `PO 프로필: 기술=${profile.tech_level}, 디자인=${profile.design_sensitivity}, 분야=${profile.domain_area}, 상호작용=${profile.interaction_style}`,
  ];
  if (profile.tech_level === 'non-technical') {
    lines.push('→ 전문용어 최소화, 시각적 설명 우선, 코드 블록 최소화');
  } else if (profile.tech_level === 'advanced') {
    lines.push('→ 기술 상세 포함, 코드 예시 포함 가능, 아키텍처 레벨 커스텀 허용');
  }
  if (profile.decision_style === 'recommendation') {
    lines.push('→ 여러 옵션 대신 추천안 하나를 제시');
  }
  return lines.join('\n');
}
