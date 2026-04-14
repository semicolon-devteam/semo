import { NextRequest, NextResponse } from 'next/server';
import { getMeeting, updateTranscriptionCompleted, updateTranscriptionFailed } from '@/lib/meeting';
import { VitoUtterance } from '@/lib/stt';

export const dynamic = 'force-dynamic';

const STT_API_KEY = process.env.STT_API_KEY || '';

/** POST /api/meetings/[id]/transcription-callback — receive STT completion callback */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (STT_API_KEY) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${STT_API_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { id } = await params;
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meeting.transcription_status === 'completed' || meeting.transcription_status === 'failed') {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const body = (await request.json()) as {
      job_id: string;
      status: 'completed' | 'failed';
      utterances?: VitoUtterance[];
      error?: string;
    };

    if (body.status === 'completed' && body.utterances) {
      await updateTranscriptionCompleted(id, body.utterances);
    } else if (body.status === 'failed') {
      await updateTranscriptionFailed(id, body.error || 'STT transcription failed');
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Transcription callback error:', error);
    return NextResponse.json({ error: 'Callback processing failed' }, { status: 500 });
  }
}
