'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import '../files/markdown.css';
import type { BotSkill } from '@/types';

interface SkillsTabProps {
  botId: string;
}

interface SkillDetail {
  name: string;
  fullName: string;
  content: string | null;
  dbMeta: {
    name: string;
    is_active: boolean;
    category: string | null;
    package: string | null;
    metadata: Record<string, unknown> | null;
    updated_at: string | null;
  } | null;
}

const SOURCE_BADGE: Record<BotSkill['source'], { label: string; className: string }> = {
  synced: {
    label: 'Synced',
    className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  },
  'workspace-only': {
    label: 'WS Only',
    className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  },
  'db-only': {
    label: 'DB Only',
    className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  },
};

export default function SkillsTab({ botId }: SkillsTabProps) {
  const [skills, setSkills] = useState<BotSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bots/${botId}/skills`);
      if (res.ok) {
        setSkills(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Fetch detail when skill selected
  useEffect(() => {
    if (!selectedSkill) {
      setDetail(null);
      setEditMode(false);
      return;
    }
    setDetailLoading(true);
    setEditMode(false);
    fetch(`/api/bots/${botId}/skills/${selectedSkill}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setDetail(data);
        if (data?.content) setEditContent(data.content);
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [botId, selectedSkill]);

  const handleSave = async () => {
    if (!selectedSkill) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bots/${botId}/skills/${selectedSkill}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setDetail((prev) => prev ? { ...prev, content: editContent } : prev);
        setEditMode(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (skill: BotSkill) => {
    try {
      const res = await fetch(`/api/bots/${botId}/skills/${skill.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !skill.isActive }),
      });
      if (res.ok) {
        setSkills((prev) =>
          prev.map((s) => (s.name === skill.name ? { ...s, isActive: !s.isActive } : s))
        );
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Status */}
      {saveSuccess && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs border-b border-green-200 dark:border-green-800">
          저장 완료
        </div>
      )}

      <div className="flex" style={{ minHeight: '500px' }}>
        {/* Left: Skill List */}
        <div
          className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 350px)' }}
        >
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              스킬 ({skills.length})
            </span>
            <button
              onClick={fetchSkills}
              className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Refresh"
            >
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">스킬이 없습니다</div>
          ) : (
            <div className="py-1">
              {skills.map((skill) => {
                const badge = SOURCE_BADGE[skill.source];
                return (
                  <button
                    key={skill.name}
                    onClick={() => setSelectedSkill(skill.name)}
                    className={`w-full text-left px-3 py-2.5 transition-colors ${
                      selectedSkill === skill.name
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-600'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                        {skill.name}
                      </span>
                      {!skill.isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" title="Inactive" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                      {skill.hasReferences && (
                        <span className="text-[10px] text-gray-400">refs</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Skill Detail */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {!selectedSkill ? (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-3">&#x1F9E9;</div>
                <p className="text-sm">스킬을 선택하세요</p>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <>
              {/* Header bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">
                    {detail.fullName}/SKILL.md
                  </span>
                  {detail.dbMeta?.category && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {detail.dbMeta.category}
                    </span>
                  )}
                  {detail.dbMeta?.package && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {detail.dbMeta.package}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Active toggle */}
                  {detail.dbMeta && (
                    <button
                      onClick={() => {
                        const skill = skills.find((s) => s.name === selectedSkill);
                        if (skill) handleToggleActive(skill);
                      }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        skills.find((s) => s.name === selectedSkill)?.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {skills.find((s) => s.name === selectedSkill)?.isActive ? '활성' : '비활성'}
                    </button>
                  )}

                  {/* Edit/Save */}
                  {editMode ? (
                    <>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setEditContent(detail.content || '');
                        }}
                        className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                        disabled={saving}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || editContent === detail.content}
                        className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving ? '저장 중...' : '저장'}
                      </button>
                    </>
                  ) : (
                    detail.content !== null && (
                      <button
                        onClick={() => {
                          setEditContent(detail.content || '');
                          setEditMode(true);
                        }}
                        className="px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      >
                        편집
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {editMode ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full min-h-[400px] p-4 bg-transparent text-sm font-mono text-gray-800 dark:text-gray-200 resize-none focus:outline-none"
                    spellCheck={false}
                  />
                ) : detail.content !== null ? (
                  <div className="markdown-body p-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {detail.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                    SKILL.md 콘텐츠 없음 (DB 전용 스킬)
                  </div>
                )}

                {/* Metadata footer */}
                {detail.dbMeta && (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                      {detail.dbMeta.updated_at && (
                        <span>
                          수정일: {new Date(detail.dbMeta.updated_at).toLocaleString('ko-KR')}
                        </span>
                      )}
                      {detail.dbMeta.category && <span>카테고리: {detail.dbMeta.category}</span>}
                      {detail.dbMeta.package && <span>패키지: {detail.dbMeta.package}</span>}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-red-500 text-sm">
              스킬 로드 실패
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
