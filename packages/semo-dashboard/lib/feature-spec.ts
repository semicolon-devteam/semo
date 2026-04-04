/**
 * Feature Spec Helpers — 구조화된 기능 명세 파싱, 검증, 병합, 기본 생성
 */

import type {
  FeatureSpec,
  AcceptanceCriterion,
  UserStory,
  TestScenario,
} from '@/types';

// ── 기본 스펙 생성 ──

export function createEmptySpec(): FeatureSpec {
  return {
    acceptance_criteria: [],
    user_stories: [],
    test_scenarios: [],
    spec_status: 'draft',
  };
}

export function createSpecFromSummary(summary: string, generatedBy = 'manual'): FeatureSpec {
  return {
    summary,
    acceptance_criteria: [],
    user_stories: [],
    test_scenarios: [],
    spec_status: 'draft',
    spec_generated_by: generatedBy,
    spec_generated_at: new Date().toISOString(),
  };
}

// ── ID 생성 ──

export function nextAcId(criteria: AcceptanceCriterion[]): string {
  const maxNum = criteria.reduce((max, ac) => {
    const num = parseInt(ac.id.replace('ac-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `ac-${maxNum + 1}`;
}

export function nextUsId(stories: UserStory[]): string {
  const maxNum = stories.reduce((max, us) => {
    const num = parseInt(us.id.replace('us-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `us-${maxNum + 1}`;
}

export function nextTsId(scenarios: TestScenario[]): string {
  const maxNum = scenarios.reduce((max, ts) => {
    const num = parseInt(ts.id.replace('ts-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `ts-${maxNum + 1}`;
}

// ── 스펙 병합 (기존 + 신규 추가) ──

export function mergeSpecs(existing: FeatureSpec, incoming: Partial<FeatureSpec>): FeatureSpec {
  const merged = { ...existing };

  if (incoming.summary !== undefined) merged.summary = incoming.summary;
  if (incoming.estimated_effort !== undefined) merged.estimated_effort = incoming.estimated_effort;
  if (incoming.source_url !== undefined) merged.source_url = incoming.source_url;
  if (incoming.screenshot_key !== undefined) merged.screenshot_key = incoming.screenshot_key;

  // AC: 기존 유지 + 신규 추가 (id 기준 중복 제거)
  if (incoming.acceptance_criteria) {
    const existingIds = new Set(existing.acceptance_criteria.map(ac => ac.id));
    const newAcs = incoming.acceptance_criteria.filter(ac => !existingIds.has(ac.id));
    merged.acceptance_criteria = [...existing.acceptance_criteria, ...newAcs];
  }

  // 유저 스토리: 동일 패턴
  if (incoming.user_stories) {
    const existingIds = new Set(existing.user_stories.map(us => us.id));
    const newStories = incoming.user_stories.filter(us => !existingIds.has(us.id));
    merged.user_stories = [...existing.user_stories, ...newStories];
  }

  // 테스트 시나리오: 동일 패턴
  if (incoming.test_scenarios) {
    const existingIds = new Set(existing.test_scenarios.map(ts => ts.id));
    const newScenarios = incoming.test_scenarios.filter(ts => !existingIds.has(ts.id));
    merged.test_scenarios = [...existing.test_scenarios, ...newScenarios];
  }

  // 메타 필드
  if (incoming.spec_status) merged.spec_status = incoming.spec_status;
  if (incoming.spec_generated_by) merged.spec_generated_by = incoming.spec_generated_by;
  if (incoming.spec_generated_at) merged.spec_generated_at = incoming.spec_generated_at;
  if (incoming.spec_approved_at) merged.spec_approved_at = incoming.spec_approved_at;

  return merged;
}

// ── 검증 ──

export function validateSpec(spec: FeatureSpec): string[] {
  const errors: string[] = [];

  // AC ID 중복 체크
  const acIds = spec.acceptance_criteria.map(ac => ac.id);
  if (new Set(acIds).size !== acIds.length) {
    errors.push('Acceptance Criteria에 중복 ID가 있습니다.');
  }

  // 유저 스토리의 acceptance_ids가 존재하는 AC를 참조하는지
  const acIdSet = new Set(acIds);
  for (const us of spec.user_stories) {
    for (const refId of us.acceptance_ids) {
      if (!acIdSet.has(refId)) {
        errors.push(`User Story ${us.id}가 존재하지 않는 AC ${refId}를 참조합니다.`);
      }
    }
  }

  // 테스트 시나리오의 acceptance_ids 검증
  for (const ts of spec.test_scenarios) {
    for (const refId of ts.acceptance_ids) {
      if (!acIdSet.has(refId)) {
        errors.push(`Test Scenario ${ts.id}가 존재하지 않는 AC ${refId}를 참조합니다.`);
      }
    }
  }

  return errors;
}

// ── 하위 호환: 기존 string spec → FeatureSpec 변환 ──

export function normalizeSpec(raw: unknown): FeatureSpec {
  if (!raw) return createEmptySpec();

  if (typeof raw === 'string') {
    return createSpecFromSummary(raw);
  }

  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    return {
      summary: (obj.summary as string) || undefined,
      estimated_effort: obj.estimated_effort as FeatureSpec['estimated_effort'],
      acceptance_criteria: (obj.acceptance_criteria as AcceptanceCriterion[]) || [],
      user_stories: (obj.user_stories as UserStory[]) || [],
      test_scenarios: (obj.test_scenarios as TestScenario[]) || [],
      source_url: obj.source_url as string | undefined,
      screenshot_key: obj.screenshot_key as string | undefined,
      spec_status: (obj.spec_status as FeatureSpec['spec_status']) || 'draft',
      spec_generated_by: obj.spec_generated_by as string | undefined,
      spec_generated_at: obj.spec_generated_at as string | undefined,
      spec_approved_at: obj.spec_approved_at as string | undefined,
    };
  }

  return createEmptySpec();
}

// ── 스펙 완성도 계산 ──

export function specCompleteness(spec: FeatureSpec): { score: number; label: string } {
  let score = 0;
  if (spec.summary) score += 20;
  if (spec.acceptance_criteria.length > 0) score += 30;
  if (spec.user_stories.length > 0) score += 20;
  if (spec.test_scenarios.length > 0) score += 20;
  if (spec.spec_status === 'approved') score += 10;

  let label = '미작성';
  if (score >= 80) label = '충분';
  else if (score >= 50) label = '보통';
  else if (score > 0) label = '부족';

  return { score, label };
}

// ── AC 검증률 ──

export function acVerificationRate(spec: FeatureSpec): { verified: number; total: number } {
  const total = spec.acceptance_criteria.length;
  const verified = spec.acceptance_criteria.filter(ac => ac.verified).length;
  return { verified, total };
}
