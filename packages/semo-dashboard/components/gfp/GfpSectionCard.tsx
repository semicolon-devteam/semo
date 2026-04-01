'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import MermaidBlock from './MermaidBlock';
import GfpQAForm from './GfpQAForm';
import type { GfpPhaseSection, GfpSectionStatus, GfpQAItem } from '@/types';

const STATUS_STYLES: Record<GfpSectionStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: 'Draft' },
  'pending-review': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pending Review' },
  approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Approved' },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Rejected' },
};

const SOURCE_LABELS: Record<string, string> = {
  planclaw: 'PlanClaw',
  imported: 'Imported',
  growthclaw: 'GrowthClaw',
  manual: 'Manual',
};

interface GfpSectionCardProps {
  section: GfpPhaseSection;
  gfpId: string;
  focused?: boolean;
  onApprove: (sectionId: string) => void;
  onReject: (sectionId: string, note: string) => void;
  onUndoReject?: (sectionId: string) => void;
  onQASaved?: () => void;
}

export default function GfpSectionCard({ section, gfpId, focused, onApprove, onReject, onUndoReject, onQASaved }: GfpSectionCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [expanded, setExpanded] = useState(focused || section.status !== 'approved');
  const [highlight, setHighlight] = useState(!!focused);
  const [copied, setCopied] = useState(false);

  // section.status 변경 시 expanded 자동 갱신 (approve → collapsed)
  useEffect(() => {
    if (focused) return; // focused 카드는 무조건 expanded 유지
    setExpanded(section.status !== 'approved');
  }, [section.status, focused]);

  // focused 시 스크롤 + 하이라이트 fade
  useEffect(() => {
    if (focused && ref.current) {
      setExpanded(true);
      // 렌더 완료 후 스크롤 (300ms) — block:'start' + scrollMarginTop으로 nav 아래에 위치
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      const timer = setTimeout(() => setHighlight(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [focused]);

  // focused=false인 카드는 section param이 있을 때 collapsed
  useEffect(() => {
    if (focused === false) setExpanded(false);
  }, [focused]);

  const style = STATUS_STYLES[section.status];

  function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?phase=${section.phase}&section=${section.section_key}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleReject() {
    if (!rejectNote.trim()) return;
    onReject(section.section_id, rejectNote.trim());
    setShowRejectModal(false);
    setRejectNote('');
  }

  return (
    <div
      ref={ref}
      style={{ scrollMarginTop: '80px' }}
      className={`bg-white dark:bg-gray-800 rounded-lg border overflow-hidden transition-all duration-500 ${
        highlight
          ? 'ring-2 ring-blue-500 border-blue-400'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {section.title}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
            {style.label}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {SOURCE_LABELS[section.source] ?? section.source}
          </span>
          {section.kb_written_at && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
              KB
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={handleCopyLink}
            className="text-gray-400 hover:text-blue-500 transition-colors text-sm p-0.5"
            title="섹션 링크 복사"
          >
            {copied ? '✓' : '🔗'}
          </button>
          <span className="text-gray-400 text-sm">
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4">
          {/* Rejection note + Undo */}
          {section.status === 'rejected' && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Rejection Reason</p>
                  {section.reviewer_note && (
                    <p className="text-sm text-red-700 dark:text-red-300">{section.reviewer_note}</p>
                  )}
                </div>
                {onUndoReject && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUndoReject(section.section_id);
                    }}
                    className="shrink-0 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Undo Reject
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content: Q&A form or Markdown */}
          {section.qa_items && Array.isArray(section.qa_items) && section.qa_items.length > 0 ? (
            <div className="mb-4">
              <GfpQAForm
                sectionId={section.section_id}
                gfpId={gfpId}
                qaItems={section.qa_items as GfpQAItem[]}
                onSaved={onQASaved ?? (() => {})}
              />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none mb-4 gfp-prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  a({ href, children, ...props }) {
                    return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                  },
                  code({ className, children, ...props }) {
                    if (/language-mermaid/.test(className || '')) {
                      return <MermaidBlock code={String(children).trim()} />;
                    }
                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {section.content || '*No content yet*'}
              </ReactMarkdown>
            </div>
          )}

          {/* Actions */}
          {(section.status === 'pending-review' || section.status === 'draft') && (() => {
            const qaItems = section.qa_items as GfpQAItem[] | null;
            const unansweredCount = qaItems
              ? qaItems.filter((q) => !q.answer).length
              : 0;
            const approveDisabled = unansweredCount > 0;

            return (
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(section.section_id);
                  }}
                  disabled={approveDisabled}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                  title={approveDisabled ? `${unansweredCount} unanswered question(s)` : undefined}
                >
                  Approve
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRejectModal(true);
                  }}
                  className="px-4 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 text-sm font-medium rounded-md transition-colors"
                >
                  Reject
                </button>
                {approveDisabled && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {unansweredCount} unanswered
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowRejectModal(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reject Section
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Provide a reason — PlanClaw will regenerate based on your feedback.
              </p>
            </div>
            <div className="px-6 py-4">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Why is this section being rejected? What should be changed?"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectNote.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
