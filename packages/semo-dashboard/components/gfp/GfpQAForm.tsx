'use client';

import { useState } from 'react';
import type { GfpQAItem } from '@/types';

interface GfpQAFormProps {
  sectionId: string;
  gfpId: string;
  qaItems: GfpQAItem[];
  onSaved: () => void;
}

export default function GfpQAForm({ sectionId, gfpId, qaItems, onSaved }: GfpQAFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const item of qaItems) {
      init[item.id] = item.answer ?? '';
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  const answeredCount = qaItems.filter((q) => q.answer || answers[q.id]?.trim()).length;
  const totalCount = qaItems.length;

  async function handleSave() {
    const qa_answers = Object.entries(answers)
      .filter(([, v]) => v.trim())
      .map(([id, answer]) => ({ id, answer }));
    if (qa_answers.length === 0) return;

    setSaving(true);
    try {
      await fetch(`/api/gfp/${gfpId}/sections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, action: 'answer-qa', qa_answers }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  // Check if any local edits differ from saved state
  const hasChanges = qaItems.some((q) => {
    const local = answers[q.id]?.trim() ?? '';
    const saved = q.answer?.trim() ?? '';
    return local !== saved && local !== '';
  });

  return (
    <div className="space-y-4">
      {qaItems.map((item, idx) => (
        <div key={item.id} className="space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-xs font-mono text-gray-400 mt-0.5 shrink-0">
              {item.id.toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {item.question}
              </p>
              {item.sub_bullets && item.sub_bullets.length > 0 && (
                <ul className="mt-1 ml-3 space-y-0.5">
                  {item.sub_bullets.map((b, i) => (
                    <li key={i} className="text-xs text-gray-500 dark:text-gray-400">
                      - {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {item.answer && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                {item.answered_via === 'slack' ? 'Slack' : 'Dashboard'}
              </span>
            )}
          </div>
          <textarea
            value={answers[item.id] ?? ''}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
            placeholder="Answer..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          {idx < qaItems.length - 1 && (
            <div className="border-b border-gray-100 dark:border-gray-700" />
          )}
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {answeredCount}/{totalCount} answered
        </span>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors inline-flex items-center gap-1.5"
        >
          {saving && (
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Save Answers
        </button>
      </div>
    </div>
  );
}
