'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Agent {
  id: string;
  name: string;
  role?: string;
}

interface ProximityChatUIProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  nearbyAgents: Agent[];
  canChat: boolean;
}

/**
 * ProximityChatUI - Floating chat input for proximity-based messaging
 * Appears when player presses Enter near other agents
 */
export function ProximityChatUI({
  isOpen,
  onClose,
  onSend,
  nearbyAgents,
  canChat,
}: ProximityChatUIProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (message.trim()) {
        onSend(message.trim());
        setMessage('');
      }
    },
    [message, onSend]
  );

  if (!isOpen) {
    // Show hint when near agents
    if (canChat && nearbyAgents.length > 0) {
      return (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-2 text-center">
            <p className="text-gray-300 text-sm">
              Press <kbd className="px-2 py-0.5 bg-gray-700 rounded text-white font-mono">Enter</kbd> to chat with{' '}
              <span className="text-yellow-400">
                {nearbyAgents.length === 1
                  ? nearbyAgents[0].name
                  : `${nearbyAgents.length} agents`}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-900/95 border border-gray-600 rounded-xl p-4 w-80 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Proximity Chat</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close (ESC)"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Nearby agents */}
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-2">
            Nearby ({nearbyAgents.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {nearbyAgents.map((agent) => (
              <span
                key={agent.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300"
              >
                {agent.role && (
                  <span
                    className="w-2 h-2 rounded-full mr-1"
                    style={{
                      backgroundColor: getRoleColor(agent.role),
                    }}
                  />
                )}
                {agent.name}
              </span>
            ))}
          </div>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            maxLength={100}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
          >
            Send
          </button>
        </form>

        {/* Footer hints */}
        <div className="mt-3 flex justify-between text-xs text-gray-500">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-700 rounded">ESC</kbd> to close
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-700 rounded">Enter</kbd> to send
          </span>
        </div>
      </div>
    </div>
  );
}

// Role colors (matching CharacterSprite)
function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    PO: '#fc5185',
    PM: '#f5a623',
    Architect: '#8b5cf6',
    FE: '#e94560',
    BE: '#0f4c75',
    QA: '#3fc1c9',
    DevOps: '#364f6b',
    Decomposer: '#10b981',
  };
  return colors[role] || '#888888';
}

export default ProximityChatUI;
