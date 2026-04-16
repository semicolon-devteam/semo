import type { PoProfile } from '@/types';

export const DEFAULT_PO_PROFILE: PoProfile = {
  tech_level: 'intermediate',
  design_sensitivity: 'medium',
  domain_area: 'product',
  interaction_style: 'detailed',
  decision_style: 'options',
};

/** tech_level=non-technical 일 때 금지되는 전문 약어 → 일반인 대체 표현 */
export const JARGON_ALTERNATIVES: Record<string, string> = {
  MVP: '핵심 기능',
  PWA: '설치 가능한 웹',
  'React Native': '모바일에서도 쓸 수 있는 앱',
  API: '서버 연결',
  SaaS: '구독형 서비스',
  SDK: '개발 도구 모음',
  'CI/CD': '자동 배포',
  UI: '화면',
  UX: '사용 경험',
  'UI/UX': '화면 디자인',
  Backend: '서버 쪽',
  Frontend: '화면 쪽',
  Deploy: '배포(서비스 반영)',
  Repository: '코드 저장소',
  'DB/Database': '데이터 저장소',
  Webhook: '자동 알림 연결',
  Middleware: '중간 처리 장치',
  Microservice: '독립 서비스 단위',
  Monorepo: '통합 코드 저장소',
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

/** 봇 dispatch 시 PO 프로파일 컨텍스트 문자열 생성 — <po_context> 태그 내부용 */
export function buildProfileContext(profile: PoProfile): string {
  const lines = [
    `PO 프로필: tech_level=${profile.tech_level}, design_sensitivity=${profile.design_sensitivity}, domain_area=${profile.domain_area}, interaction_style=${profile.interaction_style}, decision_style=${profile.decision_style}`,
  ];

  if (profile.tech_level === 'non-technical') {
    lines.push(
      '⚠️ 기술 용어 전면 금지. 아래 약어를 절대 사용하지 않는다:',
      ...Object.entries(JARGON_ALTERNATIVES).map(([term, alt]) => `  - ${term} → "${alt}"`),
      '위 목록에 없는 기술 약어도 일반인이 이해 가능한 표현으로 풀어쓴다.',
      '코드 블록, 커맨드라인 예시 사용 금지. 시각적·비유적 설명 우선.',
    );
  } else if (profile.tech_level === 'basic') {
    lines.push(
      '기술 용어 사용 시 반드시 한국어 병기:',
      ...Object.entries(JARGON_ALTERNATIVES)
        .slice(0, 6)
        .map(([term, alt]) => `  - ${term}(${alt})`),
      '코드 블록은 최소화하되, 필요 시 간단한 예시 허용.',
    );
  } else if (profile.tech_level === 'advanced') {
    lines.push('기술 상세 포함 가능. 코드 예시, 아키텍처 다이어그램 허용.');
  }

  if (profile.design_sensitivity === 'high') {
    lines.push('디자인 디테일(자간, 행간, 컬러 코드) 포함하여 설명.');
  } else if (profile.design_sensitivity === 'low') {
    lines.push('디자인 세부사항 생략, "깔끔하게" 수준으로만 언급.');
  }

  if (profile.decision_style === 'recommendation') {
    lines.push('여러 옵션 대신 추천안 하나를 제시하고 이유를 간결히 설명.');
  }

  if (profile.interaction_style === 'concise') {
    lines.push('핵심만 간결하게. 맥락 설명 최소화.');
  }

  return lines.join('\n');
}

/** buildProfileContext를 <po_context> 태그로 감싸서 반환 */
export function wrapPoContext(profile: PoProfile): string {
  return `<po_context>\n${buildProfileContext(profile)}\n</po_context>`;
}
