/**
 * Sandbox Personas — 가상 PO 페르소나 정의.
 * 다양한 SEMO 잠재 고객 유형을 대표.
 */

import type { SandboxPersona } from '@/types';

export const SANDBOX_PERSONAS: Record<string, SandboxPersona> = {
  'cafe-owner': {
    id: 'cafe-owner',
    name: '민아 (카페 사장)',
    po_profile: {
      tech_level: 'non-technical',
      design_sensitivity: 'high',
      domain_area: 'business',
      interaction_style: 'concise',
      decision_style: 'recommendation',
    },
    domain_context:
      '소규모 카페 운영 10년차. 모바일 주문/결제 앱을 만들어서 대기 시간을 줄이고 싶음. 앱 개발 경험 전무.',
  },
  creator: {
    id: 'creator',
    name: '준혁 (유튜브 크리에이터)',
    po_profile: {
      tech_level: 'basic',
      design_sensitivity: 'medium',
      domain_area: 'product',
      interaction_style: 'detailed',
      decision_style: 'options',
    },
    domain_context:
      '구독자 5만 유튜버. 멀티 플랫폼 수익 분석, 콘텐츠 캘린더, 협찬 관리 대시보드가 필요. 스프레드시트로 관리하다 한계 느낌.',
  },
  'local-biz': {
    id: 'local-biz',
    name: '영수 (배달 사업자)',
    po_profile: {
      tech_level: 'non-technical',
      design_sensitivity: 'low',
      domain_area: 'business',
      interaction_style: 'concise',
      decision_style: 'recommendation',
    },
    domain_context:
      '동네 배달 서비스 운영 3년차. 전화/카톡 주문을 앱으로 전환하고, 배달기사 배차/추적 시스템이 필요. 기능보다 안정성 중시.',
  },
  'office-manager': {
    id: 'office-manager',
    name: '하은 (스타트업 운영팀장)',
    po_profile: {
      tech_level: 'basic',
      design_sensitivity: 'medium',
      domain_area: 'business',
      interaction_style: 'detailed',
      decision_style: 'options',
    },
    domain_context:
      '30인 스타트업 운영팀장. 채용/온보딩/장비관리/비품 발주를 하나의 사내 시스템으로 통합하고 싶음. 현재 노션+슬랙+구글시트 혼용.',
  },
  'vet-clinic': {
    id: 'vet-clinic',
    name: '지훈 (동물병원 원장)',
    po_profile: {
      tech_level: 'intermediate',
      design_sensitivity: 'medium',
      domain_area: 'product',
      interaction_style: 'detailed',
      decision_style: 'options',
    },
    domain_context:
      '소형 동물병원 원장. 예약/진료기록/보호자 알림 시스템이 필요. 기존 종이 차트에서 디지털 전환 원함. 개인정보 보호 중요.',
  },
};

export function getPersona(personaId: string): SandboxPersona | null {
  return SANDBOX_PERSONAS[personaId] ?? null;
}

export function listPersonas(): SandboxPersona[] {
  return Object.values(SANDBOX_PERSONAS);
}
