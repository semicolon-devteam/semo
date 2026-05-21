import { NextRequest, NextResponse } from 'next/server';
import { transcribe } from '@/lib/stt';
import { getMeeting, updateTranscriptionStarted } from '@/lib/meeting';

export const dynamic = 'force-dynamic';

// Allow up to 5 minutes for large audio uploads
export const maxDuration = 300;

const ALLOWED_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'mp4',
  'wav',
  'flac',
  'ogg',
  'webm',
  'amr',
  'mkv',
  'mov',
]);

/** POST /api/meetings/upload — upload audio and start STT transcription */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const meetingId = formData.get('meetingId') as string | null;

    if (!file || !meetingId) {
      return NextResponse.json({ error: 'file and meetingId are required' }, { status: 400 });
    }

    // Validate meeting exists
    const meeting = await getMeeting(meetingId);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Validate file type (MediaRecorder may produce files with generated names)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'webm';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${ext}. Supported: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const audioFileName = `${meetingId}.${ext}`;

    // Build callback URL for STT service to notify on completion
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const callbackUrl = `${baseUrl}/api/meetings/${meetingId}/transcription-callback`;

    // Send to STT service
    const transcribeId = await transcribe(buffer, file.name, callbackUrl);

    // Update meeting with transcription info + audio stored in DB
    await updateTranscriptionStarted(meetingId, transcribeId, file.name, audioFileName, buffer);

    return NextResponse.json({
      meetingId,
      transcribeId,
      status: 'transcribing',
    });
  } catch (error) {
    console.error('Failed to upload audio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
