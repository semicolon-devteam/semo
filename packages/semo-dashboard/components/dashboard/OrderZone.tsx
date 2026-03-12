'use client';

import { useState } from 'react';

export default function OrderZone() {
  const [command, setCommand] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!command.trim()) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to /api/commands
      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim() }),
      });

      if (response.ok) {
        // Add to history
        setCommandHistory((prev) => [command.trim(), ...prev].slice(0, 5));
        setCommand('');
      }
    } catch (error) {
      console.error('Failed to submit command:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-[200px] bg-gray-100 border-r border-gray-200 flex flex-col">
      {/* Command Input */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Order Zone</h2>
        <textarea
          className="w-full p-2 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="What should we build today?"
          rows={3}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting}
        />
        <button
          className="w-full mt-2 px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          onClick={handleSubmit}
          disabled={isSubmitting || !command.trim()}
        >
          {isSubmitting ? 'Submitting...' : 'Submit ➤'}
        </button>
      </div>

      {/* Command History */}
      {commandHistory.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600 mb-2">Recent Commands</h3>
          <div className="space-y-1">
            {commandHistory.map((cmd, index) => (
              <button
                key={index}
                className="w-full text-left text-xs text-gray-700 p-2 bg-white rounded hover:bg-gray-50 truncate"
                onClick={() => setCommand(cmd)}
                title={cmd}
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions (placeholder) */}
      <div className="p-4 flex-1">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Quick Actions</h3>
        <div className="space-y-1">
          <button className="w-full text-left text-xs text-gray-700 p-2 bg-white rounded hover:bg-gray-50">
            New Workflow
          </button>
          <button className="w-full text-left text-xs text-gray-700 p-2 bg-white rounded hover:bg-gray-50">
            Assign Job
          </button>
          <button className="w-full text-left text-xs text-gray-700 p-2 bg-white rounded hover:bg-gray-50">
            Pause All
          </button>
        </div>
      </div>

      {/* Office Settings */}
      <div className="p-4 border-t border-gray-200">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Settings</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" defaultChecked />
            Show Grid
          </label>
          <div>
            <label className="text-xs text-gray-700">Agent Speed</label>
            <input
              type="range"
              min="1"
              max="5"
              defaultValue="3"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
