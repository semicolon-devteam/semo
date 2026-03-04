'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkflowDefinitions } from '@/hooks/useWorkflowDefinitions';
import type { OrderCommand } from '@/types/workflow';

interface OrderZoneCommandPanelProps {
  officeId: string;
  onSubmit: (command: string, workflowId: string | null) => void;
  onCancel: () => void;
}

/**
 * Order Zone Command Panel
 *
 * Displayed when Orchestrator is in 'listening' state.
 * Allows user to:
 * 1. Select a workflow (or leave as "auto-detect")
 * 2. Enter a command/instruction
 * 3. Submit the command to Orchestrator
 */
export function OrderZoneCommandPanel({
  officeId,
  onSubmit,
  onCancel,
}: OrderZoneCommandPanelProps) {
  const { workflows, isLoading, error } = useWorkflowDefinitions(officeId);
  const [command, setCommand] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('auto');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle ESC key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const workflowId = selectedWorkflow === 'auto' ? null : selectedWorkflow;
    onSubmit(command.trim(), workflowId);

    // Clear the form after submission
    setCommand('');
    setSelectedWorkflow('auto');
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[520px] z-50">
      {/* Panel Container */}
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-b border-gray-700/50">
          <h3 className="text-white font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Order Zone Command
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
          >
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">ESC</kbd>
            닫기
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Workflow Selection */}
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block">
              워크플로우 선택 (선택사항)
            </label>
            <select
              value={selectedWorkflow}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
              className="w-full bg-gray-800/80 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-600/50 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 focus:outline-none transition-all"
              disabled={isLoading}
            >
              <option value="auto">
                🤖 자동 분석 - Orchestrator가 적절한 워크플로우 선택
              </option>
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  📋 {wf.name} {wf.description ? `- ${wf.description}` : ''}
                </option>
              ))}
            </select>
            {error && (
              <p className="text-red-400 text-xs mt-1">
                워크플로우 목록을 불러오지 못했습니다.
              </p>
            )}
          </div>

          {/* Command Input */}
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block">
              명령어 입력
            </label>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="예: 로그인 기능을 구현해줘"
              className="w-full bg-gray-800/80 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-600/50 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 focus:outline-none transition-all placeholder:text-gray-500"
            />
          </div>

          {/* Selected Workflow Info */}
          {selectedWorkflow !== 'auto' && (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-2">선택된 워크플로우 단계:</p>
              <div className="flex items-center gap-2 flex-wrap">
                {workflows
                  .find((wf) => wf.id === selectedWorkflow)
                  ?.steps.map((step, idx, arr) => (
                    <div key={step.name} className="flex items-center gap-1">
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                        {step.agent}
                      </span>
                      {idx < arr.length - 1 && (
                        <span className="text-gray-500">→</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!command.trim()}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-yellow-500/20 disabled:shadow-none"
          >
            {command.trim() ? '명령 전송' : '명령어를 입력하세요'}
          </button>
        </form>

        {/* Footer hint */}
        <div className="px-4 py-2 bg-gray-800/50 border-t border-gray-700/50">
          <p className="text-xs text-gray-500 text-center">
            💡 Tip: 워크플로우를 선택하지 않으면 Orchestrator가 명령어를 분석하여 자동으로 선택합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
