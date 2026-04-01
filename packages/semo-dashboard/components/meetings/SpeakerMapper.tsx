'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { VitoUtterance } from '@/lib/vito';

interface TeamMember {
  domain: string;
  name: string;
  role: string;
}

interface SpeakerMapperProps {
  utterances: VitoUtterance[];
  speakers: number[];
  audioUrl?: string;  // URL to audio file for playback
  onConfirm: (speakerMap: Record<string, string>) => void;
  saving?: boolean;
}

export default function SpeakerMapper({ utterances, speakers, audioUrl, onConfirm, saving }: SpeakerMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    speakers.forEach((spk) => { initial[String(spk)] = ''; });
    return initial;
  });
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [isCustom, setIsCustom] = useState<Record<string, boolean>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [playingSpk, setPlayingSpk] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load team members from KB
  useEffect(() => {
    fetch('/api/meetings/team')
      .then((r) => r.ok ? r.json() : { members: [] })
      .then((data) => setTeamMembers(data.members ?? []))
      .catch(() => setTeamMembers([]))
      .finally(() => setTeamLoading(false));
  }, []);

  // Get sample utterances per speaker (with timestamps for playback)
  const samplesBySpk = useMemo(() => {
    const samples: Record<number, { msg: string; start_at: number; duration: number }[]> = {};
    for (const u of utterances) {
      if (!samples[u.spk]) samples[u.spk] = [];
      if (samples[u.spk].length < 3) {
        samples[u.spk].push({ msg: u.msg, start_at: u.start_at, duration: u.duration });
      }
    }
    return samples;
  }, [utterances]);

  const teamNames = useMemo(() => teamMembers.map(m => m.name), [teamMembers]);

  const allMapped = speakers.every(
    (spk) => mapping[String(spk)] && mapping[String(spk)].trim() !== ''
  );

  function handleSelect(spk: string, value: string) {
    if (value === '__custom__') {
      setIsCustom((prev) => ({ ...prev, [spk]: true }));
      setMapping((prev) => ({ ...prev, [spk]: customNames[spk] || '' }));
    } else {
      setIsCustom((prev) => ({ ...prev, [spk]: false }));
      setMapping((prev) => ({ ...prev, [spk]: value }));
    }
  }

  function handleCustomName(spk: string, name: string) {
    setCustomNames((prev) => ({ ...prev, [spk]: name }));
    setMapping((prev) => ({ ...prev, [spk]: name }));
  }

  // Audio playback for a specific utterance segment
  const playSample = useCallback((startMs: number, durationMs: number, spk: number) => {
    if (!audioUrl || !audioRef.current) return;

    // Stop any previous playback
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    audioRef.current.pause();

    const startSec = startMs / 1000;
    const durationSec = Math.min(durationMs / 1000, 10); // max 10 seconds

    audioRef.current.currentTime = startSec;
    audioRef.current.play().catch(() => {});
    setPlayingSpk(spk);

    playTimeoutRef.current = setTimeout(() => {
      audioRef.current?.pause();
      setPlayingSpk(null);
    }, durationSec * 1000);
  }, [audioUrl]);

  const stopPlayback = useCallback(() => {
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    audioRef.current?.pause();
    setPlayingSpk(null);
  }, []);

  function handleConfirm() {
    stopPlayback();
    const cleanMap: Record<string, string> = {};
    for (const [spk, name] of Object.entries(mapping)) {
      cleanMap[spk] = name.trim();
    }
    onConfirm(cleanMap);
  }

  return (
    <div className="space-y-6">
      {/* Hidden audio element for playback */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />}

      <p className="text-sm text-gray-600 dark:text-gray-400">
        VITO가 {speakers.length}명의 화자를 감지했습니다. 각 화자에 이름을 매핑해주세요.
      </p>

      {teamLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading team members...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {speakers.sort().map((spk) => (
            <div
              key={spk}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-hidden"
            >
              <div className="flex items-start gap-3">
                {/* Speaker label */}
                <div className="shrink-0 w-16 text-center">
                  <div className={`
                    inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm
                    ${playingSpk === spk
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-2 ring-green-500 animate-pulse'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    }
                  `}>
                    S{spk}
                  </div>
                </div>

                {/* Mapping controls */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={isCustom[String(spk)] ? '__custom__' : (teamNames.includes(mapping[String(spk)]) ? mapping[String(spk)] : '')}
                      onChange={(e) => handleSelect(String(spk), e.target.value)}
                      className="w-full sm:flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">-- Select member --</option>
                      {teamMembers.map((m) => (
                        <option key={m.domain} value={m.name}>
                          {m.name}{m.role ? ` — ${m.role}` : ''}
                        </option>
                      ))}
                      <option value="__custom__">Other (type name)</option>
                    </select>

                    {isCustom[String(spk)] && (
                      <input
                        type="text"
                        placeholder="Enter name..."
                        value={customNames[String(spk)] || ''}
                        onChange={(e) => handleCustomName(String(spk), e.target.value)}
                        className="w-full sm:flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    )}
                  </div>

                  {/* Sample utterances with play buttons */}
                  <div className="space-y-1">
                    {samplesBySpk[spk]?.map((sample, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {audioUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              if (playingSpk === spk) {
                                stopPlayback();
                              } else {
                                playSample(sample.start_at, sample.duration, spk);
                              }
                            }}
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-gray-500 hover:text-blue-600 transition-colors text-xs"
                            title="Play sample"
                          >
                            {playingSpk === spk ? '⏹' : '▶'}
                          </button>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate break-words min-w-0">
                          &quot;{sample.msg}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={!allMapped || saving || teamLoading}
        className={`
          w-full py-3 rounded-lg text-sm font-medium transition-colors
          ${allMapped && !saving && !teamLoading
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {saving ? 'Saving...' : 'Confirm Speaker Mapping'}
      </button>
    </div>
  );
}
