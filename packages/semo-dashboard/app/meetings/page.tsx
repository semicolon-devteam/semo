'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Meeting } from '@/lib/meeting';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: {
    label: '대기',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
  uploading: {
    label: '업로드 중',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  transcribing: {
    label: '녹취 중',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse',
  },
  completed: {
    label: '녹취 완료',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  failed: {
    label: '실패',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  generating: {
    label: '생성 중',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 animate-pulse',
  },
};

function MeetingStatusBadge({ meeting }: { meeting: Meeting }) {
  if (meeting.generation_status === 'completed') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
        완료
      </span>
    );
  }
  if (meeting.generation_status === 'generating') {
    const s = STATUS_BADGE.generating;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
    );
  }
  const s = STATUS_BADGE[meeting.transcription_status] ?? STATUS_BADGE.pending;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
  );
}

export default function MeetingsListPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/meetings')
      .then((r) => (r.ok ? r.json() : { meetings: [] }))
      .then((data) => setMeetings(data.meetings ?? []))
      .catch(() => setMeetings([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e: React.MouseEvent, meetingId: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${title}" 회의를 삭제하시겠습니까?`)) return;
    setDeletingId(meetingId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.meeting_id !== meetingId));
      }
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  }

  function handleContinue(e: React.MouseEvent, meetingId: string) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/meetings/new?id=${meetingId}`);
  }

  const isPending = (m: Meeting) =>
    m.transcription_status === 'pending' && m.generation_status === 'pending';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">회의</h1>
          <p className="text-gray-600 dark:text-gray-400">
            회의 녹취 및 메모 — {meetings.length}건
          </p>
        </div>
        <Link
          href="/meetings/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + 새 회의
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">아직 회의가 없습니다</p>
          <p className="text-sm">&quot;+ 새 회의&quot;를 클릭하여 녹취를 시작하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Link
              key={m.meeting_id}
              href={isPending(m) ? `/meetings/new?id=${m.meeting_id}` : `/meetings/${m.meeting_id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono shrink-0">
                    {formatDate(m.meeting_date)}
                  </span>
                  <h2 className="text-base font-medium text-gray-900 dark:text-white truncate">
                    {m.title || '(제목 없음)'}
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {m.meeting_type === 'regular' ? '정기' : '비정기'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {m.discussion_url && (
                    <span className="text-xs text-gray-400">#{m.discussion_number}</span>
                  )}
                  <MeetingStatusBadge meeting={m} />
                  {isPending(m) && (
                    <button
                      onClick={(e) => handleContinue(e, m.meeting_id)}
                      className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 font-medium transition-colors"
                    >
                      이어서
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, m.meeting_id, m.title)}
                    disabled={deletingId === m.meeting_id}
                    className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors p-0.5"
                    title="삭제"
                  >
                    {deletingId === m.meeting_id ? (
                      <span className="w-4 h-4 block border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
