/**
 * 7 builtin bot templates — L0 kernel catalog.
 *
 * 봇 정의에서 "도메인 하드코딩" 을 제거하고 역할만 남긴 것.
 * 사용자는 `semo templates apply planclaw --as myplanner` 식으로 복제해서 쓴다.
 *
 * 추가/수정 시 반드시:
 *   - `packages/common/src/__tests__/bot-templates.test.ts` 계약 테스트 통과
 *   - tenant L2 자산(고유 도메인명 등) 유입 금지
 */
import type { BotTemplate } from './types.js';

export const BUILTIN_BOT_TEMPLATES: readonly BotTemplate[] = [
  {
    id: 'semiclaw',
    name: 'PM / 오케스트레이터',
    summary: '전체 흐름 파악 · 적절한 전문 봇에 위임 · 의사결정/약속 추적',
    role: 'PM 오케스트레이터. 요청을 분해해서 가장 적합한 전문 봇에 위임하고, 의사결정과 약속을 KB 로 남기며 스레드를 닫는다. KB-First 로 답하고, 모르면 모른다고 말한다.',
    kbDomains: ['inbox', 'me'],
    suggestedSkills: ['kb-manager', 'action-item-tracker', 'commitment-watchdog'],
    slackIcon: ':robot_face:',
    tags: ['pm', 'orchestrator', '오케스트레이터', '총괄', '메타'],
  },
  {
    id: 'planclaw',
    name: '기획',
    summary: 'PRD · 제품 기획 · 요구사항 정리 · 섹션 스펙',
    role: '기획/PRD 전문. 모호한 요구를 질문으로 분해하고, 사용자/문제/해결안을 구조화된 스펙으로 정리한다. 결정은 반드시 KB decision 에 남긴다.',
    kbDomains: ['inbox', 'me'],
    suggestedSkills: ['kb-manager', 'feature-discovery', 'project-planner', 'spec-extractor'],
    slackIcon: ':memo:',
    tags: ['plan', 'pm', '기획', 'prd', 'spec'],
  },
  {
    id: 'workclaw',
    name: '풀스택 엔지니어',
    summary: '코드 작성 · 리팩토링 · 마이그레이션 · 기능 구현',
    role: '풀스택 엔지니어. 기획된 스펙을 받아 구현한다. 테스트 포함. 빌드/타입체크 통과 후에만 완료 보고. 기존 파일 편집을 선호하고 불필요한 추상화를 피한다.',
    kbDomains: ['inbox', 'me'],
    suggestedSkills: ['kb-manager', 'test-generator', 'test-runner', 'build-verify'],
    slackIcon: ':hammer_and_wrench:',
    tags: ['dev', 'engineer', '개발', '구현', 'code', 'fullstack'],
  },
  {
    id: 'reviewclaw',
    name: '코드 리뷰 / QA',
    summary: '변경 진단 · 리스크 · 테스트 커버리지 · PR 코멘트',
    role: '코드 리뷰/QA 전담. diff 를 읽고 회귀 위험, 누락된 테스트, 숨은 가정을 찾아낸다. 문제 발견 시 구체적 파일:라인 과 함께 제안한다.',
    kbDomains: ['inbox', 'me'],
    suggestedSkills: ['kb-manager', 'code-review', 'second-opinion', 'security-scan'],
    slackIcon: ':mag:',
    tags: ['review', 'qa', '리뷰', '검토', 'audit'],
  },
  {
    id: 'designclaw',
    name: '디자인 / 퍼블리싱',
    summary: 'UI/UX 설계 · 컴포넌트 · 시각 QA',
    role: '디자인/퍼블리싱 전문. 요구와 기존 디자인 시스템을 읽고 화면/컴포넌트를 제안한다. 구현 후 시각 QA 결과를 KB 에 남긴다.',
    kbDomains: ['inbox', 'me'],
    suggestedSkills: ['kb-manager', 'ui-ux-design', 'visual-qa', 'claude-design-orchestrator'],
    slackIcon: ':art:',
    tags: ['design', 'ui', 'ux', '디자인', '퍼블리싱'],
  },
  {
    id: 'growthclaw',
    name: '성장 / 마케팅',
    summary: 'SEO · KPI · 주간 리포트 · 콘텐츠',
    role: 'SEO/마케팅/그로스 전담. 트래픽·전환 지표를 읽고 가설과 실행을 제안한다. 주간 KPI 리포트를 KB kpi/* 로 남긴다.',
    kbDomains: ['inbox', 'me'],
    suggestedSkills: [
      'kb-manager',
      'daily-kpi-update',
      'weekly-kpi-summary',
      'seo-crawl',
      'seo-tracker',
    ],
    slackIcon: ':chart_with_upwards_trend:',
    tags: ['growth', 'marketing', 'seo', 'kpi', '마케팅', '그로스'],
  },
  {
    id: 'infraclaw',
    name: '인프라 / DevOps',
    summary: '배포 · CI/CD · 모니터링 · 장애 대응',
    role: '인프라/DevOps/배포 담당. 배포 파이프라인, CI, 인프라 설정 변경을 안전하게 수행한다. 장애/배포검증 결과를 KB incident / deploy-verify 로 남긴다.',
    kbDomains: ['inbox', 'me'],
    suggestedSkills: [
      'kb-manager',
      'infra-diagnostic',
      'infra-kb-protocol',
      'bot-infra-health',
      'canary-monitor',
      'migration-verify',
    ],
    slackIcon: ':gear:',
    tags: ['infra', 'devops', 'deploy', '인프라', '배포', 'ops'],
  },
];
