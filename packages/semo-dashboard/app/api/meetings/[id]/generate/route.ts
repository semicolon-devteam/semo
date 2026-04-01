import { NextRequest, NextResponse } from 'next/server';
import { getMeeting, updateGenerationStarted, updateGenerationCompleted, updateGenerationFailed } from '@/lib/meeting';
import { generateMeetingNotes } from '@/lib/meeting-generate';
import type { EditedGenerationInput } from '@/lib/meeting-generate';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST /api/meetings/[id]/generate — create Discussion + KB + Slack from edited preview data */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    if (!meeting.mapped_transcript) {
      return NextResponse.json(
        { error: 'Speaker mapping must be completed before generating notes' },
        { status: 400 }
      );
    }

    // Accept optional edited data from preview
    let editedData: EditedGenerationInput | undefined;
    try {
      const body = await request.json();
      if (body.discussion && body.kbEntries) {
        editedData = body as EditedGenerationInput;
      }
    } catch {
      // No body or invalid JSON — will auto-generate
    }

    await updateGenerationStarted(id);

    const result = await generateMeetingNotes(meeting, editedData);

    await updateGenerationCompleted(id, result.discussionUrl, result.discussionNumber, result.result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Meeting generation failed:', error);
    await updateGenerationFailed(id, error instanceof Error ? error.message : 'Unknown error').catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
