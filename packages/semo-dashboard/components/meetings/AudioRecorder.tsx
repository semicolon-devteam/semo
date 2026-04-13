'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  onError: (error: string) => void;
}

export default function AudioRecorder({ onRecordingComplete, onError }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const { width, height } = canvas;
      ctx.fillStyle = document.documentElement.classList.contains('dark')
        ? 'rgb(31, 41, 55)'
        : 'rgb(249, 250, 251)';
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(37, 99, 235)';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType });
        onRecordingComplete(file);
      };

      mediaRecorder.onerror = () => {
        onError('녹음 중 오류가 발생했습니다.');
        stopRecording();
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err) {
      cleanup();
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        onError('마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해주세요.');
      } else {
        onError('녹음을 시작할 수 없습니다.');
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setRecording(false);
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex flex-col items-center py-8 space-y-6">
      <canvas
        ref={canvasRef}
        width={480}
        height={80}
        className="w-full max-w-md rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      />

      <p className="text-3xl font-mono text-blue-600 dark:text-blue-400">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </p>

      {!recording ? (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          <span className="w-3 h-3 rounded-full bg-white" />
          녹음 시작
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-medium bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 hover:opacity-90 transition-opacity"
        >
          <span className="w-3 h-3 rounded-sm bg-white dark:bg-gray-900" />
          녹음 완료
        </button>
      )}

      {recording && (
        <p className="text-xs text-gray-400">녹음 완료 버튼을 누르면 STT 처리가 시작됩니다</p>
      )}
    </div>
  );
}
