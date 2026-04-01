'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AudioUploader from '@/components/meetings/AudioUploader';
import TranscriptionProgress from '@/components/meetings/TranscriptionProgress';
import SpeakerMapper from '@/components/meetings/SpeakerMapper';
import TranscriptPreview from '@/components/meetings/TranscriptPreview';
import AudioPlayer from '@/components/meetings/AudioPlayer';
import GenerationPreview from '@/components/meetings/GenerationPreview';
import type { AudioPlayerHandle } from '@/components/meetings/AudioPlayer';
import type { VitoUtterance } from '@/lib/vito';
import type { KBEntry } from '@/lib/meeting-generate';

const REGULAR_ATTENDEES = [
  '@reus-jeon', '@garden92', '@Roki-Noh', '@kyago', '@Yeomsoyam',
];

const STEPS = ['Meeting Info', 'Upload Audio', 'Transcription', 'Speaker Mapping', 'Preview & Generate'];

type MeetingType = 'regular' | 'adhoc';
type AdhocSubtype = 'client' | 'internal' | 'external' | 'workshop';

export default function NewMeetingPage() {
  const router = useRouter();
  const playerRef = useRef<AudioPlayerHandle>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Meeting info
  const [meetingType, setMeetingType] = useState<MeetingType>('regular');
  const [title, setTitle] = useState('');
  const [adhocSubtype, setAdhocSubtype] = useState<AdhocSubtype>('internal');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState<string[]>(REGULAR_ATTENDEES);

  // Step 2-3: Upload & transcription
  const [meetingId, setMeetingId] = useState<string | null>(null);

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

  // Step 1: Create meeting
  async function handleCreateMeeting() {
    setError(null);
    const finalTitle = meetingType === 'regular' ? getRegularTitle() : title;
    if (!finalTitle.trim()) { setError('Please enter a meeting title'); return; }

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          meeting_type: meetingType,
          adhoc_subtype: meetingType === 'adhoc' ? adhocSubtype : undefined,
          meeting_date: meetingDate,
          attendees,
        }),
      });
      if (!res.ok) throw new Error('Failed to create meeting');
      const data = await res.json();
      setMeetingId(data.meeting.meeting_id);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    }
  }

  const handleUploadComplete = useCallback(() => { setStep(2); }, []);

  const handleTranscriptionComplete = useCallback(async (data: { utteranceCount: number; speakers: number[] }) => {
    setSpeakers(data.speakers);
    if (meetingId) {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (res.ok) {
        const meeting = await res.json();
        setUtterances(meeting.meeting.raw_transcript || []);
      }
    }
    setStep(3);
  }, [meetingId]);

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
    // Save to DB in background
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
  async function handleConfirmGenerate(editedData: { discussion: { title: string; body: string }; kbEntries: KBEntry[] }) {
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

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${step >= 4 && audioUrl ? 'pb-20' : ''}`}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Meeting</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1">
            <div className={`
              flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0
              ${i < step ? 'bg-green-600 text-white' :
                i === step ? 'bg-blue-600 text-white' :
                'bg-gray-200 dark:bg-gray-700 text-gray-500'}
            `}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs truncate ${i === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meeting Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => { setMeetingType('regular'); setAttendees(REGULAR_ATTENDEES); }}
                className={`flex-1 py-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                  meetingType === 'regular'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                정기 회고 & 회의
              </button>
              <button
                onClick={() => { setMeetingType('adhoc'); setAttendees([]); }}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 고객사 미팅, 아키텍처 워크숍..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subtype</label>
                <select value={adhocSubtype} onChange={(e) => setAdhocSubtype(e.target.value as AdhocSubtype)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                  <option value="internal">Internal</option>
                  <option value="client">Client</option>
                  <option value="external">External</option>
                  <option value="workshop">Workshop</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
            <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
          </div>

          {meetingType === 'regular' && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Auto-generated title:</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{getRegularTitle()}</p>
            </div>
          )}

          <button onClick={handleCreateMeeting}
            className="w-full py-3 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors">
            Next: Upload Audio
          </button>
        </div>
      )}

      {/* Step 2: Audio Upload */}
      {step === 1 && meetingId && (
        <AudioUploader meetingId={meetingId} onUploadComplete={handleUploadComplete} onError={(err) => setError(err)} />
      )}

      {/* Step 3: Transcription Progress */}
      {step === 2 && meetingId && (
        <TranscriptionProgress meetingId={meetingId} onComplete={handleTranscriptionComplete} onError={(err) => setError(err)} />
      )}

      {/* Step 4: Speaker Mapping */}
      {step === 3 && (
        <SpeakerMapper
          utterances={utterances} speakers={speakers}
          audioUrl={audioUrl}
          onConfirm={handleSpeakerConfirm} saving={savingSpeakers}
        />
      )}

      {/* Step 5: Preview & Generate */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Transcript with click-to-play and inline speaker editing */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Transcript</h3>
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
                ${previewing
                  ? 'bg-blue-400 text-white cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              `}
            >
              {previewing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing with AI...
                </span>
              ) : (
                'Preview Meeting Notes'
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
        <AudioPlayer
          ref={playerRef}
          src={audioUrl}
          onTimeUpdate={setActiveTimeMs}
        />
      )}
    </div>
  );
}
