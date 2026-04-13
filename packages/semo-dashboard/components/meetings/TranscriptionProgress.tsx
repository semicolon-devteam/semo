'use client';

import { useState, useEffect, useRef } from 'react';

interface TranscriptionProgressProps {
  meetingId: string;
  onComplete: (data: { utteranceCount: number; speakers: number[] }) => void;
  onError: (error: string) => void;
}

export default function TranscriptionProgress({
  meetingId,
  onComplete,
  onError,
}: TranscriptionProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<'transcribing' | 'completed' | 'failed'>('transcribing');
  const startTime = useRef(0);

  // Set start time on mount only
  useEffect(() => {
    startTime.current = Date.now();
  }, []);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    // Elapsed timer
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    // Poll VITO status every 5 seconds
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/status`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === 'completed') {
          setStatus('completed');
          clearInterval(pollRef.current);
          clearInterval(timer);
          onComplete({ utteranceCount: data.utteranceCount, speakers: data.speakers });
        } else if (data.status === 'failed') {
          setStatus('failed');
          clearInterval(pollRef.current);
          clearInterval(timer);
          onError(data.error || 'Transcription failed');
        }
      } catch {
        // Network error — keep polling
      }
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(pollRef.current);
    };
  }, [meetingId, onComplete, onError]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      {status === 'transcribing' && (
        <>
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
              오디오를 녹취하고 있습니다...
            </p>
            <p className="text-3xl font-mono text-blue-600 dark:text-blue-400">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              1시간 오디오 기준 약 2~5분 소요
            </p>
          </div>
        </>
      )}

      {status === 'failed' && (
        <div className="text-center space-y-2">
          <div className="text-4xl">❌</div>
          <p className="text-lg font-medium text-red-600 dark:text-red-400">녹취 실패</p>
        </div>
      )}
    </div>
  );
}
