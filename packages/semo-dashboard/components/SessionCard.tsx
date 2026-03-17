'use client';

import type { Session } from '@/types';

interface SessionCardProps {
  session: Session;
  onClick: () => void;
}

export default function SessionCard({ session, onClick }: SessionCardProps) {
  function fmt(iso?: string) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md cursor-pointer transition-shadow"
    >
      {/* Top: label + sessionKey */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {session.label || session.sessionKey}
        </h3>
        <p className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5">
          {session.sessionKey}
        </p>
      </div>

      {/* Middle: badges */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            session.kind === 'main'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          {session.kind}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          {session.chatType}
        </span>
      </div>

      {/* Bottom: messageCount + lastActivity */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {session.messageCount} msgs
        </span>
        <span>{fmt(session.lastActivity)}</span>
      </div>
    </div>
  );
}
