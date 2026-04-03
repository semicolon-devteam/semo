'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import MermaidBlock from './MermaidBlock';
import GfpQAForm from './GfpQAForm';
import GfpDesignPreview, { extractHtmlFromContent } from './GfpDesignPreview';
import ColorCodeBlock from './ColorCodeBlock';
import ColorPaletteSummary from './ColorPaletteSummary';
import TypographyPreviewFull from './TypographyPreviewFull';
import SpacingPreviewFull from './SpacingPreviewFull';
import ComponentStylePicker from './ComponentStylePicker';
import { hasMultipleColors } from '@/lib/design-system-parser';
import { usePoProfile } from './PoProfileContext';
import { shouldShowCode } from '@/lib/po-profile';
import type { GfpPhaseSection, GfpSectionStatus, GfpQAItem } from '@/types';

const STATUS_STYLES: Record<GfpSectionStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: '초안' },
  'pending-review': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: '검토 대기' },
  approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: '승인됨' },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: '거절됨' },
};

const SOURCE_LABELS: Record<string, string> = {
  planclaw: 'PlanClaw',
  imported: '가져옴',
  growthclaw: 'GrowthClaw',
  manual: '수동',
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
  const poProfile = usePoProfile();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [expanded, setExpanded] = useState(focused || section.status !== 'approved');
  const [highlight, setHighlight] = useState(!!focused);
  const [copied, setCopied] = useState(false);

  // section.status 변경 시 expanded 자동 갱신 (approve → collapsed)
  useEffect(() => {
    if (focused) return; // focused 카드는 무조건 expanded 유지
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(section.status !== 'approved');
  }, [section.status, focused]);

  // focused 시 스크롤 + 하이라이트 fade
  useEffect(() => {
    if (focused && ref.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpanded(true);
      // 렌더 완료 후 스크롤 (300ms) — block:'start' + scrollMarginTop으로 nav 아래에 위치
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      const timer = setTimeout(() => setHighlight(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [focused]);

  // focused=false인 카드는 section param이 있을 때 collapsed
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">거절 사유</p>
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
                    거절 취소
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content: Q&A form, Design Preview, or Markdown */}
          {section.qa_items && Array.isArray(section.qa_items) && section.qa_items.length > 0 ? (
            <div className="mb-4">
              <GfpQAForm
                sectionId={section.section_id}
                gfpId={gfpId}
                qaItems={section.qa_items as GfpQAItem[]}
                onSaved={onQASaved ?? (() => {})}
              />
            </div>
          ) : section.section_key.startsWith('ds-color') ? (
            <div className="mb-4">
              <ColorPaletteSummary content={section.content} />
              <CodeAccordion content={section.content} />
            </div>
          ) : section.section_key.startsWith('ds-typo') ? (
            <div className="mb-4">
              <TypographyPreviewFull content={section.content} />
              <CodeAccordion content={section.content} />
            </div>
          ) : section.section_key.startsWith('ds-spac') ? (
            <div className="mb-4">
              <SpacingPreviewFull content={section.content} />
              <CodeAccordion content={section.content} />
            </div>
          ) : section.section_key.startsWith('ds-component') ? (
            <div className="mb-4">
              <ComponentStylePicker
                content={section.content}
                sectionId={section.section_id}
                gfpId={gfpId}
              />
              <CodeAccordion content={section.content} />
            </div>
          ) : (section.section_key.startsWith('impl-screen-') || section.section_key.startsWith('stitch-result-')) && extractHtmlFromContent(section.content) ? (
            <div className="mb-4 space-y-3">
              {/* Description text above the preview */}
              {(() => {
                const descPart = section.content.split('```html')[0].trim();
                return descPart ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {descPart}
                    </ReactMarkdown>
                  </div>
                ) : null;
              })()}
              <GfpDesignPreview
                htmlContent={extractHtmlFromContent(section.content)!}
                title={section.title}
              />
            </div>
          ) : (
            <div className="mb-4">
              {/* Non-technical PO: 기술 페이즈(7,8) 콘텐츠를 접어서 표시 */}
              {poProfile.tech_level === 'non-technical' && section.phase >= 7 && (
                <div className="mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    기술적 세부사항은 봇이 처리합니다. 아래에서 요약을 확인하세요.
                  </p>
                </div>
              )}
              <div className={`prose prose-sm dark:prose-invert max-w-none gfp-prose ${
                poProfile.tech_level === 'non-technical' && section.phase >= 7 ? 'max-h-[200px] overflow-hidden relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-12 after:bg-gradient-to-t after:from-white dark:after:from-gray-800' : ''
              }`}>
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
                      const text = String(children);
                      if (hasMultipleColors(text)) {
                        return <ColorCodeBlock className={className}>{children}</ColorCodeBlock>;
                      }
                      return <code className={className} {...props}>{children}</code>;
                    },
                  }}
                >
                  {section.content || '*아직 내용이 없습니다*'}
                </ReactMarkdown>
              </div>
              {poProfile.tech_level === 'non-technical' && section.phase >= 7 && (
                <details className="mt-1">
                  <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600">
                    전체 내용 보기
                  </summary>
                  <div className="mt-2 prose prose-sm dark:prose-invert max-w-none gfp-prose">
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
                          const text = String(children);
                          if (hasMultipleColors(text)) {
                            return <ColorCodeBlock className={className}>{children}</ColorCodeBlock>;
                          }
                          return <code className={className} {...props}>{children}</code>;
                        },
                      }}
                    >
                      {section.content || '*아직 내용이 없습니다*'}
                    </ReactMarkdown>
                  </div>
                </details>
              )}
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
                  title={approveDisabled ? `${unansweredCount}개 미답변 질문` : undefined}
                >
                  승인
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRejectModal(true);
                  }}
                  className="px-4 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 text-sm font-medium rounded-md transition-colors"
                >
                  거절
                </button>
                {approveDisabled && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {unansweredCount}개 미답변
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
                섹션 거절
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                사유를 입력하세요 — PlanClaw가 피드백을 반영하여 재생성합니다.
              </p>
            </div>
            <div className="px-6 py-4">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="이 섹션을 거절하는 이유는? 무엇을 변경해야 하나요?"
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
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectNote.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                거절
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 비주얼 프리뷰 하단에 원본 코드를 접어서 보여주는 아코디언 */
function CodeAccordion({ content }: { content: string }) {
  const poProfile = usePoProfile();
  const showByDefault = shouldShowCode(poProfile) && poProfile.tech_level === 'advanced';

  return (
    <details className="mt-3" open={showByDefault || undefined}>
      <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
        코드 보기
      </summary>
      <div className="mt-2 prose prose-sm dark:prose-invert max-w-none gfp-prose">
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
              const text = String(children);
              if (hasMultipleColors(text)) {
                return <ColorCodeBlock className={className}>{children}</ColorCodeBlock>;
              }
              return <code className={className} {...props}>{children}</code>;
            },
          }}
        >
          {content || '*아직 내용이 없습니다*'}
        </ReactMarkdown>
      </div>
    </details>
  );
}
