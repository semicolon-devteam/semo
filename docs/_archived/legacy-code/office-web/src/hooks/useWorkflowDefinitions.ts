'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { WorkflowDefinition } from '@/types/workflow';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface UseWorkflowDefinitionsResult {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Mock workflows for demo/development mode
const MOCK_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'wf-feature',
    office_id: 'demo',
    name: 'Feature Request',
    description: '새로운 기능 요청 처리',
    steps: [
      { name: 'brainstorming', agent: 'Researcher' },
      { name: 'design', agent: 'Designer' },
      { name: 'implementation', agent: 'FE' },
    ],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'wf-bugfix',
    office_id: 'demo',
    name: 'Bug Fix',
    description: '버그 수정 워크플로우',
    steps: [
      { name: 'analysis', agent: 'QA' },
      { name: 'fix', agent: 'BE' },
      { name: 'test', agent: 'QA' },
    ],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'wf-refactor',
    office_id: 'demo',
    name: 'Refactoring',
    description: '코드 리팩토링',
    steps: [
      { name: 'review', agent: 'Architect' },
      { name: 'refactor', agent: 'BE' },
      { name: 'test', agent: 'QA' },
    ],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * Hook to fetch workflow definitions from Supabase
 * Used in Order Zone Command Panel to show available workflows
 *
 * - Demo mode or no Supabase config → uses mock data
 * - Real office → fetches from DB workflow_definitions table
 */
export function useWorkflowDefinitions(officeId: string | null): UseWorkflowDefinitionsResult {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflows = async () => {
    // For no officeId, return empty
    if (!officeId) {
      setWorkflows([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // For demo mode, use mock workflows
    if (officeId === 'demo') {
      setWorkflows(MOCK_WORKFLOWS);
      setIsLoading(false);
      setError(null);
      return;
    }

    // If Supabase not configured, use mock data with warning
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[useWorkflowDefinitions] Supabase not configured, using mock data');
      setWorkflows(MOCK_WORKFLOWS);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('office_id', officeId)
        .eq('is_active', true)
        .order('name');

      if (fetchError) {
        console.error('[useWorkflowDefinitions] DB error:', fetchError.message);
        setError(new Error(fetchError.message));
        setWorkflows([]);
        return;
      }

      setWorkflows(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useWorkflowDefinitions] Exception:', errorMessage);
      setError(new Error(errorMessage));
      setWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [officeId]);

  return { workflows, isLoading, error, refetch: fetchWorkflows };
}
