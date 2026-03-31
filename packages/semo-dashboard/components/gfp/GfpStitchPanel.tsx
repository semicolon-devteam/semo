'use client';

import { useState } from 'react';
import type { GfpPhaseSection } from '@/types';

interface GfpStitchPanelProps {
  gfpId: string;
  sections: GfpPhaseSection[];
  onUploaded: () => void;
}

export default function GfpStitchPanel({ gfpId, sections, onUploaded }: GfpStitchPanelProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [targetPrompt, setTargetPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const promptSections = sections.filter((s) => s.section_key.startsWith('stitch-prompt-'));
  const resultSections = sections.filter((s) => s.section_key.startsWith('stitch-result-'));

  async function handleCopy(content: string, sectionId: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(sectionId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleUpload() {
    if (!exportContent.trim() || !targetPrompt) return;
    setUploading(true);
    try {
      const res = await fetch('/api/gfp/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'stitch-export',
          gfp_id: gfpId,
          prompt_section_id: targetPrompt,
          export_content: exportContent.trim(),
          bot_id: 'manual',
        }),
      });
      if (!res.ok) throw new Error('Upload failed');
      setShowUpload(false);
      setExportContent('');
      setTargetPrompt('');
      onUploaded();
    } catch {
      alert('Failed to upload Stitch export');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400">
          Stitch Design Bridge
        </h3>
        <a
          href="https://stitch.withgoogle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
        >
          Open Stitch
        </a>
      </div>

      {/* Workflow Guide */}
      <div className="mb-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p className="font-medium text-gray-700 dark:text-gray-300">Workflow:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li className={promptSections.length > 0 ? 'line-through text-gray-400' : ''}>
            DesignClaw generates Stitch prompts from Phase 0-2
          </li>
          <li>Copy prompt below &rarr; paste in Stitch</li>
          <li>Generate &amp; iterate design in Stitch</li>
          <li>Export as Tailwind CSS</li>
          <li>Upload export result below</li>
        </ol>
      </div>

      {/* Prompt Sections — Copy buttons */}
      {promptSections.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Prompts ({promptSections.length})
          </p>
          {promptSections.map((section) => {
            const hasResult = resultSections.some(
              (r) => r.section_key === section.section_key.replace('prompt', 'result')
            );
            return (
              <div
                key={section.section_id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-md"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {hasResult && (
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  )}
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                    {section.title}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(section.content, section.section_id)}
                  className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors shrink-0 ml-2"
                >
                  {copiedId === section.section_id ? 'Copied!' : 'Copy'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Results Summary */}
      {resultSections.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Exports ({resultSections.length})
          </p>
          <div className="flex gap-1 flex-wrap">
            {resultSections.map((r) => (
              <span
                key={r.section_id}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  r.status === 'approved'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                }`}
              >
                #{r.section_key.match(/\d+/)?.[0]} {r.status}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Upload Export */}
      <button
        onClick={() => setShowUpload(!showUpload)}
        className="text-xs text-purple-600 dark:text-purple-400 hover:underline mb-2"
      >
        {showUpload ? 'Cancel Upload' : 'Upload Stitch Export'}
      </button>

      {showUpload && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
          {promptSections.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                For Prompt
              </label>
              <select
                value={targetPrompt}
                onChange={(e) => setTargetPrompt(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select prompt...</option>
                {promptSections.map((s) => (
                  <option key={s.section_id} value={s.section_key}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tailwind CSS Export
            </label>
            <textarea
              value={exportContent}
              onChange={(e) => setExportContent(e.target.value)}
              placeholder="Paste your Stitch Tailwind CSS export here..."
              rows={6}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y font-mono"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading || !exportContent.trim() || (!targetPrompt && promptSections.length > 0)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-medium rounded-md transition-colors"
            >
              {uploading && (
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              )}
              Upload Export
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {promptSections.length === 0 && resultSections.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          No Stitch prompts yet. DesignClaw will generate them when Phase 0-2 sections are approved.
        </p>
      )}
    </div>
  );
}
