'use client';

import { useState } from 'react';
import { useUserQuestions, UserQuestion } from '@/hooks/useUserQuestions';

interface UserQuestionPanelProps {
  officeId: string;
}

/**
 * User Question Panel
 *
 * Displays pending questions from agents and allows user to respond.
 * - Real-time subscription to user_questions table
 * - Supports text, selection, and confirmation question types
 */
export function UserQuestionPanel({ officeId }: UserQuestionPanelProps) {
  const { questions, pendingCount, isLoading, error, answerQuestion } = useUserQuestions(officeId);
  const [selectedQuestion, setSelectedQuestion] = useState<UserQuestion | null>(null);
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedQuestion || !response.trim()) return;

    setIsSubmitting(true);
    try {
      await answerQuestion(selectedQuestion.id, response.trim());
      setSelectedQuestion(null);
      setResponse('');
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = async (option: string) => {
    if (!selectedQuestion) return;

    setIsSubmitting(true);
    try {
      await answerQuestion(selectedQuestion.id, option);
      setSelectedQuestion(null);
      setResponse('');
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmation = async (confirmed: boolean) => {
    if (!selectedQuestion) return;

    setIsSubmitting(true);
    try {
      await answerQuestion(selectedQuestion.id, confirmed ? 'yes' : 'no');
      setSelectedQuestion(null);
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if no pending questions
  if (pendingCount === 0 && !selectedQuestion) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'normal':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'low':
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  return (
    <div className="fixed top-4 right-4 w-[380px] z-50">
      {/* Panel Header */}
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-t-xl border border-gray-700/50 border-b-0 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            Agent Questions
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                {pendingCount}
              </span>
            )}
          </h3>
        </div>
      </div>

      {/* Questions List */}
      {!selectedQuestion && (
        <div className="bg-gray-900/95 backdrop-blur-sm rounded-b-xl border border-gray-700/50 border-t-0 overflow-hidden">
          {isLoading ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              Loading questions...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-400 text-sm">
              Failed to load questions
            </div>
          ) : questions.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              No pending questions
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {questions.map((question) => (
                <button
                  key={question.id}
                  onClick={() => setSelectedQuestion(question)}
                  className="w-full text-left p-4 hover:bg-gray-800/50 border-b border-gray-700/30 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(question.priority)}`}>
                          {question.priority}
                        </span>
                        <span className="text-xs text-gray-500">
                          {question.question_type}
                        </span>
                      </div>
                      <p className="text-sm text-white line-clamp-2">
                        {question.question}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Agent: {question.agent_id.slice(0, 8)}...
                      </p>
                    </div>
                    <span className="text-gray-400 text-lg">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question Detail Modal */}
      {selectedQuestion && (
        <div className="bg-gray-900/95 backdrop-blur-sm rounded-b-xl border border-gray-700/50 border-t-0 p-4">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(selectedQuestion.priority)}`}>
                {selectedQuestion.priority}
              </span>
              <span className="text-xs text-gray-500">
                {selectedQuestion.question_type}
              </span>
            </div>
            <p className="text-white text-sm">
              {selectedQuestion.question}
            </p>
            {selectedQuestion.context && (
              <p className="text-xs text-gray-400 mt-2 p-2 bg-gray-800/50 rounded">
                Context: {JSON.stringify(selectedQuestion.context)}
              </p>
            )}
          </div>

          {/* Response Input based on question type */}
          {selectedQuestion.question_type === 'text' && (
            <div className="space-y-3">
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Enter your response..."
                className="w-full bg-gray-800/80 text-white rounded-lg px-3 py-2 text-sm border border-gray-600/50 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 focus:outline-none transition-all resize-none h-24"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!response.trim() || isSubmitting}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          )}

          {selectedQuestion.question_type === 'selection' && selectedQuestion.options && (
            <div className="space-y-2">
              {selectedQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option)}
                  disabled={isSubmitting}
                  className="w-full text-left p-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/30 hover:border-yellow-500/50 rounded-lg text-sm text-white transition-all disabled:opacity-50"
                >
                  {option}
                </button>
              ))}
              <button
                onClick={() => setSelectedQuestion(null)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm mt-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {selectedQuestion.question_type === 'confirmation' && (
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedQuestion(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmation(false)}
                disabled={isSubmitting}
                className="flex-1 bg-red-500/80 hover:bg-red-500 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={() => handleConfirmation(true)}
                disabled={isSubmitting}
                className="flex-1 bg-green-500/80 hover:bg-green-500 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Yes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
