import { NextRequest, NextResponse } from 'next/server';
import { getMeeting, updateSpeakerMap } from '@/lib/meeting';

export const dynamic = 'force-dynamic';

/** POST /api/meetings/[id]/speakers — save speaker name mapping */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { speakerMap } = await request.json() as { speakerMap: Record<string, string> };

    if (!speakerMap || typeof speakerMap !== 'object') {
      return NextResponse.json(
        { error: 'speakerMap is required (e.g. {"0":"홍길동","1":"김철수"})' },
        { status: 400 }
      );
    }

    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meeting.transcription_status !== 'completed') {
      return NextResponse.json(
        { error: 'Transcription must be completed before mapping speakers' },
        { status: 400 }
      );
    }

    await updateSpeakerMap(id, speakerMap);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save speaker mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save speaker mapping' },
      { status: 500 }
    );
  }
}
