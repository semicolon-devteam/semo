/**
 * Meeting DB Operations
 *
 * CRUD operations for semo.meetings table.
 */

import { query } from './db';
import type { VitoUtterance } from './vito';

export interface Meeting {
  meeting_id: string;
  title: string;
  meeting_type: 'regular' | 'adhoc';
  adhoc_subtype: 'client' | 'internal' | 'external' | 'workshop' | null;
  meeting_date: string;
  attendees: string[];
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
}

export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const result = await query<Meeting>(
    `INSERT INTO semo.meetings (title, meeting_type, adhoc_subtype, meeting_date, attendees)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [
      input.title,
      input.meeting_type,
      input.adhoc_subtype ?? null,
      input.meeting_date ?? new Date().toISOString().slice(0, 10),
      JSON.stringify(input.attendees),
    ]
  );
  return result.rows[0];
}

export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  const result = await query<Meeting>(
    'SELECT * FROM semo.meetings WHERE meeting_id = $1',
    [meetingId]
  );
  return result.rows[0] ?? null;
}

export async function listMeetings(limit = 50, offset = 0): Promise<Meeting[]> {
  const result = await query<Meeting>(
    'SELECT * FROM semo.meetings ORDER BY meeting_date DESC, created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

export async function updateTranscriptionStarted(
  meetingId: string,
  vitoTranscribeId: string,
  audioOriginalName: string,
  audioFileName?: string,
  audioData?: Buffer
): Promise<void> {
  if (audioData) {
    await query(
      `UPDATE semo.meetings
       SET vito_transcribe_id = $2, audio_filename = $3,
           audio_data = $4,
           transcription_status = 'transcribing', updated_at = NOW()
       WHERE meeting_id = $1`,
      [meetingId, vitoTranscribeId, audioFileName ?? audioOriginalName, audioData]
    );
  } else {
    await query(
      `UPDATE semo.meetings
       SET vito_transcribe_id = $2, audio_filename = $3,
           transcription_status = 'transcribing', updated_at = NOW()
       WHERE meeting_id = $1`,
      [meetingId, vitoTranscribeId, audioFileName ?? audioOriginalName]
    );
  }
}

export async function getAudioData(meetingId: string): Promise<{ data: Buffer; filename: string } | null> {
  const result = await query<{ audio_data: Buffer; audio_filename: string }>(
    'SELECT audio_data, audio_filename FROM semo.meetings WHERE meeting_id = $1 AND audio_data IS NOT NULL',
    [meetingId]
  );
  const row = result.rows[0];
  if (!row?.audio_data) return null;
  return { data: row.audio_data, filename: row.audio_filename };
}

export async function updateTranscriptionCompleted(
  meetingId: string,
  utterances: VitoUtterance[]
): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET raw_transcript = $2::jsonb, transcription_status = 'completed', updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, JSON.stringify(utterances)]
  );
}

export async function updateTranscriptionFailed(
  meetingId: string,
  error: string
): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET transcription_status = 'failed', transcription_error = $2, updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, error]
  );
}

export async function updateSpeakerMap(
  meetingId: string,
  speakerMap: Record<string, string>
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
    [meetingId, JSON.stringify(speakerMap), mappedLines.join('\n')]
  );
}

export async function updateGenerationStarted(meetingId: string): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET generation_status = 'generating', updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId]
  );
}

export async function updateGenerationCompleted(
  meetingId: string,
  discussionUrl: string,
  discussionNumber: number,
  result: { decisions: number; actions: number; kpi: number }
): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET discussion_url = $2, discussion_number = $3,
         generation_status = 'completed', generation_result = $4::jsonb, updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, discussionUrl, discussionNumber, JSON.stringify(result)]
  );
}

export async function updateGenerationFailed(
  meetingId: string,
  error: string
): Promise<void> {
  await query(
    `UPDATE semo.meetings
     SET generation_status = 'failed', generation_error = $2, updated_at = NOW()
     WHERE meeting_id = $1`,
    [meetingId, error]
  );
}
