'use client';

import { useState } from 'react';
import type { GfpPhaseSection, DesignStep } from '@/types';
import { DESIGN_STEPS } from '@/types';

interface GfpDesignToolsPanelProps {
  gfpId: string;
  sections: GfpPhaseSection[];
  designStep: DesignStep;
  onUploaded: () => void;
}

export default function GfpStitchPanel({ gfpId, sections, designStep, onUploaded }: GfpDesignToolsPanelProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [targetPrompt, setTargetPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const promptSections = sections.filter((s) => s.section_key.startsWith('stitch-prompt-') || s.section_key.startsWith('impl-stitch-'));
  const resultSections = sections.filter((s) => s.section_key.startsWith('stitch-result-'));
  const refSections = sections.filter((s) => s.section_key.startsWith('ref-'));
  const dsSections = sections.filter((s) => s.section_key.startsWith('ds-'));
  const implSections = sections.filter((s) => s.section_key.startsWith('impl-screen-'));
  const handoffSections = sections.filter((s) => s.section_key.startsWith('handoff-'));

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

  function sectionStatusSummary(secs: GfpPhaseSection[]) {
    const approved = secs.filter((s) => s.status === 'approved').length;
    return `${approved}/${secs.length}`;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400">
          Design Tools
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

      {/* Step Progress Overview */}
      <div className="mb-4 space-y-1.5">
        {DESIGN_STEPS.map((def) => {
          const stepSecs = sections.filter((s) => s.section_key.startsWith(def.prefix));
          const allApproved = stepSecs.length > 0 && stepSecs.every((s) => s.status === 'approved');
          const isActive = def.step === designStep;
          return (
            <div
              key={def.step}
              className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                isActive
                  ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : allApproved
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span>{def.step}. {def.label}</span>
              <span>
                {allApproved ? '&#x2713;' : stepSecs.length > 0 ? sectionStatusSummary(stepSecs) : '-'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step 1-2: Reference & Design System summary */}
      {(designStep === 1 || designStep === 2) && (
        <div className="mb-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {designStep === 1 ? 'Reference Discovery' : 'Design System'}
          </p>
          <p>
            {designStep === 1
              ? 'DesignClaw will create Q&A sections for reference gathering. Answer via dashboard or Slack.'
              : 'DesignClaw will generate design system sections (colors, typography, spacing, components).'
            }
          </p>
          {refSections.length > 0 && designStep === 1 && (
            <p className="text-purple-600 dark:text-purple-400">
              References: {sectionStatusSummary(refSections)} approved
            </p>
          )}
          {dsSections.length > 0 && designStep === 2 && (
            <p className="text-purple-600 dark:text-purple-400">
              Design System: {sectionStatusSummary(dsSections)} approved
            </p>
          )}
        </div>
      )}

      {/* Step 3: Stitch prompts + prototypes (original Stitch functionality) */}
      {designStep >= 3 && (
        <>
          {/* Prompt Sections — Copy buttons */}
          {promptSections.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Stitch Prompts ({promptSections.length})
              </p>
              {promptSections.map((section) => {
                const hasResult = resultSections.some(
                  (r) => r.section_key === section.section_key.replace('prompt', 'result').replace('stitch', 'stitch')
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

          {/* Prototypes summary */}
          {implSections.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Screen Prototypes ({sectionStatusSummary(implSections)} approved)
              </p>
              <div className="flex gap-1 flex-wrap">
                {implSections.map((s) => (
                  <span
                    key={s.section_id}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === 'approved'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : s.status === 'rejected'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    }`}
                  >
                    {s.title.replace('Screen: ', '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results Summary */}
          {resultSections.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stitch Exports ({resultSections.length})
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
        </>
      )}

      {/* Step 5: Handoff checklist */}
      {designStep === 5 && (
        <div className="mb-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p className="font-medium text-gray-700 dark:text-gray-300">Handoff Checklist</p>
          <ul className="space-y-0.5">
            <li className={handoffSections.some((s) => s.section_key === 'handoff-design-spec') ? 'text-green-600' : ''}>
              {handoffSections.some((s) => s.section_key === 'handoff-design-spec') ? '&#x2713;' : '&#x25CB;'} Design Spec
            </li>
            <li className={handoffSections.some((s) => s.section_key === 'handoff-component-map') ? 'text-green-600' : ''}>
              {handoffSections.some((s) => s.section_key === 'handoff-component-map') ? '&#x2713;' : '&#x25CB;'} Component Map
            </li>
            <li className={handoffSections.some((s) => s.section_key === 'handoff-stitch-assets') ? 'text-green-600' : ''}>
              {handoffSections.some((s) => s.section_key === 'handoff-stitch-assets') ? '&#x2713;' : '&#x25CB;'} Stitch Assets
            </li>
          </ul>
        </div>
      )}

      {/* Empty state */}
      {sections.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          No design sections yet. DesignClaw will start Reference Discovery when Phase 0-2 sections are approved.
        </p>
      )}
    </div>
  );
}
