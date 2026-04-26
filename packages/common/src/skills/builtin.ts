/**
 * BUILTIN_KERNEL_SKILLS — OSS 배포에 포함되는 L0 카탈로그 스킬 목록.
 *
 * 추가/수정 시:
 *   - 스킬 본문은 별도 파일(예: factory-conversation.ts)로 분리해 import.
 *   - tenant L2 자산(고유 도메인명) 유입 금지 — generic 한 표현만 사용.
 *   - SKILL.md frontmatter 의 \`name\` 필드는 반드시 id 와 일치.
 */
import type { KernelSkill } from './types.js';
import { FACTORY_CONVERSATION_SKILL_MD } from './factory-conversation.js';

export const BUILTIN_KERNEL_SKILLS: readonly KernelSkill[] = [
  {
    id: 'factory-conversation',
    summary: '자연어 봇/KB 명령을 semo factory 로 위임 (SemoBot DM 응답)',
    skillMd: FACTORY_CONVERSATION_SKILL_MD,
  },
];
