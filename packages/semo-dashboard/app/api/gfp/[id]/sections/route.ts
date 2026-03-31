import { NextRequest, NextResponse } from 'next/server';
import {
  listSections,
  upsertSection,
  updateSectionStatus,
  updateSectionContent,
  updateProject,
  writebackPhaseToKB,
  getProject,
} from '@/lib/gfp';
import { dispatchRegeneration } from '@/lib/gfp-bot';
import { publishPhaseToGitHub } from '@/lib/gfp-github';
import { sendGfpRejectionSlack, sendGfpPhaseCompletedSlack, resolveGfpSlackContext } from '@/lib/slack';

export const dynamic = 'force-dynamic';

const PHASE_NAMES: Record<number, string> = {
  0: 'constitution',
  1: 'discovery',
  2: 'prd',
  3: 'clarification',
  4: 'epic',
  5: 'functional-spec',
  6: 'technical-plan',
  7: 'task-breakdown',
  8: 'handoff',
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
    const { phase, section_key, title, content, ordinal, status, source } = body;

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
    const { section_id, action, status, reviewer_note, content } = body;

    if (!section_id) {
      return NextResponse.json({ error: 'section_id is required' }, { status: 400 });
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

    const section = await updateSectionStatus(section_id, status, reviewer_note);
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Resolve Slack context once (channel + owner)
    const slackCtx = await resolveGfpSlackContext(id);

    // On rejection, dispatch PlanClaw regeneration + Slack notification
    if (status === 'rejected' && reviewer_note) {
      dispatchRegeneration(section_id, section.content, reviewer_note, section.phase).catch((err) =>
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

        // Check if entire phase is now approved
        const allSections = await listSections(id, section.phase);
        const allApproved = allSections.length > 0 && allSections.every((s) => s.status === 'approved');

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
          if (nextPhase <= 8) {
            await updateProject(id, { current_phase: nextPhase });
          }

          // Slack 알림: PlanClaw + 담당자에 다음 Phase 작업 유도
          sendGfpPhaseCompletedSlack({
            projectName: project.project_name,
            gfpId: id,
            completedPhase: section.phase,
            nextPhase: nextPhase <= 8 ? nextPhase : null,
            channelId: slackCtx.channelId,
            ownerSlackId: slackCtx.ownerSlackId,
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
