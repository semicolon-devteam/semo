import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { getMeeting } from '@/lib/meeting';

export const dynamic = 'force-dynamic';

const AUDIO_DIR = '/tmp/semo-meetings';

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  amr: 'audio/amr',
};

/** GET /api/meetings/[id]/audio — serve stored audio file with range support */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);

    if (!meeting?.audio_filename) {
      return NextResponse.json({ error: 'No audio file' }, { status: 404 });
    }

    // audio_filename stores just the filename like "{meetingId}.m4a"
    const audioPath = path.join(AUDIO_DIR, meeting.audio_filename);

    // Check file exists
    try {
      await stat(audioPath);
    } catch {
      return NextResponse.json({ error: 'Audio file not found on disk' }, { status: 404 });
    }

    const ext = meeting.audio_filename.split('.').pop()?.toLowerCase() || 'mp3';
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fileBuffer = await readFile(audioPath);
    const fileSize = fileBuffer.byteLength;

    // Support Range requests for seeking
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = match[2] ? parseInt(match[2]) : fileSize - 1;
        const chunk = fileBuffer.subarray(start, end + 1);

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': String(chunk.byteLength),
            'Accept-Ranges': 'bytes',
          },
        });
      }
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Failed to serve audio:', error);
    return NextResponse.json({ error: 'Failed to serve audio' }, { status: 500 });
  }
}
