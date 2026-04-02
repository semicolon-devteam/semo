/**
 * GFP Preset Registry
 *
 * 프리셋은 GFP 파이프라인의 사전 구성 모드를 정의.
 * 예: 인프라가 이미 구축된 프로젝트는 Phase 8에서 InfraClaw CC를 생략.
 */

import type { GfpPresetId, GfpPresetConfig } from '@/types';

export interface GfpPresetDef {
  id: GfpPresetId;
  label: string;
  description: string;
  requiredFields: string[];       // preset_config 내 필수 필드 경로
  skipCcPhases: number[];         // CC 봇 멘션 생략할 phase
  botHintTemplate: Partial<Record<number, string>>;
}

export const GFP_PRESETS: Record<GfpPresetId, GfpPresetDef> = {
  standard: {
    id: 'standard',
    label: '표준',
    description: '신규 프로젝트 — 모든 Phase를 처음부터 진행',
    requiredFields: [],
    skipCcPhases: [],
    botHintTemplate: {},
  },
  'infra-ready': {
    id: 'infra-ready',
    label: '인프라 선행',
    description: '인프라(레포, CI/CD, DNS)가 사전 구축된 프로젝트',
    requiredFields: ['infra.repo_url', 'infra.live_url'],
    skipCcPhases: [8],
    botHintTemplate: {
      0: '이 프로젝트는 인프라가 사전 구축되어 있습니다. 기존 사이트({infra.live_url})를 참고하여 변경/추가 요구사항에 집중하세요.',
      4: '기존 사이트({infra.live_url})의 디자인을 참고하여 디자인 시스템을 구성하세요.',
      7: '인프라 사전 구축 완료: repo={infra.repo_url}. 기술 설계 시 기존 스택을 전제로 작성하세요.',
      8: '인프라가 이미 세팅되어 있으므로 InfraClaw CC를 생략합니다. 기존 레포 구조를 전제로 태스크를 분해하세요.',
    },
  },
};

/**
 * metadata에서 프리셋 정의를 가져옴.
 */
export function getProjectPreset(metadata: Record<string, unknown>): GfpPresetDef {
  const presetId = (metadata?.preset as GfpPresetId) || 'standard';
  return GFP_PRESETS[presetId] ?? GFP_PRESETS.standard;
}

/**
 * 해당 phase에서 CC 봇 멘션을 생략해야 하는지 확인.
 */
export function shouldSkipCc(metadata: Record<string, unknown>, phase: number): boolean {
  const presetConfig = metadata?.preset_config as GfpPresetConfig | undefined;
  if (presetConfig?.skip_cc) {
    return presetConfig.skip_cc.includes(phase);
  }
  // preset_config에 skip_cc가 없으면 프리셋 정의의 기본값 사용
  const preset = getProjectPreset(metadata);
  return preset.skipCcPhases.includes(phase);
}

/**
 * bot_hints 템플릿의 {infra.live_url} 등 플레이스홀더를 실제 값으로 치환.
 */
export function resolveBotHint(template: string, presetConfig: GfpPresetConfig): string {
  return template.replace(/\{([^}]+)\}/g, (match, path: string) => {
    const parts = path.split('.');
    let val: unknown = presetConfig;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return match;
    }
    return typeof val === 'string' ? val : match;
  });
}

/**
 * 해당 phase의 봇 힌트를 resolve해서 반환. 없으면 null.
 */
export function getBotHintForPhase(metadata: Record<string, unknown>, phase: number): string | null {
  const presetConfig = metadata?.preset_config as GfpPresetConfig | undefined;
  // preset_config에 커스텀 bot_hints가 있으면 우선
  const hint = presetConfig?.bot_hints?.[phase];
  if (hint && presetConfig) {
    return resolveBotHint(hint, presetConfig);
  }
  // 없으면 프리셋 정의의 기본 템플릿 사용
  const preset = getProjectPreset(metadata);
  const defaultHint = preset.botHintTemplate[phase];
  if (defaultHint && presetConfig) {
    return resolveBotHint(defaultHint, presetConfig);
  }
  return null;
}
