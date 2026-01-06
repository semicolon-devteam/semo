'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState } from 'react';

// Dynamic import for PixiJS (no SSR)
const OfficeCanvas = dynamic(
  () => import('@/components/office/OfficeCanvas'),
  { ssr: false }
);

export default function OfficePage() {
  const params = useParams();
  const officeId = params.id as string;
  const [command, setCommand] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    // TODO: Send command to office server
    console.log('Command:', command);
    setCommand('');
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-office-wall border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Semo Office</h1>
          <span className="text-sm text-gray-400">ID: {officeId}</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
            Settings
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Office View */}
        <div className="flex-1 relative">
          <OfficeCanvas officeId={officeId} />
        </div>

        {/* Sidebar */}
        <aside className="w-80 bg-office-wall border-l border-gray-700 flex flex-col">
          {/* Progress Panel */}
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold mb-3">Progress</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>TASK-101: FE Component</span>
                  <span>80%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: '80%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>TASK-102: BE API</span>
                  <span>100%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill bg-green-500" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Chat Log */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h2 className="font-semibold mb-3">Messages</h2>
            <div className="space-y-3 text-sm">
              <div className="p-2 bg-gray-800 rounded">
                <span className="text-agent-be font-medium">BE:</span>
                <span className="text-gray-300 ml-2">API 완료! GET /api/users 확인해주세요</span>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <span className="text-agent-fe font-medium">FE:</span>
                <span className="text-gray-300 ml-2">확인했습니다. 연동 시작합니다</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Command Input */}
      <footer className="px-6 py-4 bg-office-wall border-t border-gray-700">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Enter command (e.g., '로그인 기능 구현해줘')"
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
