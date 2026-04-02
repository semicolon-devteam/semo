import { NextRequest, NextResponse } from 'next/server';
import {
  listSections,
  upsertSection,
  updateSectionStatus,
  updateSectionContent,
  updateProject,
  writebackPhaseToKB,
  writebackPhaseProgressToKB,
  getProject,
  answerQAItems,
  checkDesignStepAdvance,
} from '@/lib/gfp';
import type { GfpQAItem } from '@/types';
import { dispatchRegeneration } from '@/lib/gfp-bot';
import { publishPhaseToGitHub } from '@/lib/gfp-github';
import { sendGfpRejectionSlack, sendGfpPhaseCompletedSlack, sendDesignSystemSlack, resolveGfpSlackContext } from '@/lib/slack';
import { parseColors } from '@/lib/design-system-parser';

export const dynamic = 'force-dynamic';

const PHASE_NAMES: Record<number, string> = {
  0: 'constitution',
  1: 'discovery',
  2: 'prd',
  3: 'clarification',
  4: 'design-system',
  5: 'epic',
  6: 'functional-spec',
  7: 'technical-plan',
  8: 'task-breakdown',
  9: 'handoff',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const phaseParam = searchParams.get('phase');
    const phase = phaseParam !== null ? parseInt(phaseParam, 10) : undefined;
    const sections = await listSections(id, phase);
    return NextResponse.json(sections);
  } catch (error) {
    console.error('GFP sections list error:', error);
    return NextResponse.json({ error: 'Failed to list sections' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { phase, section_key, title, content, ordinal, status, source, qa_items } = body;

    if (phase === undefined || !section_key || !title) {
      return NextResponse.json(
        { error: 'phase, section_key, and title are required' },
        { status: 400 }
      );
    }

    const section = await upsertSection({
      gfp_id: id,
      phase,
      section_key,
      title,
      content: content ?? '',
      ordinal,
      status,
      source,
      qa_items,
    });
    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    console.error('GFP section upsert error:', error);
    return NextResponse.json({ error: 'Failed to upsert section' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { section_id, action, status, reviewer_note, content, qa_answers } = body;

    if (!section_id) {
      return NextResponse.json({ error: 'section_id is required' }, { status: 400 });
    }

    // Answer Q&A items
    if (action === 'answer-qa' && qa_answers) {
      const section = await answerQAItems(section_id, qa_answers, 'dashboard');
      if (!section) {
        return NextResponse.json({ error: 'Section not found or has no Q&A items' }, { status: 404 });
      }
      return NextResponse.json(section);
    }

    // Update content
    if (action === 'update-content' && content !== undefined) {
      const section = await updateSectionContent(section_id, content, status);
      return NextResponse.json(section);
    }

    // Approve or reject
    if (!status || !['approved', 'rejected', 'pending-review', 'draft'].includes(status)) {
      return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
    }

    // Guard: cannot approve Q&A section with unanswered questions
    if (status === 'approved') {
      const checkRes = await listSections(id);
      const target = checkRes.find((s) => s.section_id === section_id);
      if (target?.qa_items) {
        const items: GfpQAItem[] = (typeof target.qa_items === 'string'
          ? JSON.parse(target.qa_items)
          : target.qa_items) as GfpQAItem[];
        const unanswered = items.filter((q) => !q.answer);
        if (unanswered.length > 0) {
          return NextResponse.json(
            { error: `Cannot approve: ${unanswered.length} unanswered question(s)` },
            { status: 400 }
          );
        }
      }
    }

    const section = await updateSectionStatus(section_id, status, reviewer_note);
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Resolve Slack context once (channel + owner)
    const slackCtx = await resolveGfpSlackContext(id);

    // On rejection, dispatch PlanClaw regeneration + Slack notification
    if (status === 'rejected' && reviewer_note) {
      const proj = await getProject(id);
      dispatchRegeneration(
        section_id, section.content, reviewer_note, section.phase,
        (proj?.metadata as Record<string, unknown>) ?? undefined
      ).catch((err) =>
        console.error('PlanClaw dispatch failed:', err)
      );

      // Slack 알림: 프로젝트 채널에 rejection 통지
      const project = await getProject(id);
      if (project) {
        sendGfpRejectionSlack({
          projectName: project.project_name,
          gfpId: id,
          sectionId: section_id,
          sectionKey: section.section_key,
          sectionTitle: section.title,
          phase: section.phase,
          reviewerNote: reviewer_note,
          channelId: slackCtx.channelId,
        }).catch((err) => console.error('Slack rejection notify failed:', err));
      }
    }

    // Check if entire phase is now approved → KB write-back + GitHub publish
    if (status === 'approved') {
      const project = await getProject(id);
      if (project) {
        const phaseName = PHASE_NAMES[section.phase] ?? `phase-${section.phase}`;

        if (project.service_domain) {
          writebackPhaseToKB(id, section.phase, project.service_domain, phaseName).catch((err) =>
            console.error('KB write-back failed:', err)
          );
        }

        // Phase 4: check design sub-step advancement
        if (section.phase === 4) {
          checkDesignStepAdvance(id).catch((err) =>
            console.error('Design step advance check failed:', err)
          );
        }

        // Check if entire phase is now approved
        const allSections = await listSections(id, section.phase);
        const allApproved = allSections.length > 0 && allSections.every((s) => s.status === 'approved');

        // Phase 4 ds-* 섹션 전체 승인 시 Slack 디자인 시스템 알림
        if (section.phase === 4 && section.section_key.startsWith('ds-')) {
          const allDs = allSections.filter((s) => s.section_key.startsWith('ds-'));
          const allDsApproved = allDs.length > 0 && allDs.every((s) => s.status === 'approved');
          if (allDsApproved) {
            const colorSection = allDs.find((s) => s.section_key.startsWith('ds-color'));
            const colorGroups = colorSection ? parseColors(colorSection.content) : [];
            const primaryColors = colorGroups.flatMap((g) => {
              const shade400 = g.shades.find((s) => s.shade === 400) ?? g.shades[Math.floor(g.shades.length / 2)];
              return shade400 ? [{ name: `${g.name} 400`, hex: shade400.hex }] : [];
            });

            sendDesignSystemSlack({
              projectName: project.project_name,
              gfpId: id,
              channelId: slackCtx.channelId,
              primaryColors,
            }).catch((err) => console.error('Design system Slack failed:', err));
          }
        }

        if (allApproved) {
          // Publish to GitHub docs repo
          const phaseContent = allSections
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((s) => `## ${s.title}\n\n${s.content}`)
            .join('\n\n---\n\n');

          publishPhaseToGitHub(project.project_name, phaseName, phaseContent)
            .catch((err) => console.error('GitHub publish failed:', err));

          // Phase 자동 진행: current_phase 증가
          const nextPhase = section.phase + 1;
          if (nextPhase <= 9) {
            await updateProject(id, { current_phase: nextPhase });
          }

          // KB phase progress 기록
          if (project.service_domain) {
            writebackPhaseProgressToKB(
              id, project.service_domain, section.phase,
              nextPhase <= 9 ? nextPhase : null
            ).catch((err) => console.error('KB phase progress failed:', err));
          }

          // Slack 알림: PlanClaw + 담당자에 다음 Phase 작업 유도
          sendGfpPhaseCompletedSlack({
            projectName: project.project_name,
            gfpId: id,
            completedPhase: section.phase,
            nextPhase: nextPhase <= 9 ? nextPhase : null,
            channelId: slackCtx.channelId,
            ownerSlackId: slackCtx.ownerSlackId,
            serviceDomain: project.service_domain ?? undefined,
            metadata: project.metadata as Record<string, unknown>,
          }).catch((err) => console.error('Phase complete Slack failed:', err));
        }
      }
    }

    return NextResponse.json(section);
  } catch (error) {
    console.error('GFP section status error:', error);
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
  }
}
