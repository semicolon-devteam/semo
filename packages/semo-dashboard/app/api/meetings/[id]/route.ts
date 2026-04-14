import { NextRequest, NextResponse } from 'next/server';
import { getMeeting, updateMeeting, deleteMeeting } from '@/lib/meeting';
import type { UpdateMeetingInput } from '@/lib/meeting';

export const dynamic = 'force-dynamic';

/** GET /api/meetings/[id] — meeting detail */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('Failed to get meeting:', error);
    return NextResponse.json({ error: 'Failed to get meeting' }, { status: 500 });
  }
}

/** PATCH /api/meetings/[id] — update meeting metadata */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateMeetingInput;
    const meeting = await updateMeeting(id, body);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('Failed to update meeting:', error);
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
  }
}

/** DELETE /api/meetings/[id] — delete meeting */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteMeeting(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete meeting:', error);
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
  }
}
