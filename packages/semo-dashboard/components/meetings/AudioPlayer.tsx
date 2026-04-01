'use client';

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';

export interface AudioPlayerHandle {
  playAt: (ms: number) => void;
}

interface AudioPlayerProps {
  src: string;
  onTimeUpdate?: (currentTimeMs: number) => void;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ src, onTimeUpdate }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);

    useImperativeHandle(ref, () => ({
      playAt(ms: number) {
        if (!audioRef.current) return;
        audioRef.current.currentTime = ms / 1000;
        audioRef.current.play().catch(() => {});
        setPlaying(true);
      },
    }));

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const handleTime = () => {
        setCurrentTime(audio.currentTime);
        onTimeUpdate?.(audio.currentTime * 1000);
      };
      const handleDuration = () => setDuration(audio.duration || 0);
      const handleEnd = () => setPlaying(false);
      const handlePlay = () => setPlaying(true);
      const handlePause = () => setPlaying(false);

      audio.addEventListener('timeupdate', handleTime);
      audio.addEventListener('loadedmetadata', handleDuration);
      audio.addEventListener('ended', handleEnd);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);

      return () => {
        audio.removeEventListener('timeupdate', handleTime);
        audio.removeEventListener('loadedmetadata', handleDuration);
        audio.removeEventListener('ended', handleEnd);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
      };
    }, [onTimeUpdate]);

    const togglePlay = useCallback(() => {
      if (!audioRef.current) return;
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }, [playing]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audioRef.current.currentTime = ratio * duration;
    }, [duration]);

    const cycleRate = useCallback(() => {
      const rates = [1, 1.25, 1.5, 2, 0.75];
      const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
      setPlaybackRate(next);
      if (audioRef.current) audioRef.current.playbackRate = next;
    }, [playbackRate]);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 px-4 py-2">
        <audio ref={audioRef} src={src} preload="auto" />

        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors"
          >
            {playing ? '⏸' : '▶'}
          </button>

          {/* Current time */}
          <span className="shrink-0 text-xs text-gray-400 font-mono w-12 text-right">
            {formatTime(currentTime)}
          </span>

          {/* Progress bar */}
          <div
            onClick={handleSeek}
            className="flex-1 h-2 bg-gray-700 rounded-full cursor-pointer relative group"
          >
            <div
              className="h-full bg-blue-500 rounded-full transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${progress}%`, marginLeft: '-6px' }}
            />
          </div>

          {/* Duration */}
          <span className="shrink-0 text-xs text-gray-400 font-mono w-12">
            {formatTime(duration)}
          </span>

          {/* Playback rate */}
          <button
            onClick={cycleRate}
            className="shrink-0 text-xs text-gray-400 hover:text-white font-mono w-10 text-center transition-colors"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    );
  }
);

export default AudioPlayer;
