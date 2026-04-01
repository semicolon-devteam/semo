'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import TranscriptPreview from '@/components/meetings/TranscriptPreview';
import AudioPlayer from '@/components/meetings/AudioPlayer';
import type { AudioPlayerHandle } from '@/components/meetings/AudioPlayer';
import type { Meeting } from '@/lib/meeting';

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const playerRef = useRef<AudioPlayerHandle>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTimeMs, setActiveTimeMs] = useState(0);

  useEffect(() => {
    fetch(`/api/meetings/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setMeeting(data?.meeting ?? null))
      .catch(() => setMeeting(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSpeakerChange(spkId: number, newName: string) {
    if (!meeting) return;
    const newMap = { ...meeting.speaker_map, [String(spkId)]: newName };
    setMeeting({ ...meeting, speaker_map: newMap });
    fetch(`/api/meetings/${id}/speakers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speakerMap: newMap }),
    }).catch(() => {});
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${id}/generate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Regeneration failed');
      }
      const data = await res.json();
      setMeeting((prev) => prev ? {
        ...prev,
        discussion_url: data.discussionUrl,
        discussion_number: data.discussionNumber,
        generation_status: 'completed' as const,
        generation_result: data.result,
      } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-500">Meeting not found.</p>
        <Link href="/meetings" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Back to meetings</Link>
      </div>
    );
  }

  const hasAudio = !!meeting.audio_filename;
  const audioUrl = `/api/meetings/${id}/audio`;

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${hasAudio ? 'pb-20' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/meetings" className="text-sm text-blue-600 hover:underline mb-2 inline-block">&larr; Meetings</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{meeting.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{meeting.meeting_date}</span>
            <span>{meeting.meeting_type === 'regular' ? '정기' : '비정기'}</span>
            {meeting.adhoc_subtype && <span className="capitalize">{meeting.adhoc_subtype}</span>}
          </div>
        </div>
        {meeting.discussion_url && (
          <a href={meeting.discussion_url} target="_blank" rel="noopener noreferrer"
            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Discussion #{meeting.discussion_number}
          </a>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Transcription</p>
          <p className="text-sm font-medium capitalize">{meeting.transcription_status}</p>
          {meeting.audio_filename && <p className="text-xs text-gray-400 mt-1 truncate">{meeting.audio_filename}</p>}
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Speakers</p>
          <p className="text-sm font-medium">
            {Object.keys(meeting.speaker_map).length > 0
              ? Object.values(meeting.speaker_map).join(', ')
              : 'Not mapped'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Generation</p>
          <p className="text-sm font-medium capitalize">{meeting.generation_status}</p>
          {meeting.generation_result && (
            <p className="text-xs text-gray-400 mt-1">
              {meeting.generation_result.decisions}d {meeting.generation_result.actions}a {meeting.generation_result.kpi}k
            </p>
          )}
        </div>
      </div>

      {/* Attendees */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attendees</h3>
        <div className="flex flex-wrap gap-2">
          {meeting.attendees.map((a: string) => (
            <span key={a} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">{a}</span>
          ))}
        </div>
      </div>

      {/* Transcript with click-to-play + inline speaker editing */}
      {meeting.raw_transcript && meeting.raw_transcript.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Transcript
            <span className="text-xs font-normal text-gray-400 ml-2">Click text to play, click speaker name to edit</span>
          </h3>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <TranscriptPreview
              utterances={meeting.raw_transcript}
              speakerMap={meeting.speaker_map}
              activeTimeMs={activeTimeMs}
              onPlayAt={hasAudio ? (ms) => playerRef.current?.playAt(ms) : undefined}
              onSpeakerChange={handleSpeakerChange}
              editable
            />
          </div>
        </div>
      )}

      {/* Regenerate button */}
      {meeting.mapped_transcript && (
        <button onClick={handleRegenerate} disabled={regenerating}
          className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${
            regenerating ? 'bg-purple-400 text-white cursor-wait' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}>
          {regenerating ? 'Regenerating...' : (meeting.generation_status === 'completed' ? 'Regenerate Meeting Notes' : 'Generate Meeting Notes')}
        </button>
      )}

      {/* Audio Player */}
      {hasAudio && (
        <AudioPlayer ref={playerRef} src={audioUrl} onTimeUpdate={setActiveTimeMs} />
      )}
    </div>
  );
}
