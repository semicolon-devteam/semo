/**
 * GFP Bot Callback API
 *
 * 봇(PlanClaw, GrowthClaw, DesignClaw 등)이 작업 결과를 GFP DB에 반영하는 엔드포인트.
 * 세 가지 콜백 타입:
 *   1. section-regeneration: 거절된 섹션의 재생성 결과 반영
 *   2. research-result: 리서치 작업 결과 반영
 *   3. stitch-export: Stitch 디자인 export 결과 반영
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  updateSectionContent,
  updateResearchTask,
  upsertSection,
  createStitchMaterial,
  listSections,
  getProject,
  updateSectionSlackThread,
  updateFeature,
  updateDiscoverySession,
  updateConversationSession,
  createDeployVerification,
} from '@/lib/service';
import { query } from '@/lib/db';
import {
  postSlackMessage,
  sendServiceQASlack,
  sendServiceSectionPendingReviewSlack,
  sendServiceStitchResultSlack,
  sendServiceStitchFallbackSlack,
  resolveServiceSlackContext,
  sendFeatureSpecReviewSlack,
  sendFeatureWorkCompleteSlack,
} from '@/lib/slack';
import { transitionFeatureStatus } from '@/lib/feature-lifecycle';

const DASHBOARD_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space';

export const dynamic = 'force-dynamic';

interface SectionRegenerationPayload {
  type: 'section-regeneration';
  section_id: string;
  content: string;
  bot_id: string;
}

interface ResearchResultPayload {
  type: 'research-result';
  task_id: string;
  result: string;
  bot_id: string;
}

interface StitchExportPayload {
  type: 'stitch-export';
  service_id: string;
  prompt_section_id: string;
  export_content: string;
  screenshot_base64?: string;
  stitch_share_url?: string;
  bot_id: string;
}

interface ClarificationReadyPayload {
  type: 'clarification-ready';
  service_id: string;
  bot_id: string;
}

interface DesignReferenceAnalysisPayload {
  type: 'design-reference-analysis';
  service_id: string;
  analysis: string;
  bot_id: string;
}

interface DesignPrototypePayload {
  type: 'design-prototype';
  service_id: string;
  screen_name: string;
  html_content: string;
  description: string;
  fallback_reason?: string;
  bot_id: string;
}

interface FeatureSpecReadyPayload {
  type: 'feature-spec-ready';
  feature_id: string;
  project_id?: string;
  spec_content: string;
  estimated_effort?: 'small' | 'medium' | 'large';
  bot_id: string;
}

interface FeatureWorkCompletePayload {
  type: 'feature-work-complete';
  feature_id: string;
  github_issue_number?: number;
  bot_id: string;
}

interface FeatureDiscoveryCompletePayload {
  type: 'feature-discovery-complete';
  session_id: string;
  candidates: Array<Record<string, unknown>>;
  screenshots: Record<string, string>;
  bot_id: string;
}

interface FeatureSpecEnrichedPayload {
  type: 'feature-spec-enriched';
  feature_id: string;
  spec: Record<string, unknown>;
  bot_id: string;
}

interface FeatureConversationCompletePayload {
  type: 'feature-conversation-complete';
  session_id: string;
  features: Array<Record<string, unknown>>;
  bot_id: string;
}

interface FeatureTestCompletePayload {
  type: 'feature-test-complete';
  feature_id: string;
  test_passed: boolean;
  test_report?: string;
  bot_id: string;
}

interface DeployVerificationPayload {
  type: 'deploy-verification';
  service_id: string;
  infra_phase: number;
  checks: import('@/types').DeployVerificationChecks;
  bot_id: string;
}

interface IncubatorCheckpointPayload {
  type: 'incubator-checkpoint';
  service_id: string;
  checkpoint: number;
  status: 'completed' | 'in-progress' | 'blocked';
  summary?: string;
  bot_id: string;
  next_action?: string;
}

interface DesignSystemConfirmedPayload {
  type: 'design-system-confirmed';
  service_id: string;
  stitch_project_id: string;
  stitch_design_system_id: string;
  design_tokens_summary?: string;
  bot_id: string;
}

interface SandboxSectionSubmitPayload {
  type: 'sandbox-section-submit';
  service_id: string;
  phase: number;
  section_key: string;
  title: string;
  content: string;
  bot_id: string;
}

type CallbackPayload =
  | SectionRegenerationPayload
  | ResearchResultPayload
  | StitchExportPayload
  | ClarificationReadyPayload
  | DesignReferenceAnalysisPayload
  | DesignPrototypePayload
  | FeatureSpecReadyPayload
  | FeatureWorkCompletePayload
  | FeatureDiscoveryCompletePayload
  | FeatureSpecEnrichedPayload
  | FeatureConversationCompletePayload
  | FeatureTestCompletePayload
  | DeployVerificationPayload
  | IncubatorCheckpointPayload
  | DesignSystemConfirmedPayload
  | SandboxSectionSubmitPayload;

export async function POST(request: NextRequest) {
  try {
    const body: CallbackPayload = await request.json();

    if (!body.type || !body.bot_id) {
      return NextResponse.json({ error: 'type and bot_id are required' }, { status: 400 });
    }

    switch (body.type) {
      case 'section-regeneration': {
        if (!body.section_id || !body.content) {
          return NextResponse.json(
            { error: 'section_id and content are required for section-regeneration' },
            { status: 400 },
          );
        }
        const section = await updateSectionContent(body.section_id, body.content, 'pending-review');
        if (!section) {
          return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }
        console.log(`[GFP Callback] Section ${body.section_id} regenerated by ${body.bot_id}`);

        // Slack pending-review 알림 (승인/거절 버튼 포함)
        const project = await getProject(section.service_id);
        if (project) {
          const slackCtx = await resolveServiceSlackContext(section.service_id);
          sendServiceSectionPendingReviewSlack({
            projectName: project.project_name,
            serviceId: section.service_id,
            sectionId: section.section_id,
            sectionKey: section.section_key,
            sectionTitle: section.title,
            phase: section.phase,
            contentPreview: section.content.slice(0, 300),
            channelId: slackCtx.channelId,
          })
            .then((ts) => {
              if (ts) updateSectionSlackThread(section.section_id, ts).catch(() => {});
            })
            .catch((err) => console.error('Slack pending-review notify failed:', err));
        }

        return NextResponse.json({ ok: true, section });
      }

      case 'research-result': {
        if (!body.task_id || !body.result) {
          return NextResponse.json(
            { error: 'task_id and result are required for research-result' },
            { status: 400 },
          );
        }
        const task = await updateResearchTask(body.task_id, {
          status: 'completed',
          result: body.result,
        });
        if (!task) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        console.log(`[GFP Callback] Research ${body.task_id} completed by ${body.bot_id}`);
        return NextResponse.json({ ok: true, task });
      }

      case 'stitch-export': {
        if (!body.service_id || !body.prompt_section_id || !body.export_content) {
          return NextResponse.json(
            {
              error:
                'service_id, prompt_section_id, and export_content are required for stitch-export',
            },
            { status: 400 },
          );
        }

        // 1. Stitch export를 gfp_materials에 저장 (+ 스크린샷/공유 URL)
        const material = await createStitchMaterial({
          service_id: body.service_id,
          content: body.export_content,
        });

        // 1b. 스크린샷 + 공유 URL 저장 (있는 경우)
        if (body.screenshot_base64 || body.stitch_share_url) {
          await query(
            `UPDATE semo.gfp_materials SET screenshot_data = $1, stitch_share_url = $2 WHERE material_id = $3`,
            [body.screenshot_base64 ?? null, body.stitch_share_url ?? null, material.material_id],
          );
        }

        // 2. Phase 4에 결과 섹션 생성 (프롬프트 섹션 키에서 번호 추출)
        const promptNum = body.prompt_section_id.match(/\d+/)?.[0] ?? '01';
        const resultSection = await upsertSection({
          service_id: body.service_id,
          phase: 4,
          section_key: `stitch-result-${promptNum}`,
          title: `Stitch Export #${promptNum} — Tailwind CSS`,
          content: body.export_content,
          source: 'designclaw',
          status: 'pending-review',
        });

        // 3. Slack 알림 (스크린샷 포함)
        const stitchProject = await getProject(body.service_id);
        if (stitchProject) {
          const stitchSlackCtx = await resolveServiceSlackContext(body.service_id);
          if (stitchSlackCtx.channelId) {
            const screenshotUrl = body.screenshot_base64
              ? `${DASHBOARD_BASE_URL}/api/gfp/${body.service_id}/stitch-screenshot/${material.material_id}`
              : undefined;
            sendServiceStitchResultSlack({
              projectName: stitchProject.project_name,
              serviceId: body.service_id,
              sectionKey: `stitch-result-${promptNum}`,
              sectionTitle: `Stitch Export #${promptNum}`,
              screenshotUrl,
              stitchShareUrl: body.stitch_share_url,
              channelId: stitchSlackCtx.channelId,
            }).catch((err) => console.error('Stitch result Slack failed:', err));
          }
        }

        console.log(
          `[GFP Callback] Stitch export saved: material=${material.material_id}, section=${resultSection.section_id} by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true, material, section: resultSection });
      }

      case 'design-system-confirmed': {
        if (!body.service_id || !body.stitch_project_id || !body.stitch_design_system_id) {
          return NextResponse.json(
            {
              error:
                'service_id, stitch_project_id, and stitch_design_system_id are required for design-system-confirmed',
            },
            { status: 400 },
          );
        }

        // services.metadata에 Stitch 프로젝트/디자인시스템 ID 저장
        await query(
          `UPDATE semo.services
           SET metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'stitch_project_id', $2::text,
                  'stitch_design_system_id', $3::text
                )
           WHERE service_id::text LIKE $1 || '%'`,
          [body.service_id, body.stitch_project_id, body.stitch_design_system_id],
        );

        // Slack 알림
        const dsProject = await getProject(body.service_id);
        if (dsProject) {
          const dsSlackCtx = await resolveServiceSlackContext(body.service_id);
          if (dsSlackCtx.channelId) {
            postSlackMessage(
              dsSlackCtx.channelId,
              `[${dsProject.project_name}] 디자인 시스템이 확정되어 Stitch에 동기화되었습니다. Stitch에서 UI 생성이 진행됩니다.`,
            ).catch((err: unknown) => console.error('DS confirmed Slack failed:', err));
          }
        }

        console.log(
          `[GFP Callback] Design system confirmed: stitch_project=${body.stitch_project_id}, ds=${body.stitch_design_system_id} by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true });
      }

      case 'clarification-ready': {
        if (!body.service_id) {
          return NextResponse.json(
            { error: 'service_id is required for clarification-ready' },
            { status: 400 },
          );
        }
        const project = await getProject(body.service_id);
        if (!project) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Find all Phase 3 sections with Q&A items
        const allSections = await listSections(body.service_id, 3);
        const qaSections = allSections.filter(
          (s) => s.qa_items && Array.isArray(s.qa_items) && s.qa_items.length > 0,
        );

        if (qaSections.length === 0) {
          return NextResponse.json({ ok: true, message: 'No Q&A sections found for Phase 3' });
        }

        // Send Q&A to Slack
        const slackCtx = await resolveServiceSlackContext(body.service_id);
        if (slackCtx.channelId) {
          const threadMap = await sendServiceQASlack({
            projectName: project.project_name,
            serviceId: body.service_id,
            sections: qaSections.map((s) => ({
              section_id: s.section_id,
              section_key: s.section_key,
              title: s.title,
              qa_items:
                (typeof s.qa_items === 'string' ? JSON.parse(s.qa_items) : s.qa_items) ?? [],
            })),
            channelId: slackCtx.channelId,
          });

          // Save thread_ts on each section
          for (const [sectionId, threadTs] of threadMap.entries()) {
            await updateSectionSlackThread(sectionId, threadTs);
          }
        }

        console.log(
          `[GFP Callback] Clarification ready: ${qaSections.length} Q&A sections for ${project.project_name} by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true, qa_sections: qaSections.length });
      }

      case 'design-reference-analysis': {
        if (!body.service_id || !body.analysis) {
          return NextResponse.json(
            { error: 'service_id and analysis are required for design-reference-analysis' },
            { status: 400 },
          );
        }
        const refSection = await upsertSection({
          service_id: body.service_id,
          phase: 4,
          section_key: 'ref-analysis',
          title: 'Reference Analysis',
          content: body.analysis,
          source: 'designclaw',
          status: 'pending-review',
        });
        console.log(
          `[GFP Callback] Design reference analysis saved: section=${refSection.section_id} by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true, section: refSection });
      }

      case 'design-prototype': {
        if (!body.service_id || !body.screen_name || !body.html_content) {
          return NextResponse.json(
            {
              error: 'service_id, screen_name, and html_content are required for design-prototype',
            },
            { status: 400 },
          );
        }

        // Stitch 미사용 경고: stitch-result/stitch-prompt 없이 fallback 사용 시 로그
        const existingSections = await listSections(body.service_id, 4);
        const hasStitchAttempt = existingSections.some(
          (s) =>
            s.section_key.startsWith('stitch-result-') ||
            s.section_key.startsWith('stitch-prompt-'),
        );
        if (!hasStitchAttempt) {
          console.warn(
            `[GFP Callback] design-prototype fallback without any stitch attempt for ${body.service_id} by ${body.bot_id}`,
          );
        }

        // 1. gfp_materials에 프로토타입 저장
        const protoMaterial = await createStitchMaterial({
          service_id: body.service_id,
          content: body.html_content,
          material_type: 'design-prototype',
        });

        // 2. Phase 4에 impl-screen 섹션 생성 (camelCase→kebab-case 정규화)
        const normalizedName = body.screen_name
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const screenKey = `impl-screen-${normalizedName}`;
        const screenSection = await upsertSection({
          service_id: body.service_id,
          phase: 4,
          section_key: screenKey,
          title: `Screen: ${body.screen_name}`,
          content: `${body.description || ''}\n\n\`\`\`html\n${body.html_content}\n\`\`\``,
          source: 'designclaw',
          status: 'pending-review',
        });

        // 3. Stitch fallback Slack 알림 (Stitch 미시도 + 이 화면이 첫 fallback일 때)
        if (!hasStitchAttempt) {
          const existingImplScreens = existingSections.filter((s) =>
            s.section_key.startsWith('impl-screen-'),
          );
          const isFirstFallback = existingImplScreens.length === 0;
          const protoProject = await getProject(body.service_id);
          if (protoProject && isFirstFallback) {
            const protoSlackCtx = await resolveServiceSlackContext(body.service_id);
            if (protoSlackCtx.channelId) {
              sendServiceStitchFallbackSlack({
                projectName: protoProject.project_name,
                serviceId: body.service_id,
                screenName: body.screen_name,
                sectionKey: screenKey,
                reason: body.fallback_reason,
                botId: body.bot_id,
                channelId: protoSlackCtx.channelId,
              }).catch((err) => console.error('Stitch fallback Slack failed:', err));
            }
          }
        }

        console.log(
          `[GFP Callback] Design prototype saved: material=${protoMaterial.material_id}, section=${screenSection.section_id} by ${body.bot_id}${!hasStitchAttempt ? ' (FALLBACK)' : ''}`,
        );
        return NextResponse.json({ ok: true, material: protoMaterial, section: screenSection });
      }

      case 'feature-spec-ready': {
        if (!body.feature_id || !body.spec_content) {
          return NextResponse.json(
            { error: 'feature_id and spec_content are required for feature-spec-ready' },
            { status: 400 },
          );
        }

        // 1. feature metadata에 spec 저장
        const feature = await updateFeature(body.feature_id, {
          metadata: {
            spec: body.spec_content,
            spec_status: 'pending-review',
            spec_generated_at: new Date().toISOString(),
            estimated_effort: body.estimated_effort ?? null,
          },
        });
        if (!feature) {
          return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
        }

        // 2. Lifecycle pipeline: in-spec → spec-ready
        if (feature.metadata?.lifecycle_pipeline) {
          await transitionFeatureStatus(body.feature_id, 'spec-ready', {
            triggeredBy: body.bot_id,
            reason: 'Spec generated by bot, awaiting PO review',
            metadata: { estimated_effort: body.estimated_effort },
          }).catch((err) =>
            console.error('Lifecycle transition failed (in-spec → spec-ready):', err),
          );
        }

        // 3. project 조회 후 Slack 알림
        const specProject = await getProject(feature.service_id);
        if (specProject) {
          const specSlackCtx = await resolveServiceSlackContext(feature.service_id);
          if (specSlackCtx.channelId) {
            sendFeatureSpecReviewSlack({
              projectName: specProject.project_name,
              projectId: feature.service_id,
              featureId: body.feature_id,
              featureName: feature.name,
              specPreview: body.spec_content.slice(0, 300),
              estimatedEffort: body.estimated_effort,
              channelId: specSlackCtx.channelId,
            }).catch((err: unknown) => console.error('Feature spec review Slack failed:', err));
          }
        }

        console.log(`[GFP Callback] Feature spec ready: ${body.feature_id} by ${body.bot_id}`);
        return NextResponse.json({ ok: true, feature });
      }

      case 'feature-work-complete': {
        if (!body.feature_id) {
          return NextResponse.json(
            { error: 'feature_id is required for feature-work-complete' },
            { status: 400 },
          );
        }

        // 먼저 현재 feature 조회하여 pipeline 여부 확인
        const currentFeature = await query<import('@/types').ServiceFeature>(
          'SELECT * FROM semo.service_features WHERE feature_id = $1',
          [body.feature_id],
        );
        const isLifecyclePipeline = currentFeature.rows[0]?.metadata?.lifecycle_pipeline;

        if (isLifecyclePipeline) {
          // Lifecycle pipeline: in-dev → in-test (ReviewClaw 자동 디스패치)
          const transResult = await transitionFeatureStatus(body.feature_id, 'in-test', {
            triggeredBy: body.bot_id,
            reason: 'Implementation complete, dispatching test verification',
            metadata: {
              github_issue_state: 'closed',
              work_completed_at: new Date().toISOString(),
            },
          });
          if (!transResult.ok) {
            return NextResponse.json({ error: transResult.error }, { status: 400 });
          }
          console.log(
            `[GFP Callback] Feature work complete (pipeline → in-test): ${body.feature_id} by ${body.bot_id}`,
          );
          return NextResponse.json({ ok: true, feature: transResult.feature, nextStep: 'in-test' });
        }

        // Legacy: 바로 active
        const completedFeature = await updateFeature(body.feature_id, {
          status: 'active',
          metadata: {
            github_issue_state: 'closed',
            work_completed_at: new Date().toISOString(),
          },
        });
        if (!completedFeature) {
          return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
        }

        // Slack 알림
        const workProject = await getProject(completedFeature.service_id);
        if (workProject) {
          const workSlackCtx = await resolveServiceSlackContext(completedFeature.service_id);
          if (workSlackCtx.channelId) {
            sendFeatureWorkCompleteSlack({
              projectName: workProject.project_name,
              featureName: completedFeature.name,
              issueUrl: completedFeature.metadata?.github_issue_url as string | undefined,
              channelId: workSlackCtx.channelId,
            }).catch((err: unknown) => console.error('Feature work complete Slack failed:', err));
          }
        }

        console.log(`[GFP Callback] Feature work complete: ${body.feature_id} by ${body.bot_id}`);
        return NextResponse.json({ ok: true, feature: completedFeature });
      }

      case 'feature-test-complete': {
        if (!body.feature_id) {
          return NextResponse.json(
            { error: 'feature_id is required for feature-test-complete' },
            { status: 400 },
          );
        }

        if (body.test_passed) {
          // 테스트 통과 → in-test → active
          const activeResult = await transitionFeatureStatus(body.feature_id, 'active', {
            triggeredBy: body.bot_id,
            reason: 'Test verification passed',
            metadata: {
              test_report: body.test_report,
              test_completed_at: new Date().toISOString(),
            },
          });
          if (!activeResult.ok) {
            return NextResponse.json({ error: activeResult.error }, { status: 400 });
          }

          // Slack 완료 알림
          const testProject = await getProject(activeResult.feature!.service_id);
          if (testProject) {
            const testSlackCtx = await resolveServiceSlackContext(activeResult.feature!.service_id);
            if (testSlackCtx.channelId) {
              sendFeatureWorkCompleteSlack({
                projectName: testProject.project_name,
                featureName: activeResult.feature!.name,
                issueUrl: activeResult.feature!.metadata?.github_issue_url as string | undefined,
                channelId: testSlackCtx.channelId,
              }).catch((err: unknown) => console.error('Feature test complete Slack failed:', err));
            }
          }

          console.log(
            `[GFP Callback] Feature test passed → active: ${body.feature_id} by ${body.bot_id}`,
          );
          return NextResponse.json({ ok: true, feature: activeResult.feature });
        } else {
          // 테스트 실패 → in-test → in-dev (재작업)
          const redevResult = await transitionFeatureStatus(body.feature_id, 'in-dev', {
            triggeredBy: body.bot_id,
            reason: `Test failed: ${body.test_report ?? 'no details'}`,
            metadata: {
              test_report: body.test_report,
              test_failed_at: new Date().toISOString(),
            },
          });
          console.log(
            `[GFP Callback] Feature test failed → in-dev: ${body.feature_id} by ${body.bot_id}`,
          );
          return NextResponse.json({ ok: true, feature: redevResult.feature, retest: true });
        }
      }

      case 'feature-discovery-complete': {
        if (!body.session_id || !body.candidates) {
          return NextResponse.json(
            { error: 'session_id and candidates are required for feature-discovery-complete' },
            { status: 400 },
          );
        }

        const session = await updateDiscoverySession(body.session_id, {
          status: 'candidates_ready',
          candidates: body.candidates as unknown as import('@/types').DiscoveredFeature[],
          screenshots: body.screenshots ?? {},
        });

        if (!session) {
          return NextResponse.json({ error: 'Discovery session not found' }, { status: 404 });
        }

        // Slack 알림
        if (session.service_id) {
          const discProject = await getProject(session.service_id);
          if (discProject) {
            const discSlackCtx = await resolveServiceSlackContext(session.service_id);
            if (discSlackCtx.channelId) {
              const { sendFeatureDiscoveryCompleteSlack } = await import('@/lib/slack');
              sendFeatureDiscoveryCompleteSlack({
                projectName: discProject.project_name,
                projectId: session.service_id,
                sessionId: body.session_id,
                candidateCount: body.candidates.length,
                channelId: discSlackCtx.channelId,
              }).catch((err: unknown) => console.error('Discovery Slack failed:', err));
            }
          }
        }
        console.log(
          `[GFP Callback] Feature discovery complete: ${body.session_id}, ${body.candidates.length} candidates by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true, session });
      }

      case 'feature-spec-enriched': {
        if (!body.feature_id || !body.spec) {
          return NextResponse.json(
            { error: 'feature_id and spec are required for feature-spec-enriched' },
            { status: 400 },
          );
        }

        const { normalizeSpec, mergeSpecs } = await import('@/lib/feature-spec');
        const featureRes = await query<{ metadata: Record<string, unknown> }>(
          'SELECT metadata FROM semo.service_features WHERE feature_id = $1',
          [body.feature_id],
        );
        if (!featureRes.rows[0]) {
          return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
        }

        const existing = normalizeSpec(featureRes.rows[0].metadata?.spec);
        const incoming = body.spec as Partial<import('@/types').FeatureSpec>;
        const merged = mergeSpecs(existing, {
          ...incoming,
          spec_status: 'pending-review',
          spec_generated_by: body.bot_id,
          spec_generated_at: new Date().toISOString(),
        });

        const enrichedFeature = await updateFeature(body.feature_id, {
          metadata: { spec: merged },
        });

        // TODO: Slack 스펙 검토 알림 (Sprint 4에서 구현)
        console.log(`[GFP Callback] Feature spec enriched: ${body.feature_id} by ${body.bot_id}`);
        return NextResponse.json({ ok: true, feature: enrichedFeature });
      }

      case 'feature-conversation-complete': {
        if (!body.session_id) {
          return NextResponse.json(
            { error: 'session_id is required for feature-conversation-complete' },
            { status: 400 },
          );
        }

        await updateConversationSession(body.session_id, {
          status: 'reviewing',
          features:
            body.features as unknown as import('@/types').FeatureConversationSession['features'],
        });

        console.log(
          `[GFP Callback] Feature conversation complete: ${body.session_id}, ${body.features?.length ?? 0} features by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true, session_id: body.session_id });
      }

      case 'deploy-verification': {
        if (!body.service_id || body.infra_phase === undefined || !body.checks) {
          return NextResponse.json(
            { error: 'service_id, infra_phase, and checks are required for deploy-verification' },
            { status: 400 },
          );
        }

        const verification = await createDeployVerification({
          service_id: body.service_id,
          infra_phase: body.infra_phase,
          checks: body.checks,
          verified_by: body.bot_id,
        });

        console.log(
          `[GFP Callback] Deploy verification for ${body.service_id} infra-phase ${body.infra_phase}: ${verification.overall_status} by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true, verification });
      }

      case 'incubator-checkpoint': {
        if (!body.service_id || body.checkpoint === undefined || !body.status) {
          return NextResponse.json(
            { error: 'service_id, checkpoint, and status are required for incubator-checkpoint' },
            { status: 400 },
          );
        }

        const incProject = await getProject(body.service_id);
        if (!incProject) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const incMetadata: Record<string, any> = { ...(incProject.metadata || {}) };
        if (!incMetadata.incubator) {
          incMetadata.incubator = { version: 1, checkpoints: {} };
        }
        const inc = incMetadata.incubator;
        inc.current_cp = body.checkpoint;
        if (!inc.checkpoints) inc.checkpoints = {};
        inc.checkpoints[body.checkpoint] = {
          status: body.status,
          summary: body.summary || '',
          ...(body.status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
          ...(body.status === 'in-progress' ? { started_at: new Date().toISOString() } : {}),
        };
        inc.last_activity = `CP-${body.checkpoint}: ${body.summary || body.status}`;

        await query(
          'UPDATE semo.services SET metadata = $1, updated_at = NOW() WHERE service_id = $2',
          [JSON.stringify(incMetadata), body.service_id],
        );

        console.log(
          `[GFP Callback] Incubator CP-${body.checkpoint} ${body.status} for ${body.service_id} by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true, checkpoint: body.checkpoint, status: body.status });
      }

      case 'sandbox-section-submit': {
        if (!body.service_id || !body.section_key || !body.title || !body.content) {
          return NextResponse.json(
            { error: 'service_id, section_key, title, content are required' },
            { status: 400 },
          );
        }

        // run_generation 검증: stale callback 방지
        const sbProject = await getProject(body.service_id);
        if (!sbProject) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        const sbMeta = sbProject.metadata as Record<string, unknown>;
        const sbSandbox = sbMeta?.sandbox as import('@/types').SandboxConfig | undefined;
        if (!sbSandbox?.enabled || sbSandbox.mode !== 'live') {
          return NextResponse.json({ error: 'Not a live sandbox project' }, { status: 400 });
        }

        const existingSections = await listSections(body.service_id, body.phase, 'plan');
        const section = await upsertSection({
          service_id: body.service_id,
          phase: body.phase,
          track: 'plan',
          section_key: body.section_key,
          title: body.title,
          content: body.content,
          ordinal: existingSections.length,
          status: 'pending-review',
          source: body.bot_id as import('@/types').ServiceSectionSource,
        });

        const { incrementRunStat, incrementSandboxCost } = await import('@/lib/sandbox');
        await incrementRunStat(body.service_id, 'sections_generated');
        await incrementSandboxCost(body.service_id, 0.05);

        // Slack pending-review 알림
        const sbSlackCtx = await resolveServiceSlackContext(body.service_id);
        if (sbSlackCtx.channelId) {
          sendServiceSectionPendingReviewSlack({
            projectName: sbProject.project_name,
            serviceId: body.service_id,
            sectionId: section.section_id,
            sectionKey: section.section_key,
            sectionTitle: section.title,
            phase: section.phase,
            contentPreview: section.content.slice(0, 300),
            channelId: sbSlackCtx.channelId,
          }).catch((err) => console.error('Sandbox section Slack notify failed:', err));
        }

        console.log(
          `[GFP Callback] Sandbox section "${body.section_key}" (Phase ${body.phase}) submitted by ${body.bot_id}`,
        );
        return NextResponse.json({ ok: true, section });
      }

      default:
        return NextResponse.json(
          { error: `Unknown callback type: ${(body as CallbackPayload).type}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('GFP callback error:', error);
    return NextResponse.json({ error: 'Callback processing failed' }, { status: 500 });
  }
}
