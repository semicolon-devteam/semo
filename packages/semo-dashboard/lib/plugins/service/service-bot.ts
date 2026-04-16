/**
 * Bot Dispatch — Slack → Channel Plugin → Claude Code 세션
 *
 * 통합봇(SEMO Incubator)에게 Slack 메시지를 전송하면,
 * Channel 플러그인이 수신하여 Claude Code 세션 내에서
 * Agent({botId})로 라우팅한다.
 */

import { getPhaseAssignee } from './service-phases';
import { getPoProfile, wrapPoContext } from './po-profile';
import type { PoProfile, ServiceTrack } from '@/types';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SEMO_INCUBATOR_BOT_ID = 'U0AR4719LGM'; // @SEMO Incubator

export async function dispatchBotMessage(
  botId: string,
  message: string,
  channelId?: string,
  poProfile?: PoProfile,
): Promise<{ ok: boolean } | null> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not set — skipping bot dispatch');
    return null;
  }

  // 프로젝트 채널이 없으면 #semo-incubator 폴백
  const targetChannel = channelId || process.env.SEMO_INCUBATOR_CHANNEL || 'C0APG495ABZ';

  try {
    const profilePrefix = poProfile ? `${wrapPoContext(poProfile)}\n\n` : '';
    const slackMessage = `<@${SEMO_INCUBATOR_BOT_ID}> [Route: ${botId}]\n\n${profilePrefix}${message}`;

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: targetChannel,
        text: slackMessage,
        unfurl_links: false,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error(`Bot dispatch Slack error (${botId}):`, data.error);
      return null;
    }
    return { ok: true };
  } catch (error) {
    console.error(`Bot dispatch error (${botId}):`, error);
    return null;
  }
}

export async function dispatchResearch(
  taskId: string,
  botId: string,
  message: string,
): Promise<void> {
  await dispatchBotMessage(botId, `[Research Task: ${taskId}]\n\n${message}`);
}

export async function dispatchRegeneration(
  sectionId: string,
  originalContent: string,
  reviewerNote: string,
  phase: number = 0,
  projectMetadata?: Record<string, unknown>,
  track: ServiceTrack = 'plan',
  channelId?: string,
): Promise<void> {
  const assignee = getPhaseAssignee(phase, track);

  let presetContext = '';
  let profileCtx = '';
  if (projectMetadata) {
    const { getBotHintForPhase } = await import('./service-presets');
    const hint = getBotHintForPhase(projectMetadata, phase);
    if (hint) presetContext = `\n## Preset Context\n${hint}\n`;
    const poProfile = getPoProfile(projectMetadata);
    profileCtx = `\n${wrapPoContext(poProfile)}\n`;
  }

  const message = `[Service Section Regeneration: ${sectionId}]
${presetContext}${profileCtx}
## Original Content
${originalContent}

## Rejection Reason
${reviewerNote}

Please regenerate the section addressing the rejection reason above.`;

  await dispatchBotMessage(assignee.botId, message, channelId);
}

export async function dispatchFeatureSpecRequest(
  featureId: string,
  featureName: string,
  featureDescription: string | null,
  improvementTitle: string,
  improvementDescription: string,
  serviceDomain: string,
): Promise<void> {
  const message = `[Ops Feature Spec Request: ${featureId}]

## Service
${serviceDomain}

## Existing Feature
${featureName}
${featureDescription || '(설명 없음)'}

## Improvement Request
**제목**: ${improvementTitle}
**설명**: ${improvementDescription}

## 작업 지시
위 기능 개선 요청에 대해 경량 스펙을 작성해주세요.
포함할 내용:
1. **문제 정의**: 현재 기능의 한계 또는 개선 필요성
2. **제안 변경사항**: 구체적인 변경/추가 사항
3. **수용 기준**: 완료 판단 기준 (체크리스트)
4. **예상 규모**: small / medium / large

완료 시 POST /api/projects/callback 으로 콜백:
\`\`\`json
{
  "type": "feature-spec-ready",
  "feature_id": "${featureId}",
  "spec_content": "<마크다운 스펙>",
  "estimated_effort": "small|medium|large",
  "bot_id": "planclaw"
}
\`\`\``;

  await dispatchBotMessage('planclaw', message);
}

export async function dispatchFeatureSpecRegeneration(
  featureId: string,
  featureName: string,
  originalSpec: string,
  reviewerNote: string,
  serviceDomain: string,
): Promise<void> {
  const message = `[Ops Feature Spec Regeneration: ${featureId}]

## Service
${serviceDomain}

## Feature
${featureName}

## 기존 스펙 (거절됨)
${originalSpec}

## 거절 사유
${reviewerNote}

## 작업 지시
거절 사유를 반영하여 스펙을 재작성해주세요.
동일한 형식(문제 정의, 제안 변경사항, 수용 기준, 예상 규모)으로 작성하고
POST /api/projects/callback type: "feature-spec-ready"로 콜백해주세요.`;

  await dispatchBotMessage('planclaw', message);
}

