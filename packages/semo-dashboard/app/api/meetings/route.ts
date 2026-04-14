import { NextRequest, NextResponse } from 'next/server';
import { listMeetings, createMeeting } from '@/lib/meeting';
import type { CreateMeetingInput } from '@/lib/meeting';

export const dynamic = 'force-dynamic';

/** GET /api/meetings — list all meetings */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const targetDomain = searchParams.get('target_domain') || undefined;
    const meetings = await listMeetings(limit, offset, targetDomain);
    return NextResponse.json({ meetings });
  } catch (error) {
    console.error('Failed to list meetings:', error);
    return NextResponse.json({ error: 'Failed to list meetings' }, { status: 500 });
  }
}

/** POST /api/meetings — create a new meeting (metadata only) */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateMeetingInput;

    if (!body.title || !body.meeting_type || !body.attendees) {
      return NextResponse.json(
        { error: 'title, meeting_type, and attendees are required' },
        { status: 400 },
      );
    }

    const meeting = await createMeeting(body);
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    console.error('Failed to create meeting:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
