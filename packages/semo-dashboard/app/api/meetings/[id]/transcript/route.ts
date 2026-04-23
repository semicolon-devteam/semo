import { NextRequest, NextResponse } from 'next/server';
import { getMeeting } from '@/lib/meeting';

export const dynamic = 'force-dynamic';

/** GET /api/meetings/[id]/transcript — mapped transcript for bot skill access */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const transcript = meeting.mapped_transcript ?? null;
    const speakerMap = meeting.speaker_map ?? {};

    return NextResponse.json({
      meeting_id: meeting.meeting_id,
      title: meeting.title,
      meeting_date: meeting.meeting_date,
      transcript,
      speaker_map: speakerMap,
      has_transcript: !!transcript,
    });
  } catch (error) {
    console.error('Transcript fetch failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch transcript' },
      { status: 500 },
    );
  }
}
