'use client';

import { useState, useCallback } from 'react';
import { useAgentSessions, AgentSession } from '@/hooks/useAgentSessions';
import { XtermTerminal } from './XtermTerminal';

interface AgentSessionMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Agent Session Monitor
 *
 * 실행 중인 Claude Code 세션들을 모니터링하는 팝업 UI
 * - 세션 목록 표시 (좌측)
 * - 선택된 세션의 터미널 출력 표시 (우측)
 * - 세션 종료/취소 기능
 */
export function AgentSessionMonitor({ isOpen, onClose }: AgentSessionMonitorProps) {
  const { sessions, isLoading, error, refetch, terminateSession, cancelSession } = useAgentSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isTerminating, setIsTerminating] = useState<string | null>(null);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // 세션 선택
  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  // 세션 종료
  const handleTerminate = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTerminating(sessionId);
    try {
      const success = await terminateSession(sessionId);
      if (success && selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
    } finally {
      setIsTerminating(null);
    }
  }, [terminateSession, selectedSessionId]);

  // 세션 취소 (Ctrl+C)
  const handleCancel = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await cancelSession(sessionId);
  }, [cancelSession]);

  // 상태 배지 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'busy':
        return 'bg-green-500';
      case 'idle':
        return 'bg-yellow-500';
      case 'terminating':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // 상대 시간 포맷
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${diffHour}h ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[90vw] max-w-[1400px] h-[80vh] bg-gray-900 rounded-xl shadow-2xl border border-gray-700/50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-semibold text-white">Agent Session Monitor</h2>
            <span className="text-sm text-gray-400">
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Session List - Left Panel */}
          <div className="w-80 border-r border-gray-700/50 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-400">Sessions</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading sessions...
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-400 text-sm">
                  Failed to load sessions
                  <button
                    onClick={() => refetch()}
                    className="block mx-auto mt-2 text-blue-400 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No active sessions
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`w-full text-left p-4 border-b border-gray-700/30 transition-colors ${
                      selectedSessionId === session.id
                        ? 'bg-blue-600/20 border-l-2 border-l-blue-500'
                        : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(session.status)}`} />
                      <span className="text-sm font-medium text-white truncate">
                        {session.agentId ? `Agent: ${session.agentId.slice(0, 8)}...` : 'Unknown Agent'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2 truncate">
                      {session.worktreePath.split('/').slice(-2).join('/')}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 capitalize">{session.status}</span>
                      <span className="text-gray-500">{formatRelativeTime(session.lastActivityAt)}</span>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => handleCancel(session.id, e)}
                        disabled={session.status !== 'busy'}
                        className="flex-1 px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                      >
                        Ctrl+C
                      </button>
                      <button
                        onClick={(e) => handleTerminate(session.id, e)}
                        disabled={isTerminating === session.id}
                        className="flex-1 px-2 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50 rounded transition-colors"
                      >
                        {isTerminating === session.id ? 'Terminating...' : 'Terminate'}
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Terminal View - Right Panel */}
          <div className="flex-1 flex flex-col bg-black">
            {selectedSession ? (
              <>
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(selectedSession.status)}`} />
                    <span className="text-sm text-white font-mono">
                      Session: {selectedSession.id.slice(0, 12)}...
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {selectedSession.worktreePath}
                  </span>
                </div>
                <div className="flex-1">
                  <XtermTerminal
                    sessionId={selectedSession.id}
                    wsUrl={`${process.env.NEXT_PUBLIC_OFFICE_SERVER_WS_URL || 'ws://localhost:3030'}/ws/terminal`}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Select a session to view terminal output</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentSessionMonitor;
