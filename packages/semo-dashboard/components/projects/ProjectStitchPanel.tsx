'use client';

import { useState } from 'react';
import type { ServiceSection, DesignStep } from '@/types';
import { DESIGN_STEPS, matchesStep } from '@/types';
import DesignSystemPreview from './DesignSystemPreview';

interface GfpDesignToolsPanelProps {
  serviceId: string;
  sections: ServiceSection[];
  designStep: DesignStep;
  onUploaded: () => void;
}

export default function GfpStitchPanel({
  serviceId,
  sections,
  designStep,
  onUploaded,
}: GfpDesignToolsPanelProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [targetPrompt, setTargetPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const promptSections = sections.filter(
    (s) => s.section_key.startsWith('stitch-prompt-') || s.section_key.startsWith('impl-stitch-'),
  );
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
          service_id: serviceId,
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

  function sectionStatusSummary(secs: ServiceSection[]) {
    const approved = secs.filter((s) => s.status === 'approved').length;
    return `${approved}/${secs.length}`;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400">디자인 도구</h3>
        <a
          href="https://stitch.withgoogle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
        >
          Stitch 열기
        </a>
      </div>

      {/* Step Progress Overview */}
      <div className="mb-4 space-y-1.5">
        {DESIGN_STEPS.map((def) => {
          const stepSecs = sections.filter((s) => matchesStep(s.section_key, def));
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
              <span>
                {def.step}. {def.label}
              </span>
              <span>
                {allApproved ? '✓' : stepSecs.length > 0 ? sectionStatusSummary(stepSecs) : '-'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Design System Preview — ds-* 섹션이 있으면 Phase 4 전체에서 표시 */}
      {dsSections.length > 0 && <DesignSystemPreview sections={dsSections} />}

      {/* Step 1-2: Reference & Design System summary */}
      {(designStep === 1 || designStep === 2) && (
        <div className="mb-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {designStep === 1 ? '레퍼런스 탐색' : '디자인 시스템'}
          </p>
          <p>
            {designStep === 1
              ? 'DesignClaw가 레퍼런스 수집을 위한 Q&A 섹션을 생성합니다. 대시보드 또는 Slack에서 답변하세요.'
              : 'DesignClaw가 디자인 시스템 섹션(색상, 타이포그래피, 여백, 컴포넌트)을 생성합니다.'}
          </p>
          {refSections.length > 0 && designStep === 1 && (
            <p className="text-purple-600 dark:text-purple-400">
              레퍼런스: {sectionStatusSummary(refSections)} 승인됨
            </p>
          )}
          {dsSections.length > 0 && designStep === 2 && (
            <p className="text-purple-600 dark:text-purple-400">
              디자인 시스템: {sectionStatusSummary(dsSections)} 승인됨
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
                Stitch 프롬프트 ({promptSections.length})
              </p>
              {promptSections.map((section) => {
                const hasResult = resultSections.some(
                  (r) =>
                    r.section_key ===
                    section.section_key.replace('prompt', 'result').replace('stitch', 'stitch'),
                );
                return (
                  <div
                    key={section.section_id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-md"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {hasResult && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                        {section.title}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(section.content, section.section_id)}
                      className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors shrink-0 ml-2"
                    >
                      {copiedId === section.section_id ? '복사됨!' : '복사'}
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
                화면 프로토타입 ({sectionStatusSummary(implSections)} 승인됨)
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
                Stitch 결과물 ({resultSections.length})
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
            {showUpload ? '업로드 취소' : 'Stitch 결과물 업로드'}
          </button>

          {showUpload && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
              {promptSections.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    대상 프롬프트
                  </label>
                  <select
                    value={targetPrompt}
                    onChange={(e) => setTargetPrompt(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">프롬프트 선택...</option>
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
                  Tailwind CSS 결과물
                </label>
                <textarea
                  value={exportContent}
                  onChange={(e) => setExportContent(e.target.value)}
                  placeholder="Stitch Tailwind CSS 결과물을 여기에 붙여넣으세요..."
                  rows={6}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={
                    uploading ||
                    !exportContent.trim() ||
                    (!targetPrompt && promptSections.length > 0)
                  }
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-medium rounded-md transition-colors"
                >
                  {uploading && (
                    <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  결과물 업로드
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 5: Handoff checklist */}
      {designStep === 5 && (
        <div className="mb-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p className="font-medium text-gray-700 dark:text-gray-300">핸드오프 체크리스트</p>
          <ul className="space-y-0.5">
            <li
              className={
                handoffSections.some((s) => s.section_key === 'handoff-design-spec')
                  ? 'text-green-600'
                  : ''
              }
            >
              {handoffSections.some((s) => s.section_key === 'handoff-design-spec') ? '✓' : '○'}{' '}
              디자인 스펙
            </li>
            <li
              className={
                handoffSections.some((s) => s.section_key === 'handoff-component-map')
                  ? 'text-green-600'
                  : ''
              }
            >
              {handoffSections.some((s) => s.section_key === 'handoff-component-map') ? '✓' : '○'}{' '}
              컴포넌트 맵
            </li>
            <li
              className={
                handoffSections.some((s) => s.section_key === 'handoff-stitch-assets')
                  ? 'text-green-600'
                  : ''
              }
            >
              {handoffSections.some((s) => s.section_key === 'handoff-stitch-assets') ? '✓' : '○'}{' '}
              Stitch 에셋
            </li>
          </ul>
        </div>
      )}

      {/* Empty state */}
      {sections.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          아직 디자인 섹션이 없습니다. Phase 0-2 섹션이 승인되면 DesignClaw가 레퍼런스 탐색을
          시작합니다.
        </p>
      )}
    </div>
  );
}
