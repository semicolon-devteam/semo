'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AudioUploader from '@/components/meetings/AudioUploader';
import TranscriptionProgress from '@/components/meetings/TranscriptionProgress';
import SpeakerMapper from '@/components/meetings/SpeakerMapper';
import TranscriptPreview from '@/components/meetings/TranscriptPreview';
import AudioPlayer from '@/components/meetings/AudioPlayer';
import GenerationPreview from '@/components/meetings/GenerationPreview';
import type { AudioPlayerHandle } from '@/components/meetings/AudioPlayer';
import type { VitoUtterance } from '@/lib/stt';
import type { KBEntry } from '@/lib/meeting-generate';
import type { Meeting } from '@/lib/meeting';

const REGULAR_ATTENDEES = ['@reus-jeon', '@garden92', '@Roki-Noh', '@kyago', '@Yeomsoyam'];

const STEPS = ['회의 정보', '오디오 업로드', '녹취', '화자 매핑', '미리보기 & 생성'];

type MeetingType = 'regular' | 'adhoc';
type AdhocSubtype = 'client' | 'internal' | 'external' | 'workshop';

interface ServiceOption {
  project_name: string;
  service_domain: string | null;
}

function determineStep(m: Meeting): number {
  if (m.generation_status === 'completed') return 4;
  if (m.mapped_transcript) return 4;
  if (Object.keys(m.speaker_map).length > 0 && m.raw_transcript?.length) return 4;
  if (m.raw_transcript?.length) return 3;
  if (m.transcription_status === 'transcribing') return 2;
  if (m.audio_filename) return 2;
  return 1;
}

export default function NewMeetingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <NewMeetingContent />
    </Suspense>
  );
}

function NewMeetingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('id');

  const playerRef = useRef<AudioPlayerHandle>(null);
  const [step, setStep] = useState(resumeId ? -1 : 0);
  const [error, setError] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(!!resumeId);

  // Step 1: Meeting info
  const [meetingType, setMeetingType] = useState<MeetingType>('regular');
  const [title, setTitle] = useState('');
  const [adhocSubtype, setAdhocSubtype] = useState<AdhocSubtype>('internal');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState<string[]>(REGULAR_ATTENDEES);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [services, setServices] = useState<ServiceOption[]>([]);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ServiceOption[]) => setServices(data))
      .catch(() => {});
  }, []);

  // Step 2-3: Upload & transcription
  const [meetingId, setMeetingId] = useState<string | null>(resumeId);

  // Step 4: Speaker mapping
  const [utterances, setUtterances] = useState<VitoUtterance[]>([]);
  const [speakers, setSpeakers] = useState<number[]>([]);
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});
  const [savingSpeakers, setSavingSpeakers] = useState(false);

  // Step 5: Preview & Generate
  const [activeTimeMs, setActiveTimeMs] = useState<number>(0);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{
    discussion: { title: string; body: string };
    kbEntries: KBEntry[];
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  const audioUrl = meetingId ? `/api/meetings/${meetingId}/audio` : undefined;

  // Resume: load existing meeting data
  useEffect(() => {
    if (!resumeId) return;
    fetch(`/api/meetings/${resumeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const m: Meeting | null = data?.meeting;
        if (!m) {
          setError('회의를 찾을 수 없습니다');
          setStep(0);
          setMeetingId(null);
          return;
        }
        setMeetingId(m.meeting_id);
        setMeetingType(m.meeting_type);
        setTitle(m.title);
        if (m.adhoc_subtype) setAdhocSubtype(m.adhoc_subtype);
        setMeetingDate(m.meeting_date ? new Date(m.meeting_date).toISOString().slice(0, 10) : '');
        setAttendees(m.attendees || []);
        setSelectedDomain(m.target_domain || '');
        if (m.raw_transcript?.length) {
          setUtterances(m.raw_transcript);
          const spks = [...new Set(m.raw_transcript.map((u) => u.spk))].sort();
          setSpeakers(spks);
        }
        if (m.speaker_map && Object.keys(m.speaker_map).length > 0) {
          setSpeakerMap(m.speaker_map);
        }
        setStep(determineStep(m));
      })
      .catch(() => {
        setError('회의 로딩 실패');
        setStep(0);
      })
      .finally(() => setResumeLoading(false));
  }, [resumeId]);

  // Auto-generate regular meeting title
  function getRegularTitle(): string {
    const d = new Date(meetingDate);
    const month = d.getMonth() + 1;
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const weekNum = Math.ceil((d.getDate() + firstDay) / 7);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const totalWeeks = Math.ceil((lastDay + firstDay) / 7);
    return `[${month}월 ${weekNum}/${totalWeeks}] 정기 회고 & 회의`;
  }

  // Step 1: Create or update meeting
  async function handleCreateMeeting() {
    setError(null);
    const finalTitle = meetingType === 'regular' ? getRegularTitle() : title;
    if (!finalTitle.trim()) {
      setError('회의 제목을 입력해주세요');
      return;
    }

    try {
      if (meetingId) {
        const res = await fetch(`/api/meetings/${meetingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: finalTitle,
            meeting_type: meetingType,
            adhoc_subtype: meetingType === 'adhoc' ? adhocSubtype : null,
            meeting_date: meetingDate,
            attendees,
            target_domain: selectedDomain || null,
          }),
        });
        if (!res.ok) throw new Error('Failed to update meeting');
        setStep(1);
      } else {
        const res = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: finalTitle,
            meeting_type: meetingType,
            adhoc_subtype: meetingType === 'adhoc' ? adhocSubtype : undefined,
            meeting_date: meetingDate,
            attendees,
            target_domain: selectedDomain || undefined,
          }),
        });
        if (!res.ok) throw new Error('Failed to create meeting');
        const data = await res.json();
        setMeetingId(data.meeting.meeting_id);
        setStep(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    }
  }

  async function handleDelete() {
    if (!meetingId) return;
    if (!confirm('이 회의를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' });
      if (res.ok) router.push('/meetings');
    } catch {
      /* ignore */
    }
  }

  const handleUploadComplete = useCallback(() => {
    setStep(2);
  }, []);

  const handleTranscriptionComplete = useCallback(
    async (data: { utteranceCount: number; speakers: number[] }) => {
      setSpeakers(data.speakers);
      if (meetingId) {
        const res = await fetch(`/api/meetings/${meetingId}`);
        if (res.ok) {
          const meeting = await res.json();
          setUtterances(meeting.meeting.raw_transcript || []);
        }
      }
      setStep(3);
    },
    [meetingId],
  );

  // Step 4: Speaker mapping confirmed
  async function handleSpeakerConfirm(map: Record<string, string>) {
    if (!meetingId) return;
    setSavingSpeakers(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/speakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerMap: map }),
      });
      if (!res.ok) throw new Error('Failed to save speaker mapping');
      setSpeakerMap(map);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingSpeakers(false);
    }
  }

  // Inline speaker change (from TranscriptPreview)
  async function handleSpeakerChange(spkId: number, newName: string) {
    if (!meetingId) return;
    const newMap = { ...speakerMap, [String(spkId)]: newName };
    setSpeakerMap(newMap);
    fetch(`/api/meetings/${meetingId}/speakers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speakerMap: newMap }),
    }).catch(() => {});
  }

  // Step 5a: Run preview (dry-run)
  async function handlePreview() {
    if (!meetingId) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/preview`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Preview failed');
      }
      const data = await res.json();
      setPreviewData({ discussion: data.discussion, kbEntries: data.kbEntries });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  // Step 5b: Confirm generation with edited data
  async function handleConfirmGenerate(editedData: {
    discussion: { title: string; body: string };
    kbEntries: KBEntry[];
  }) {
    if (!meetingId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }
      const data = await res.json();
      router.push(`/meetings/${meetingId}`);
      if (data.discussionUrl) window.open(data.discussionUrl, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setGenerating(false);
    }
  }

  if (resumeLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`container mx-auto px-4 py-8 max-w-4xl ${step >= 4 && audioUrl ? 'pb-20' : ''}`}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {resumeId ? '회의 이어서 진행' : '새 회의'}
        </h1>
        {meetingId && (
          <button
            onClick={handleDelete}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            삭제
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => {
                if (i < step) setStep(i);
              }}
              disabled={i >= step}
              className={`
              flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors
              ${
                i < step
                  ? 'bg-green-600 text-white cursor-pointer hover:bg-green-700'
                  : i === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }
            `}
            >
              {i < step ? '✓' : i + 1}
            </button>
            <span
              className={`text-xs truncate ${i === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Meeting Info */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              회의 유형
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMeetingType('regular');
                  setAttendees(REGULAR_ATTENDEES);
                }}
                className={`flex-1 py-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                  meetingType === 'regular'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                정기 회고 & 회의
              </button>
              <button
                onClick={() => {
                  setMeetingType('adhoc');
                  setAttendees([]);
                }}
                className={`flex-1 py-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                  meetingType === 'adhoc'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                비정기 회의
              </button>
            </div>
          </div>

          {meetingType === 'adhoc' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  제목
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 고객사 미팅, 아키텍처 워크숍..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  세부 유형
                </label>
                <select
                  value={adhocSubtype}
                  onChange={(e) => setAdhocSubtype(e.target.value as AdhocSubtype)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="internal">내부</option>
                  <option value="client">고객사</option>
                  <option value="external">외부</option>
                  <option value="workshop">워크숍</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              날짜
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Optional: 연관 서비스 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              연관 서비스 <span className="text-gray-400 font-normal">(선택사항)</span>
            </label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">없음</option>
              {services
                .filter((s) => s.service_domain)
                .map((s) => (
                  <option key={s.service_domain} value={s.service_domain!}>
                    {s.project_name} ({s.service_domain})
                  </option>
                ))}
            </select>
          </div>

          {meetingType === 'regular' && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">자동 생성 제목:</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {getRegularTitle()}
              </p>
            </div>
          )}

          <button
            onClick={handleCreateMeeting}
            className="w-full py-3 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            {meetingId ? '수정 후 다음' : '다음: 오디오 업로드'}
          </button>
        </div>
      )}

      {/* Step 2: Audio Upload */}
      {step === 1 && meetingId && (
        <AudioUploader
          meetingId={meetingId}
          onUploadComplete={handleUploadComplete}
          onError={(err) => setError(err)}
        />
      )}

      {/* Step 3: Transcription Progress */}
      {step === 2 && meetingId && (
        <TranscriptionProgress
          meetingId={meetingId}
          onComplete={handleTranscriptionComplete}
          onError={(err) => setError(err)}
        />
      )}

      {/* Step 4: Speaker Mapping */}
      {step === 3 && (
        <SpeakerMapper
          utterances={utterances}
          speakers={speakers}
          audioUrl={audioUrl}
          onConfirm={handleSpeakerConfirm}
          saving={savingSpeakers}
        />
      )}

      {/* Step 5: Preview & Generate */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Transcript with click-to-play and inline speaker editing */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">녹취록</h3>
            <TranscriptPreview
              utterances={utterances}
              speakerMap={speakerMap}
              activeTimeMs={activeTimeMs}
              onPlayAt={(ms) => playerRef.current?.playAt(ms)}
              onSpeakerChange={handleSpeakerChange}
              editable
            />
          </div>

          {/* Preview / Generation area */}
          {!previewData ? (
            <button
              onClick={handlePreview}
              disabled={previewing}
              className={`
                w-full py-4 rounded-lg text-base font-medium transition-colors
                ${
                  previewing
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              `}
            >
              {previewing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI 분석 중...
                </span>
              ) : (
                '회의록 미리보기'
              )}
            </button>
          ) : (
            <GenerationPreview
              discussion={previewData.discussion}
              kbEntries={previewData.kbEntries}
              onConfirm={handleConfirmGenerate}
              generating={generating}
            />
          )}
        </div>
      )}

      {/* Audio Player — shown in step 4+ when audio is available */}
      {step >= 4 && audioUrl && (
        <AudioPlayer ref={playerRef} src={audioUrl} onTimeUpdate={setActiveTimeMs} />
      )}
    </div>
  );
}
