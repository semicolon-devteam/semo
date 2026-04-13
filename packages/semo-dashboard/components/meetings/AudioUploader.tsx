'use client';

import { useState, useRef, useCallback } from 'react';
import AudioRecorder from './AudioRecorder';

interface AudioUploaderProps {
  meetingId: string;
  onUploadComplete: (transcribeId: string) => void;
  onError: (error: string) => void;
}

const ACCEPTED_EXTENSIONS = '.mp3,.m4a,.mp4,.wav,.flac,.ogg,.webm,.amr';

type Tab = 'upload' | 'record';

export default function AudioUploader({
  meetingId,
  onUploadComplete,
  onError,
}: AudioUploaderProps) {
  const [tab, setTab] = useState<Tab>('upload');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(10);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('meetingId', meetingId);

        setProgress(30);

        const response = await fetch('/api/meetings/upload', {
          method: 'POST',
          body: formData,
        });

        setProgress(90);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        const data = await response.json();
        setProgress(100);
        onUploadComplete(data.transcribeId);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [meetingId, onUploadComplete, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleRecordingComplete = useCallback(
    (file: File) => {
      uploadFile(file);
    },
    [uploadFile],
  );

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('upload')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'upload'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          파일 업로드
        </button>
        <button
          onClick={() => setTab('record')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'record'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          브라우저 녹음
        </button>
      </div>

      {/* File upload tab */}
      {tab === 'upload' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
            ${
              dragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }
            ${uploading ? 'pointer-events-none opacity-70' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploading ? (
            <div className="space-y-4">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-600 dark:text-gray-400">업로드 및 녹취 시작 중...</p>
              <div className="w-64 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl">🎙️</div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                오디오 파일을 드롭하거나 클릭하여 선택
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                MP3, M4A, MP4, WAV, FLAC, OGG, WebM, AMR
              </p>
            </div>
          )}
        </div>
      )}

      {/* Browser recording tab */}
      {tab === 'record' &&
        (uploading ? (
          <div className="flex flex-col items-center py-12 space-y-4">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-400">업로드 및 녹취 시작 중...</p>
            <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <AudioRecorder onRecordingComplete={handleRecordingComplete} onError={onError} />
        ))}
    </div>
  );
}
