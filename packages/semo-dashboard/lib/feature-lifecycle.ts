/**
 * Feature Lifecycle Pipeline Engine
 *
 * 상태 전환 규칙:
 *   planned → in-spec → spec-ready → in-dev → in-test → active
 *                                                      ↘ deprecated (어디서든)
 *
 * 각 전환 시 감사 로그 기록 + 다음 단계 봇 자동 디스패치.
 */

import { query } from './db';
import { updateFeature, getProject } from './gfp';
import { dispatchBotMessage } from './gfp-bot';
import { getItem } from './kb';
import type { ServiceFeatureStatus } from '@/types';
import type { ServiceFeature } from './gfp';

// ── Transition Rules ──

const TRANSITIONS: Record<ServiceFeatureStatus, ServiceFeatureStatus[]> = {
  planned: ['in-spec', 'deprecated'],
  'in-spec': ['spec-ready', 'planned', 'deprecated'],
  'spec-ready': ['in-dev', 'in-spec', 'deprecated'],
  'in-dev': ['in-test', 'deprecated'],
  'in-test': ['active', 'in-dev', 'deprecated'],
  active: ['deprecated'],
  deprecated: [],
};

export function isValidTransition(from: ServiceFeatureStatus, to: ServiceFeatureStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Core: Transition Feature Status ──

export interface TransitionResult {
  ok: boolean;
  feature?: ServiceFeature;
  error?: string;
  dispatched?: string; // bot_id if auto-dispatched
}

export async function transitionFeatureStatus(
  featureId: string,
  toStatus: ServiceFeatureStatus,
  opts: {
    triggeredBy?: string; // 'system' | 'user' | bot_id
    reason?: string;
    metadata?: Record<string, unknown>;
    skipDispatch?: boolean; // 테스트용: 봇 디스패치 건너뛰기
  } = {},
): Promise<TransitionResult> {
  const { triggeredBy = 'system', reason, metadata: extraMeta, skipDispatch } = opts;

  // 1. 현재 상태 조회
  const res = await query<ServiceFeature>(
    'SELECT * FROM semo.service_features WHERE feature_id = $1',
    [featureId],
  );
  const feature = res.rows[0];
  if (!feature) return { ok: false, error: 'Feature not found' };

  const fromStatus = feature.status as ServiceFeatureStatus;

  // 2. 전환 유효성 검증
  if (!isValidTransition(fromStatus, toStatus)) {
    return { ok: false, error: `Invalid transition: ${fromStatus} → ${toStatus}` };
  }

  // 3. 상태 업데이트
  const updated = await updateFeature(featureId, {
    status: toStatus,
    metadata: {
      lifecycle_pipeline: true,
      last_transition_at: new Date().toISOString(),
      ...extraMeta,
    },
  });
  if (!updated) return { ok: false, error: 'Failed to update feature' };

  // 4. 감사 로그
  await query(
    `INSERT INTO semo.feature_status_transitions (feature_id, from_status, to_status, triggered_by, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [featureId, fromStatus, toStatus, triggeredBy, reason ?? null, JSON.stringify(extraMeta ?? {})],
  );

  // 5. 다음 단계 자동 디스패치
  let dispatched: string | undefined;
  if (!skipDispatch) {
    dispatched = await dispatchNextStep(updated, toStatus);
  }

  return { ok: true, feature: updated, dispatched };
}

// ── Auto-Dispatch ──

async function dispatchNextStep(
  feature: ServiceFeature,
  newStatus: ServiceFeatureStatus,
): Promise<string | undefined> {
  const project = await getProject(feature.service_id);
  if (!project) return undefined;

  const serviceDomain = project.service_domain ?? project.project_name;

  switch (newStatus) {
    case 'in-spec': {
      // PlanClaw에게 스펙 작성 요청
      const message = `[Feature Lifecycle Spec Request: ${feature.feature_id}]

## Service
${serviceDomain}

## Feature
**이름**: ${feature.name}
**설명**: ${feature.description || '(설명 없음)'}
**카테고리**: ${feature.category}

## 작업 지시
위 기능에 대해 상세 스펙을 작성해주세요.
포함할 내용:
1. **문제 정의**: 이 기능이 필요한 이유와 해결하려는 문제
2. **제안 변경사항**: 구체적인 구현 사항
3. **수용 기준**: 완료 판단 기준 (체크리스트)
4. **사용자 스토리**: As a ... I want ... So that ...
5. **테스트 시나리오**: 검증 항목
6. **예상 규모**: small / medium / large

완료 시 POST /api/gfp/callback 으로 콜백:
\`\`\`json
{
  "type": "feature-spec-ready",
  "feature_id": "${feature.feature_id}",
  "spec_content": "<마크다운 스펙>",
  "estimated_effort": "small|medium|large",
  "bot_id": "planclaw"
}
\`\`\``;

      await dispatchBotMessage('planclaw', message);
      return 'planclaw';
    }

    case 'in-dev': {
      // WorkClaw에게 구현 요청 — GitHub Issue 생성 포함
      const spec = feature.metadata?.spec as string | undefined;
      const repoEntry = await getItem(serviceDomain, 'repo');
      const repoPath = repoEntry?.content?.trim();

      const message = `[Feature Lifecycle Implementation: ${feature.feature_id}]

## Service
${serviceDomain}${repoPath ? `\n**Repo**: ${repoPath}` : ''}

## Feature
**이름**: ${feature.name}
**설명**: ${feature.description || '(설명 없음)'}
**카테고리**: ${feature.category}
**예상 규모**: ${(feature.metadata?.estimated_effort as string) || '미정'}

${spec ? `## 스펙\n${typeof spec === 'string' ? spec : JSON.stringify(spec, null, 2)}` : '## 스펙\n(metadata에서 확인)'}

## 작업 지시
위 기능을 구현해주세요.
1. GitHub Issue를 생성하여 작업 추적
2. 스펙의 수용 기준에 맞춰 구현
3. 완료 시 콜백

완료 시 POST /api/gfp/callback 으로 콜백:
\`\`\`json
{
  "type": "feature-work-complete",
  "feature_id": "${feature.feature_id}",
  "github_issue_url": "<이슈 URL>",
  "bot_id": "workclaw"
}
\`\`\``;

      await dispatchBotMessage('workclaw', message);
      return 'workclaw';
    }

    case 'in-test': {
      // ReviewClaw에게 테스트 검증 요청
      const testSpec = feature.metadata?.spec as string | undefined;

      const message = `[Feature Lifecycle Test Verification: ${feature.feature_id}]

## Service
${serviceDomain}

## Feature
**이름**: ${feature.name}
**설명**: ${feature.description || '(설명 없음)'}
**GitHub Issue**: ${(feature.metadata?.github_issue_url as string) || '없음'}

${testSpec ? `## 스펙 (수용 기준/테스트 시나리오 확인)\n${typeof testSpec === 'string' ? testSpec : JSON.stringify(testSpec, null, 2)}` : ''}

## 작업 지시
위 기능의 구현이 완료되었습니다. 테스트 검증을 수행해주세요:
1. 수용 기준 충족 여부 확인
2. 테스트 시나리오 실행
3. 코드 품질 확인 (린트, 타입체크)
4. 결과 리포트 작성

완료 시 POST /api/gfp/callback 으로 콜백:
\`\`\`json
{
  "type": "feature-test-complete",
  "feature_id": "${feature.feature_id}",
  "test_passed": true,
  "test_report": "<테스트 결과 요약>",
  "bot_id": "reviewclaw"
}
\`\`\`

테스트 실패 시:
\`\`\`json
{
  "type": "feature-test-complete",
  "feature_id": "${feature.feature_id}",
  "test_passed": false,
  "test_report": "<실패 사유>",
  "bot_id": "reviewclaw"
}
\`\`\``;

      await dispatchBotMessage('reviewclaw', message);
      return 'reviewclaw';
    }

    default:
      return undefined;
  }
}

// ── Pipeline Trigger on Feature Create ──

export async function triggerPipelineOnCreate(
  feature: ServiceFeature,
): Promise<TransitionResult | null> {
  if (feature.status !== 'planned') return null;

  // planned → in-spec 자동 전환
  return transitionFeatureStatus(feature.feature_id, 'in-spec', {
    triggeredBy: 'system',
    reason: 'Auto-triggered: new feature created as planned',
  });
}
