/**
 * Sandbox Virtual PO — 가상 PO 자동 리뷰 로직.
 *
 * auto-pilot: 무조건 승인
 * semi-auto: rejection_rate × phase_weight 확률로 거절
 * interactive: no-op (사람이 직접)
 */

import { executeSectionAction } from './service-actions';
import { incrementRunStat } from './sandbox';
import type { ServiceSection, SandboxConfig } from '@/types';

const SYNTHETIC_REJECTION_NOTES: Record<number, string[]> = {
  0: ['프로젝트 배경 설명이 좀 더 구체적이면 좋겠습니다.'],
  1: ['우선순위 기준이 불명확합니다. P0와 P1의 차이를 더 명확하게 해주세요.'],
  2: ['MVP 범위가 너무 넓어 보입니다. 핵심 기능 3개로 좁혀주세요.'],
  3: ['Q&A 답변이 부족합니다. 좀 더 상세히 답변해주세요.'],
  4: [
    '색상 대비가 접근성 기준을 충족하지 않는 것 같습니다.',
    '폰트 사이즈가 모바일에서 너무 작아 보입니다.',
  ],
  5: ['에픽 간 의존관계가 명시되지 않았습니다.'],
  6: ['기능 스펙에 에러 케이스가 빠져있습니다.'],
  7: ['데이터베이스 스키마가 정규화가 부족합니다.', '보안 관련 고려사항이 누락되어 있습니다.'],
  8: ['태스크 예상 시간이 현실적이지 않습니다. 버퍼를 추가해주세요.'],
  9: ['핸드오프 체크리스트에 배포 환경 검증이 빠져있습니다.'],
};

function getRandomRejectionNote(phase: number): string {
  const notes = SYNTHETIC_REJECTION_NOTES[phase] ?? ['수정이 필요합니다.'];
  return notes[Math.floor(Math.random() * notes.length)];
}

function shouldReject(sandbox: SandboxConfig, phase: number): boolean {
  if (sandbox.virtual_po.mode === 'auto-pilot') return false;
  if (sandbox.virtual_po.mode === 'interactive' || sandbox.virtual_po.mode === 'full-interaction')
    return false;

  const baseRate = sandbox.virtual_po.rejection_rate ?? 0.15;
  const phaseWeight = sandbox.virtual_po.phase_rejection_weights?.[phase] ?? 1.0;
  const effectiveRate = Math.min(baseRate * phaseWeight, 0.8); // cap at 80%

  return Math.random() < effectiveRate;
}

/**
 * 단일 섹션 가상 PO 리뷰.
 */
export async function processVirtualPOReview(
  serviceId: string,
  section: ServiceSection,
  sandbox: SandboxConfig,
): Promise<void> {
  if (sandbox.virtual_po.mode === 'interactive' || sandbox.virtual_po.mode === 'full-interaction')
    return;
  if (section.status !== 'pending-review') return;

  const reject = shouldReject(sandbox, section.phase);

  const result = await executeSectionAction({
    serviceId: serviceId,
    sectionId: section.section_id,
    action: reject ? 'reject' : 'approve',
    reviewerNote: reject ? `[Virtual PO] ${getRandomRejectionNote(section.phase)}` : undefined,
    actionSource: 'dashboard', // sandbox는 내부 호출이므로 dashboard 소스
  });

  await incrementRunStat(serviceId, 'sections_reviewed');
  if (reject) {
    await incrementRunStat(serviceId, 'rejections');
  }

  if (result.phaseAdvanced) {
    await incrementRunStat(serviceId, 'phases_completed');
  }

  console.log(
    `[SANDBOX-PO] ${reject ? 'REJECTED' : 'APPROVED'} section "${section.title}" (Phase ${section.phase}) for ${serviceId}`,
  );
}

/**
 * 복수 섹션 일괄 리뷰 (Mock 주입 후 호출).
 * 섹션 간 딜레이를 두어 순차 처리.
 */
export async function processVirtualPOReviewBatch(
  serviceId: string,
  sections: ServiceSection[],
  sandbox: SandboxConfig,
): Promise<void> {
  const delay = sandbox.timing.section_delay_ms;

  for (let i = 0; i < sections.length; i++) {
    if (i > 0 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await processVirtualPOReview(serviceId, sections[i], sandbox);
  }
}

/**
 * 모드 전환 (interactive ↔ auto-pilot/semi-auto).
 * 실행 중 Slack에서 "@SemoBot 샌드박스 자동으로 전환해줘" 트리거.
 */
export async function switchVirtualPOMode(
  serviceId: string,
  newMode: SandboxConfig['virtual_po']['mode'],
): Promise<{ error?: string }> {
  const { getProject, updateProject } = await import('./service');
  const project = await getProject(serviceId);
  if (!project) return { error: '프로젝트를 찾을 수 없습니다.' };

  const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
    | SandboxConfig
    | undefined;
  if (!sandbox?.enabled) return { error: '이 프로젝트는 샌드박스가 아닙니다.' };

  const updatedSandbox: SandboxConfig = {
    ...sandbox,
    virtual_po: { ...sandbox.virtual_po, mode: newMode },
    auto_advance: newMode !== 'interactive' && newMode !== 'full-interaction',
  };

  await updateProject(serviceId, {
    metadata: { sandbox: updatedSandbox },
  });

  console.log(`[SANDBOX-PO] Mode switched to ${newMode} for ${serviceId}`);
  return {};
}
