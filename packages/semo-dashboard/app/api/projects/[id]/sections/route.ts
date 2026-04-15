import { NextRequest, NextResponse } from 'next/server';
import {
  listSections,
  upsertSection,
  updateSectionContent,
  answerQAItems,
  deleteSection,
  moveSection,
} from '@/lib/service';
import type { ServiceTrack } from '@/types';
import { executeSectionAction } from '@/lib/service-actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const phaseParam = searchParams.get('phase');
    const trackParam = searchParams.get('track') as ServiceTrack | null;
    const phase = phaseParam !== null ? parseInt(phaseParam, 10) : undefined;
    const sections = await listSections(id, phase, trackParam ?? undefined);
    return NextResponse.json(sections);
  } catch (error) {
    console.error('Service list error:', error);
    return NextResponse.json({ error: 'Failed to list sections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { phase, section_key, title, content, ordinal, status, source, qa_items, track } = body;

    if (phase === undefined || !section_key || !title) {
      return NextResponse.json(
        { error: 'phase, section_key, and title are required' },
        { status: 400 },
      );
    }

    // Phase 4 디자인 섹션 content 형식 경고
    let warning: string | undefined;
    if (phase === 4 && content) {
      const hexCount = (content.match(/#[0-9a-fA-F]{6}/g) || []).length;
      if (section_key.startsWith('ds-color') && hexCount >= 3 && !content.includes('{')) {
        warning =
          '⚠️ ds-color 섹션 content가 구조화된 형식이 아닙니다. ColorPaletteSummary 파싱이 불가능할 수 있습니다.';
      }
      if (
        (section_key.includes('component') || section_key.startsWith('impl-')) &&
        !content.includes('```html') &&
        !content.includes('<div')
      ) {
        warning = '⚠️ 컴포넌트/구현 섹션에 HTML 코드블록이 없습니다. 시각적 프리뷰가 불가능합니다.';
      }
    }

    const section = await upsertSection({
      service_id: id,
      phase,
      section_key,
      title,
      content: content ?? '',
      ordinal,
      status,
      source,
      qa_items,
      track: track ?? 'plan',
    });
    return NextResponse.json({ ...section, warning }, { status: 201 });
  } catch (error) {
    console.error('Service upsert error:', error);
    return NextResponse.json({ error: 'Failed to upsert section' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { section_id, action, status, reviewer_note, content, qa_answers } = body;

    if (!section_id) {
      return NextResponse.json({ error: 'section_id is required' }, { status: 400 });
    }

    // Answer Q&A items
    if (action === 'answer-qa' && qa_answers) {
      const section = await answerQAItems(section_id, qa_answers, 'dashboard', id);
      if (!section) {
        return NextResponse.json(
          { error: 'Section not found or has no Q&A items' },
          { status: 404 },
        );
      }
      return NextResponse.json(section);
    }

    // Move section to different phase/track
    if (action === 'move') {
      const { target_phase, target_track } = body;
      if (target_phase === undefined) {
        return NextResponse.json(
          { error: 'target_phase is required for move action' },
          { status: 400 },
        );
      }
      try {
        const moved = await moveSection(section_id, id, target_phase, target_track);
        if (!moved) {
          return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }
        return NextResponse.json(moved);
      } catch (err) {
        if (err instanceof Error && err.message === 'CONFLICT') {
          return NextResponse.json(
            { error: 'Target phase already has a section with the same key' },
            { status: 409 },
          );
        }
        throw err;
      }
    }

    // Update content
    if (action === 'update-content' && content !== undefined) {
      const section = await updateSectionContent(section_id, content, status, id);
      return NextResponse.json(section);
    }

    // Approve or reject — delegate to shared action layer
    if (!status || !['approved', 'rejected', 'pending-review', 'draft'].includes(status)) {
      return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
    }

    if (status === 'approved' || status === 'rejected') {
      const result = await executeSectionAction({
        serviceId: id,
        sectionId: section_id,
        action: status === 'approved' ? 'approve' : 'reject',
        reviewerNote: reviewer_note,
        actionSource: 'dashboard',
      });

      if (result.error) {
        const httpStatus = result.error.includes('not found') ? 404 : 400;
        return NextResponse.json({ error: result.error }, { status: httpStatus });
      }

      if (result.warning) {
        return NextResponse.json({ ...result.section, warning: result.warning });
      }

      return NextResponse.json(result.section);
    }

    // Status transitions that don't need full action logic (draft, pending-review)
    const { updateSectionStatus } = await import('@/lib/service');
    const section = await updateSectionStatus(section_id, status, reviewer_note, id);
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    return NextResponse.json(section);
  } catch (error) {
    console.error('Service status error:', error);
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('section_id');

    if (!sectionId) {
      return NextResponse.json(
        { error: 'section_id query parameter is required' },
        { status: 400 },
      );
    }

    const deleted = await deleteSection(sectionId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json(deleted);
  } catch (error) {
    console.error('Service delete error:', error);
    return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 });
  }
}
