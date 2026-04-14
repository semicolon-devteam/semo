/**
 * Meeting DB Operations
 *
 * CRUD operations for semo.meetings table.
 */

import { query } from './db';
import type { VitoUtterance } from './stt';

export interface Meeting {
  meeting_id: string;
  title: string;
  meeting_type: 'regular' | 'adhoc';
  adhoc_subtype: 'client' | 'internal' | 'external' | 'workshop' | null;
  meeting_date: string;
  attendees: string[];
  service_id: string | null;
  audio_filename: string | null;
  audio_duration_ms: number | null;
  vito_transcribe_id: string | null;
  transcription_status: 'pending' | 'uploading' | 'transcribing' | 'completed' | 'failed';
  transcription_error: string | null;
  raw_transcript: VitoUtterance[] | null;
  speaker_map: Record<string, string>;
  mapped_transcript: string | null;
  discussion_url: string | null;
  discussion_number: number | null;
  generation_status: 'pending' | 'generating' | 'completed' | 'failed';
  generation_error: string | null;
  generation_result: { decisions: number; actions: number; kpi: number } | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMeetingInput {
  title: string;
  meeting_type: 'regular' | 'adhoc';
  adhoc_subtype?: 'client' | 'internal' | 'external' | 'workshop';
  meeting_date?: string;
  attendees: string[];
  service_id?: string;
}

export interface UpdateMeetingInput {
  title?: string;
  meeting_type?: 'regular' | 'adhoc';
  adhoc_subtype?: 'client' | 'internal' | 'external' | 'workshop' | null;
  meeting_date?: string;
  attendees?: string[];
  service_id?: string | null;
}

export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const result = await query<Meeting>(
    `INSERT INTO semo.meetings (title, meeting_type, adhoc_subtype, meeting_date, attendees, service_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING *`,
    [
      input.title,
      input.meeting_type,
      input.adhoc_subtype ?? null,
      input.meeting_date ?? new Date().toISOString().slice(0, 10),
      JSON.stringify(input.attendees),
      input.service_id ?? null,
    ],
  );
  return result.rows[0];
}

// All columns except audio_data (binary, up to ~8MB per row)
const MEETING_COLS = `meeting_id, title, meeting_type, adhoc_subtype, meeting_date, attendees, service_id,
  audio_filename, audio_duration_ms, vito_transcribe_id, transcription_status, transcription_error,
  raw_transcript, speaker_map, mapped_transcript, discussion_url, discussion_number,
  generation_status, generation_error, generation_result, created_at, updated_at`;

export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  const result = await query<Meeting>(
    `SELECT ${MEETING_COLS} FROM semo.meetings WHERE meeting_id = $1`,
    [meetingId],
  );
  return result.rows[0] ?? null;
}

