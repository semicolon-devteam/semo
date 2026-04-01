-- Migration 003: Meeting transcription & automation
-- Creates semo.meetings table for VITO STT + meeting notes pipeline

CREATE TABLE IF NOT EXISTS semo.meetings (
  meeting_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  meeting_type         TEXT NOT NULL CHECK (meeting_type IN ('regular', 'adhoc')),
  adhoc_subtype        TEXT CHECK (adhoc_subtype IN ('client', 'internal', 'external', 'workshop')),
  meeting_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  attendees            JSONB NOT NULL DEFAULT '[]',

  -- Audio & Transcription
  audio_filename       TEXT,
  audio_duration_ms    BIGINT,
  vito_transcribe_id   TEXT,
  transcription_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (transcription_status IN ('pending', 'uploading', 'transcribing', 'completed', 'failed')),
  transcription_error  TEXT,
  raw_transcript       JSONB,

  -- Speaker Mapping
  speaker_map          JSONB NOT NULL DEFAULT '{}',

  -- Output
  mapped_transcript    TEXT,
  discussion_url       TEXT,
  discussion_number    INTEGER,
  generation_status    TEXT NOT NULL DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
  generation_error     TEXT,
  generation_result    JSONB,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON semo.meetings (meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_transcription_status ON semo.meetings (transcription_status);
