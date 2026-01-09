'use client';

import { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Workflow instance from DB
 */
export interface WorkflowInstance {
  id: string;
  office_id: string;
  initiator_agent_id: string | null;
  user_command: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  current_step: string | null;
  context: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
}

/**
 * Workflow step execution from DB
 */
export interface WorkflowStepExecution {
  id: string;
  instance_id: string;
  step_name: string;
  agent_id: string | null;
  status: 'pending' | 'in_progress' | 'waiting_input' | 'completed';
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  artifacts: Record<string, unknown>[] | null;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Combined workflow progress with steps
 */
export interface WorkflowProgress {
  instance: WorkflowInstance;
  steps: WorkflowStepExecution[];
  currentStepIndex: number;
  completedSteps: number;
  totalSteps: number;
}

interface UseWorkflowProgressResult {
  activeWorkflows: WorkflowProgress[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Mock data for demo mode
const MOCK_WORKFLOWS: WorkflowProgress[] = [];

/**
 * Hook to track workflow progress
 * - Fetches active workflow instances
 * - Subscribes to Realtime for updates
 * - Tracks step progress
 */
export function useWorkflowProgress(officeId: string | null): UseWorkflowProgressResult {
  const [activeWorkflows, setActiveWorkflows] = useState<WorkflowProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflows = useCallback(async () => {
    if (!officeId) {
      setActiveWorkflows([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Demo mode
    if (officeId === 'demo') {
      setActiveWorkflows(MOCK_WORKFLOWS);
      setIsLoading(false);
      setError(null);
      return;
    }

    // If Supabase not configured
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[useWorkflowProgress] Supabase not configured');
      setActiveWorkflows(MOCK_WORKFLOWS);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Fetch active workflow instances
      const { data: instances, error: instanceError } = await supabase
        .from('workflow_instances')
        .select('*')
        .eq('office_id', officeId)
        .in('status', ['active', 'paused'])
        .order('started_at', { ascending: false });

      if (instanceError) {
        console.error('[useWorkflowProgress] Instance fetch error:', instanceError.message);
        setError(new Error(instanceError.message));
        setActiveWorkflows([]);
        return;
      }

      if (!instances || instances.length === 0) {
        setActiveWorkflows([]);
        setIsLoading(false);
        return;
      }

      // Fetch step executions for all instances
      const instanceIds = instances.map(i => i.id);
      const { data: steps, error: stepsError } = await supabase
        .from('workflow_step_executions')
        .select('*')
        .in('instance_id', instanceIds)
        .order('started_at', { ascending: true });

      if (stepsError) {
        console.error('[useWorkflowProgress] Steps fetch error:', stepsError.message);
        setError(new Error(stepsError.message));
        setActiveWorkflows([]);
        return;
      }

      // Combine instances with their steps
      const workflows: WorkflowProgress[] = instances.map(instance => {
        const instanceSteps = (steps || []).filter(s => s.instance_id === instance.id);
        const completedSteps = instanceSteps.filter(s => s.status === 'completed').length;
        const currentStepIndex = instanceSteps.findIndex(
          s => s.status === 'in_progress' || s.status === 'waiting_input'
        );

        return {
          instance,
          steps: instanceSteps,
          currentStepIndex: currentStepIndex === -1 ? completedSteps : currentStepIndex,
          completedSteps,
          totalSteps: instanceSteps.length,
        };
      });

      setActiveWorkflows(workflows);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useWorkflowProgress] Exception:', errorMessage);
      setError(new Error(errorMessage));
      setActiveWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  }, [officeId]);

  // Initial fetch
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Realtime subscription
  useEffect(() => {
    if (!officeId || officeId === 'demo' || !supabaseUrl || !supabaseKey) {
      return;
    }

    const supabase = getSupabaseClient();
    let instanceChannel: RealtimeChannel | null = null;
    let stepsChannel: RealtimeChannel | null = null;

    const setupSubscriptions = () => {
      // Subscribe to workflow_instances changes
      instanceChannel = supabase
        .channel(`workflow_instances:${officeId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workflow_instances',
            filter: `office_id=eq.${officeId}`,
          },
          () => {
            // Refetch all data on any change
            fetchWorkflows();
          }
        )
        .subscribe();

      // Subscribe to workflow_step_executions changes
      stepsChannel = supabase
        .channel(`workflow_steps:${officeId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workflow_step_executions',
          },
          (payload) => {
            // Check if this step belongs to one of our active workflows
            const stepData = payload.new as WorkflowStepExecution;
            setActiveWorkflows(prev => {
              const workflowIndex = prev.findIndex(w => w.instance.id === stepData.instance_id);
              if (workflowIndex === -1) {
                // Might be a new workflow, refetch
                fetchWorkflows();
                return prev;
              }

              // Update the specific workflow's steps
              const updated = [...prev];
              const workflow = { ...updated[workflowIndex] };

              if (payload.eventType === 'INSERT') {
                workflow.steps = [...workflow.steps, stepData];
                workflow.totalSteps = workflow.steps.length;
              } else if (payload.eventType === 'UPDATE') {
                workflow.steps = workflow.steps.map(s =>
                  s.id === stepData.id ? stepData : s
                );
              }

              // Recalculate progress
              workflow.completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
              workflow.currentStepIndex = workflow.steps.findIndex(
                s => s.status === 'in_progress' || s.status === 'waiting_input'
              );
              if (workflow.currentStepIndex === -1) {
                workflow.currentStepIndex = workflow.completedSteps;
              }

              updated[workflowIndex] = workflow;
              return updated;
            });
          }
        )
        .subscribe();
    };

    setupSubscriptions();

    return () => {
      if (instanceChannel) {
        supabase.removeChannel(instanceChannel);
      }
      if (stepsChannel) {
        supabase.removeChannel(stepsChannel);
      }
    };
  }, [officeId, fetchWorkflows]);

  return {
    activeWorkflows,
    isLoading,
    error,
    refetch: fetchWorkflows,
  };
}