export async function listMeetings(limit = 50, offset = 0): Promise<Meeting[]> {
  const result = await query<Meeting>(
    `SELECT ${MEETING_COLS} FROM semo.meetings ORDER BY meeting_date DESC, created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
}

export async function updateTranscriptionStarted(
  meetingId: string,
  vitoTranscribeId: string,
  audioOriginalName: string,
  audioFileName?: string,
  audioData?: Buffer,
): Promise<void> {
  if (audioData) {
    await query(
      `UPDATE semo.meetings
       SET vito_transcribe_id = $2, audio_filename = $3,
           audio_data = $4,
           transcription_status = 'transcribing', updated_at = NOW()
       WHERE meeting_id = $1`,
      [meetingId, vitoTranscribeId, audioFileName ?? audioOriginalName, audioData],
    );
  } else {
    await query(
      `UPDATE semo.meetings
       SET vito_transcribe_id = $2, audio_filename = $3,
           transcription_status = 'transcribing', updated_at = NOW()
       WHERE meeting_id = $1`,
      [meetingId, vitoTranscribeId, audioFileName ?? audioOriginalName],
    );
  }
}

export async function getAudioData(
  meetingId: string,
): Promise<{ data: Buffer; filename: string } | null> {
  const result = await query<{ audio_data: Buffer; audio_filename: string }>(
    'SELECT audio_data, audio_filename FROM semo.meetings WHERE meeting_id = $1 AND audio_data IS NOT NULL',
    [meetingId],
  );
  const row = result.rows[0];
  if (!row?.audio_data) return null;
  return { data: row.audio_data, filename: row.audio_filename };
}

export async function updateTranscriptionCompleted(
  meetingId: string,
  utterances: VitoUtterance[],
): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET raw_transcript = $2::jsonb, transcription_status = 'completed', updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, JSON.stringify(utterances)],
  );
}

export async function updateTranscriptionFailed(meetingId: string, error: string): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET transcription_status = 'failed', transcription_error = $2, updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, error],
  );
}

export async function updateSpeakerMap(
  meetingId: string,
  speakerMap: Record<string, string>,
): Promise<void> {
  // Build mapped transcript from raw_transcript + speakerMap
  const meeting = await getMeeting(meetingId);
  if (!meeting?.raw_transcript) {
    throw new Error('No raw transcript available');
  }

  const mappedLines = meeting.raw_transcript.map((u) => {
    const speakerName = speakerMap[String(u.spk)] || `Speaker ${u.spk}`;
    return `${speakerName}: ${u.msg}`;
  });

  await query(
    `UPDATE semo.meetings
     SET speaker_map = $2::jsonb, mapped_transcript = $3, updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, JSON.stringify(speakerMap), mappedLines.join('\n')],
  );
}

export async function updateGenerationStarted(meetingId: string): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET generation_status = 'generating', updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId],
  );
}

export async function updateGenerationCompleted(
  meetingId: string,
  discussionUrl: string,
  discussionNumber: number,
  result: { decisions: number; actions: number; kpi: number },
): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET discussion_url = $2, discussion_number = $3,
         generation_status = 'completed', generation_result = $4::jsonb, updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, discussionUrl, discussionNumber, JSON.stringify(result)],
  );
}

export async function updateGenerationFailed(meetingId: string, error: string): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET generation_status = 'failed', generation_error = $2, updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, error],
  );
}

export async function updateMeeting(
  meetingId: string,
  input: UpdateMeetingInput,
): Promise<Meeting | null> {
  const sets: string[] = [];
  const vals: unknown[] = [meetingId];
  let idx = 2;

  if (input.title !== undefined) {
    sets.push(`title = $${idx++}`);
    vals.push(input.title);
  }
  if (input.meeting_type !== undefined) {
    sets.push(`meeting_type = $${idx++}`);
    vals.push(input.meeting_type);
  }
  if (input.adhoc_subtype !== undefined) {
    sets.push(`adhoc_subtype = $${idx++}`);
    vals.push(input.adhoc_subtype);
  }
  if (input.meeting_date !== undefined) {
    sets.push(`meeting_date = $${idx++}`);
    vals.push(input.meeting_date);
  }
  if (input.attendees !== undefined) {
    sets.push(`attendees = $${idx++}::jsonb`);
    vals.push(JSON.stringify(input.attendees));
  }
  if (input.service_id !== undefined) {
    sets.push(`service_id = $${idx++}`);
    vals.push(input.service_id);
  }

  if (sets.length === 0) return getMeeting(meetingId);

  sets.push('updated_at = NOW()');
  const result = await query<Meeting>(
    `UPDATE semo.meetings SET ${sets.join(', ')} WHERE meeting_id = $1 RETURNING ${MEETING_COLS}`,
    vals,
  );
  return result.rows[0] ?? null;
}

export async function deleteMeeting(meetingId: string): Promise<boolean> {
  const result = await query('DELETE FROM semo.meetings WHERE meeting_id = $1', [meetingId]);
  return (result.rowCount ?? 0) > 0;
}
