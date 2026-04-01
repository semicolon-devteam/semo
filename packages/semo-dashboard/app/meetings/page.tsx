'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Meeting } from '@/lib/meeting';

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending:       { label: 'Pending',       color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  uploading:     { label: 'Uploading',     color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  transcribing:  { label: 'Transcribing',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse' },
  completed:     { label: 'Transcribed',   color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failed:        { label: 'Failed',        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  generating:    { label: 'Generating',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 animate-pulse' },
};

function MeetingStatusBadge({ meeting }: { meeting: Meeting }) {
  // Show generation status if transcription is done
  if (meeting.generation_status === 'completed') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
        Done
      </span>
    );
  }
  if (meeting.generation_status === 'generating') {
    const s = STATUS_BADGE.generating;
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>;
  }

  const s = STATUS_BADGE[meeting.transcription_status] ?? STATUS_BADGE.pending;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>;
}

export default function MeetingsListPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/meetings')
      .then((r) => r.ok ? r.json() : { meetings: [] })
      .then((data) => setMeetings(data.meetings ?? []))
      .catch(() => setMeetings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Meetings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Meeting transcription & notes — {meetings.length} meetings
          </p>
        </div>
        <Link
          href="/meetings/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Meeting
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No meetings yet</p>
          <p className="text-sm">Click &quot;+ New Meeting&quot; to start transcribing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Link
              key={m.meeting_id}
              href={`/meetings/${m.meeting_id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono w-24 shrink-0">
                    {m.meeting_date}
                  </span>
                  <h2 className="text-base font-medium text-gray-900 dark:text-white truncate">
                    {m.title}
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {m.meeting_type === 'regular' ? '정기' : '비정기'}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.discussion_url && (
                    <span className="text-xs text-gray-400">#{m.discussion_number}</span>
                  )}
                  <MeetingStatusBadge meeting={m} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
