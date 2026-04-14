import { NextRequest, NextResponse } from 'next/server';
import { getAudioData } from '@/lib/meeting';

export const dynamic = 'force-dynamic';

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

/** GET /api/meetings/[id]/audio — serve audio from DB with range support */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const audio = await getAudioData(id);

    if (!audio) {
      return NextResponse.json({ error: 'No audio file' }, { status: 404 });
    }

    const ext = audio.filename.split('.').pop()?.toLowerCase() || 'mp3';
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = Buffer.isBuffer(audio.data) ? audio.data : Buffer.from(audio.data);
    const fileSize = fileBuffer.byteLength;

    // Support Range requests for seeking
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = match[2] ? parseInt(match[2]) : fileSize - 1;
        const chunk = new Uint8Array(fileBuffer.subarray(start, end + 1));

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

    return new NextResponse(new Uint8Array(fileBuffer), {
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
