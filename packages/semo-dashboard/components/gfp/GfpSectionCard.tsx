'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import MermaidBlock from './MermaidBlock';
import type { GfpPhaseSection, GfpSectionStatus } from '@/types';

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
  focused?: boolean;
  onApprove: (sectionId: string) => void;
  onReject: (sectionId: string, note: string) => void;
}

export default function GfpSectionCard({ section, focused, onApprove, onReject }: GfpSectionCardProps) {
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
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
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
          {/* Rejection note */}
          {section.status === 'rejected' && section.reviewer_note && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700 dark:text-red-300">{section.reviewer_note}</p>
            </div>
          )}

          {/* Markdown content */}
          <div className="prose prose-sm dark:prose-invert max-w-none mb-4 gfp-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
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

          {/* Actions */}
          {(section.status === 'pending-review' || section.status === 'draft') && (
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(section.section_id);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
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
            </div>
          )}
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
