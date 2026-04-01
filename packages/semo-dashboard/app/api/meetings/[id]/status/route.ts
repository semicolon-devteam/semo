import { NextRequest, NextResponse } from 'next/server';
import { getMeeting, updateTranscriptionCompleted, updateTranscriptionFailed } from '@/lib/meeting';
import { getTranscribeStatus } from '@/lib/vito';

export const dynamic = 'force-dynamic';

/** GET /api/meetings/[id]/status — poll VITO transcription status */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // If already completed or failed, return DB state
    if (meeting.transcription_status === 'completed') {
      return NextResponse.json({
        status: 'completed',
        utteranceCount: meeting.raw_transcript?.length ?? 0,
        speakers: [...new Set(meeting.raw_transcript?.map(u => u.spk) ?? [])],
      });
    }

    if (meeting.transcription_status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: meeting.transcription_error,
      });
    }

    if (!meeting.vito_transcribe_id) {
      return NextResponse.json({ status: meeting.transcription_status });
    }

    // Poll VITO
    const result = await getTranscribeStatus(meeting.vito_transcribe_id);

    if (result.status === 'completed' && result.utterances) {
      await updateTranscriptionCompleted(id, result.utterances);
      const speakers = [...new Set(result.utterances.map(u => u.spk))];
      return NextResponse.json({
        status: 'completed',
        utteranceCount: result.utterances.length,
        speakers,
      });
    }

    if (result.status === 'failed') {
      await updateTranscriptionFailed(id, 'VITO transcription failed');
      return NextResponse.json({
        status: 'failed',
        error: 'VITO transcription failed',
      });
    }

    return NextResponse.json({ status: 'transcribing' });
  } catch (error) {
    console.error('Failed to check status:', error);
    return NextResponse.json(
      { error: 'Failed to check transcription status' },
      { status: 500 }
    );
  }
}
