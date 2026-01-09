'use client';

import { useState } from 'react';
import { useWorkflowProgress, WorkflowProgress as WorkflowProgressData, WorkflowStepExecution } from '@/hooks/useWorkflowProgress';

interface WorkflowProgressProps {
  officeId: string;
}

/**
 * Workflow Progress Component
 *
 * Displays active workflow progress with:
 * - Step progress stepper
 * - Current step details
 * - Artifacts/results preview
 */
export function WorkflowProgress({ officeId }: WorkflowProgressProps) {
  const { activeWorkflows, isLoading, error } = useWorkflowProgress(officeId);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);

  // Don't render if no active workflows
  if (activeWorkflows.length === 0 && !isLoading) {
    return null;
  }

  const getStepStatusIcon = (status: WorkflowStepExecution['status']) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '●';
      case 'waiting_input':
        return '?';
      case 'pending':
      default:
        return '○';
    }
  };

  const getStepStatusColor = (status: WorkflowStepExecution['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-400/20 border-green-400/50';
      case 'in_progress':
        return 'text-blue-400 bg-blue-400/20 border-blue-400/50 animate-pulse';
      case 'waiting_input':
        return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50 animate-pulse';
      case 'pending':
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getWorkflowStatusColor = (status: WorkflowProgressData['instance']['status']) => {
    switch (status) {
      case 'active':
        return 'text-blue-400';
      case 'paused':
        return 'text-yellow-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed bottom-4 right-4 w-[360px] z-40">
      {/* Header */}
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-t-xl border border-gray-700/50 border-b-0 px-4 py-3">
        <h3 className="text-white font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          Workflow Progress
          {activeWorkflows.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
              {activeWorkflows.length}
            </span>
          )}
        </h3>
      </div>

      {/* Workflows List */}
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-b-xl border border-gray-700/50 border-t-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            Loading workflows...
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400 text-sm">
            Failed to load workflows
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {activeWorkflows.map((workflow) => (
              <div
                key={workflow.instance.id}
                className="border-b border-gray-700/30 last:border-b-0"
              >
                {/* Workflow Header */}
                <button
                  onClick={() =>
                    setExpandedWorkflow(
                      expandedWorkflow === workflow.instance.id ? null : workflow.instance.id
                    )
                  }
                  className="w-full text-left p-4 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${getWorkflowStatusColor(workflow.instance.status)}`}>
                      {workflow.instance.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(workflow.instance.started_at)}
                    </span>
                  </div>
                  <p className="text-sm text-white line-clamp-1 mb-2">
                    {workflow.instance.user_command}
                  </p>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{
                          width: `${workflow.totalSteps > 0 ? (workflow.completedSteps / workflow.totalSteps) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      {workflow.completedSteps}/{workflow.totalSteps}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {expandedWorkflow === workflow.instance.id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {/* Expanded Steps */}
                {expandedWorkflow === workflow.instance.id && (
                  <div className="px-4 pb-4">
                    {/* Steps Stepper */}
                    <div className="space-y-2">
                      {workflow.steps.map((step, index) => (
                        <div key={step.id} className="flex items-start gap-3">
                          {/* Step Status Icon */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${getStepStatusColor(step.status)}`}
                            >
                              {getStepStatusIcon(step.status)}
                            </div>
                            {index < workflow.steps.length - 1 && (
                              <div className={`w-0.5 h-6 mt-1 ${
                                step.status === 'completed' ? 'bg-green-400/50' : 'bg-gray-600'
                              }`} />
                            )}
                          </div>

                          {/* Step Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white font-medium">
                                {step.step_name}
                              </span>
                              {step.started_at && (
                                <span className="text-xs text-gray-500">
                                  {formatTime(step.started_at)}
                                </span>
                              )}
                            </div>

                            {/* Current step details */}
                            {(step.status === 'in_progress' || step.status === 'waiting_input') && (
                              <div className="mt-1 p-2 bg-gray-800/50 rounded text-xs text-gray-300">
                                {step.status === 'waiting_input' ? (
                                  <span className="text-yellow-400">Waiting for input...</span>
                                ) : (
                                  <span className="text-blue-400">Processing...</span>
                                )}
                              </div>
                            )}

                            {/* Completed step artifacts */}
                            {step.status === 'completed' && step.artifacts && step.artifacts.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {step.artifacts.map((artifact, aIdx) => (
                                  <div
                                    key={aIdx}
                                    className="p-2 bg-gray-800/50 rounded text-xs"
                                  >
                                    {artifact.type === 'github_issue' ? (
                                      <a
                                        href={(artifact as { url?: string }).url || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline"
                                      >
                                        📋 {(artifact as { number?: number }).number || 'Issue'}
                                      </a>
                                    ) : artifact.type === 'markdown' ? (
                                      <span className="text-gray-300">
                                        📄 {(artifact as { title?: string }).title || 'Document'}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">
                                        📦 {String(artifact.type || 'Artifact')}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Output summary */}
                            {step.status === 'completed' && step.output_data && (
                              <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                                {typeof step.output_data === 'object'
                                  ? JSON.stringify(step.output_data).substring(0, 100)
                                  : String(step.output_data).substring(0, 100)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* No steps yet */}
                    {workflow.steps.length === 0 && (
                      <div className="text-center text-gray-400 text-sm py-4">
                        Workflow initializing...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
