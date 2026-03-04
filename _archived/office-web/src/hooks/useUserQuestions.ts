'use client';

import { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * User question from agent
 */
export interface UserQuestion {
  id: string;
  office_id: string;
  workflow_instance_id: string | null;
  agent_id: string;
  question_type: 'text' | 'selection' | 'confirmation';
  question: string;
  options: string[] | null;
  context: Record<string, unknown> | null;
  status: 'pending' | 'answered' | 'timeout';
  priority: 'low' | 'normal' | 'high';
  response: string | null;
  expires_at: string | null;
  created_at: string;
  answered_at: string | null;
}

interface UseUserQuestionsResult {
  questions: UserQuestion[];
  pendingCount: number;
  isLoading: boolean;
  error: Error | null;
  answerQuestion: (questionId: string, response: string) => Promise<void>;
  refetch: () => Promise<void>;
}

// Mock questions for demo/development mode
const MOCK_QUESTIONS: UserQuestion[] = [];

/**
 * Hook to manage user questions from agents
 * - Fetches pending questions from Supabase
 * - Subscribes to Realtime for new questions
 * - Provides method to submit responses
 */
export function useUserQuestions(officeId: string | null): UseUserQuestionsResult {
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!officeId) {
      setQuestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Demo mode - use mock data
    if (officeId === 'demo') {
      setQuestions(MOCK_QUESTIONS);
      setIsLoading(false);
      setError(null);
      return;
    }

    // If Supabase not configured
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[useUserQuestions] Supabase not configured, using mock data');
      setQuestions(MOCK_QUESTIONS);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from('user_questions')
        .select('*')
        .eq('office_id', officeId)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('[useUserQuestions] DB error:', fetchError.message);
        setError(new Error(fetchError.message));
        setQuestions([]);
        return;
      }

      setQuestions(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useUserQuestions] Exception:', errorMessage);
      setError(new Error(errorMessage));
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [officeId]);

  // Answer a question
  const answerQuestion = useCallback(async (questionId: string, response: string) => {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[useUserQuestions] Cannot answer - Supabase not configured');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from('user_questions')
        .update({
          status: 'answered',
          response,
          answered_at: new Date().toISOString(),
        })
        .eq('id', questionId);

      if (updateError) {
        console.error('[useUserQuestions] Update error:', updateError.message);
        throw new Error(updateError.message);
      }

      // Remove answered question from local state
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useUserQuestions] Answer error:', errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Realtime subscription
  useEffect(() => {
    if (!officeId || officeId === 'demo' || !supabaseUrl || !supabaseKey) {
      return;
    }

    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;

    const setupSubscription = () => {
      channel = supabase
        .channel(`user_questions:${officeId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_questions',
            filter: `office_id=eq.${officeId}`,
          },
          (payload) => {
            const newQuestion = payload.new as UserQuestion;
            if (newQuestion.status === 'pending') {
              setQuestions((prev) => [...prev, newQuestion]);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_questions',
            filter: `office_id=eq.${officeId}`,
          },
          (payload) => {
            const updatedQuestion = payload.new as UserQuestion;
            if (updatedQuestion.status !== 'pending') {
              // Remove from pending list if status changed
              setQuestions((prev) => prev.filter((q) => q.id !== updatedQuestion.id));
            } else {
              // Update the question
              setQuestions((prev) =>
                prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
              );
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [officeId]);

  const pendingCount = questions.filter((q) => q.status === 'pending').length;

  return {
    questions,
    pendingCount,
    isLoading,
    error,
    answerQuestion,
    refetch: fetchQuestions,
  };
}
