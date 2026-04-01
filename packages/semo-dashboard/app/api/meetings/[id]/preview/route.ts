import { NextRequest, NextResponse } from 'next/server';
import { getMeeting } from '@/lib/meeting';
import { previewMeetingNotes } from '@/lib/meeting-generate';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST /api/meetings/[id]/preview — dry-run: LLM analysis without creating anything */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    if (!meeting.mapped_transcript) {
      return NextResponse.json(
        { error: 'Speaker mapping must be completed first' },
        { status: 400 }
      );
    }

    const preview = await previewMeetingNotes(meeting);
    return NextResponse.json(preview);
  } catch (error) {
    console.error('Preview failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    );
  }
}
