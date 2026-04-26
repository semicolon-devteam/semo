/**
 * Personal 프로파일 기본 온보딩 시퀀스.
 *
 * MVP 4-step: nickname → role → interests → goals.
 * 각 응답은 `me/*` 도메인으로 저장되어 이후 KB 조회/추천의 seed 가 된다.
 *
 * 도메인 선택 이유: `me` 는 Personal 프로파일 소유자의 자기 정보를 담는
 * 관습적 네임스페이스로, 팀 계정(`alice`, `bob` 등)과 구분된다.
 * 팀 프로파일에서 쓰면 해당 머신 사용자의 자기 정보로 해석한다.
 */
import type { OnboardingStep } from './types.js';

export const DEFAULT_ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'nickname',
    prompt: '무엇이라고 부르면 될까요? 닉네임을 알려주세요.',
    kbKey: { domain: 'me', key: 'nickname' },
  },
  {
    id: 'role',
    prompt: '주로 어떤 일을 하세요?',
    kbKey: { domain: 'me', key: 'role' },
    hint: '예: 프론트엔드 개발자 / PM / 대학생 / 디자이너',
  },
  {
    id: 'interests',
    prompt: '요즘 관심 있는 분야나 다루는 도메인을 알려주세요.',
    kbKey: { domain: 'me', key: 'interests' },
    hint: '예: 웹 프론트엔드, 머신러닝, 게임 기획 (쉼표로 구분)',
    optional: true,
  },
  {
    id: 'goals',
    prompt: 'SEMO 로 이루고 싶은 것이 있으세요?',
    kbKey: { domain: 'me', key: 'goals' },
    hint: '예: 회의록 요약 자동화, 나만의 지식베이스 구축',
    optional: true,
  },
];