export async function dispatchFeatureDiscovery(
  sessionId: string,
  sourceUrl: string,
  serviceDomain: string,
): Promise<void> {
  const message = `[Feature Discovery: ${sessionId}]

## 작업
${sourceUrl} 사이트를 Playwright로 탐색하여 기능 목록을 추출해주세요.

## Service Domain
${serviceDomain}

## 탐색 절차
1. 메인 페이지 접속 → 스크린샷 캡처
2. 네비게이션(header, nav, sidebar) 구조 추출
3. 주요 링크별 페이지 탐색 → 각 페이지 visible text + 스크린샷
4. 기능 후보 목록 생성 (JSON 배열)

## 기능 후보 형식
각 기능: { name, description, category(core/growth/ux/infra/integration), source_url, confidence(high/medium/low), nav_path, visible_elements, suggested_children }

## 콜백
POST /api/projects/callback:
{ "type": "feature-discovery-complete", "session_id": "${sessionId}", "candidates": [...], "screenshots": { "page-key": "base64..." }, "bot_id": "semiclaw" }`;

  await dispatchBotMessage('semiclaw', message);
}

export async function dispatchFeatureConversation(
  sessionId: string,
  serviceDomain: string,
  projectName: string,
  mode: string,
): Promise<void> {
  const modeDesc =
    mode === 'enrich'
      ? '기존 기능의 스펙(AC, 유저스토리, 테스트시나리오)을 보강'
      : '신규 기능을 기획하고 구조화된 스펙 생성';

  const message = `[Feature Conversation: ${sessionId}]

## 작업
${projectName} (${serviceDomain}) 서비스에 대해 ${modeDesc}합니다.
service-onboarding 스킬의 1문 1답 Q&A 패턴으로 진행하세요.

## 대화 흐름 (create 모드)
Phase 1: 기능 개요 (이름, 설명, 카테고리, 주요 사용자, 해결 문제)
Phase 2: 수용 기준 (자유 입력 → AC 목록 구조화 → 확인)
Phase 3: 유저 스토리 (선택, AC 기반 자동 생성 후 확인)
Phase 4: 테스트 시나리오 (선택, AC 기반 자동 생성 후 확인)
Phase 5: 최종 확인 → 등록

## 대화 흐름 (enrich 모드)
기존 기능 목록 조회 → 각 기능별 AC 보강 → 유저스토리/시나리오 생성

## 콜백
진행 중 features 업데이트:
POST /api/projects/{serviceId}/features/conversation
{ "action": "update-features", "session_id": "${sessionId}", "features": [...] }

완료 시:
POST /api/projects/callback
{ "type": "feature-conversation-complete", "session_id": "${sessionId}", "features": [...], "bot_id": "semiclaw" }`;

  await dispatchBotMessage('semiclaw', message);
}

export async function dispatchSpecEnrichment(
  featureId: string,
  featureName: string,
  featureDescription: string | null,
  serviceDomain: string,
  existingSpec: import('@/types').FeatureSpec,
): Promise<void> {
  const hasAc = existingSpec.acceptance_criteria.length > 0;
  const existingContext = hasAc
    ? `\n## 기존 AC\n${existingSpec.acceptance_criteria.map((ac) => `- [${ac.id}] ${ac.criterion}`).join('\n')}`
    : '';

  const message = `[Feature Spec Enrichment: ${featureId}]

## Service
${serviceDomain}

## Feature
${featureName}
${featureDescription || '(설명 없음)'}
${existingSpec.source_url ? `URL: ${existingSpec.source_url}` : ''}
${existingContext}

## 작업 지시
이 기능에 대해 구조화된 스펙을 생성해주세요.
${hasAc ? '기존 AC를 유지하면서 보강합니다.' : ''}

## 출력 형식 (JSON)
{
  "acceptance_criteria": [{ "id": "ac-1", "criterion": "...", "verified": false }],
  "user_stories": [{ "id": "us-1", "as_a": "...", "i_want": "...", "so_that": "...", "acceptance_ids": ["ac-1"] }],
  "test_scenarios": [{ "id": "ts-1", "title": "...", "steps": ["..."], "expected": "...", "acceptance_ids": ["ac-1"] }],
  "estimated_effort": "small|medium|large"
}

## 콜백
POST /api/projects/callback:
{ "type": "feature-spec-enriched", "feature_id": "${featureId}", "spec": <위 JSON>, "bot_id": "planclaw" }`;

  await dispatchBotMessage('planclaw', message);
}
