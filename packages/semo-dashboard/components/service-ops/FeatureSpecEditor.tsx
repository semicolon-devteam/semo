'use client';

import { useState, useEffect } from 'react';
import type {
  ServiceFeature,
  FeatureSpec,
  AcceptanceCriterion,
  UserStory,
  TestScenario,
} from '@/types';
import {
  normalizeSpec,
  nextAcId,
  nextUsId,
  nextTsId,
  specCompleteness,
  acVerificationRate,
} from '@/lib/feature-spec';

interface Props {
  feature: ServiceFeature;
  projectId: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export default function FeatureSpecEditor({ feature, projectId, onClose, onRefresh }: Props) {
  const [spec, setSpec] = useState<FeatureSpec>(normalizeSpec(feature.metadata?.spec));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState<'ac' | 'us' | 'ts'>('ac');

  // AC inline add
  const [newAc, setNewAc] = useState('');
  const [newUs, setNewUs] = useState({ as_a: '', i_want: '', so_that: '' });
  const [newTs, setNewTs] = useState({ title: '', steps: '', expected: '' });

  const completeness = specCompleteness(spec);
  const verification = acVerificationRate(spec);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/features/${feature.feature_id}/spec`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec),
      });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      await fetch(`/api/projects/${projectId}/features/${feature.feature_id}/spec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      alert('PlanClaw에 스펙 생성을 요청했습니다. 완료 시 알림이 옵니다.');
    } finally {
      setGenerating(false);
    }
  };

  const addAc = () => {
    if (!newAc.trim()) return;
    const ac: AcceptanceCriterion = {
      id: nextAcId(spec.acceptance_criteria),
      criterion: newAc.trim(),
      verified: false,
    };
    setSpec({ ...spec, acceptance_criteria: [...spec.acceptance_criteria, ac] });
    setNewAc('');
  };

  const removeAc = (id: string) => {
    setSpec({
      ...spec,
      acceptance_criteria: spec.acceptance_criteria.filter((ac) => ac.id !== id),
    });
  };

  const toggleAcVerified = (id: string) => {
    setSpec({
      ...spec,
      acceptance_criteria: spec.acceptance_criteria.map((ac) =>
        ac.id === id
          ? {
              ...ac,
              verified: !ac.verified,
              verified_at: !ac.verified ? new Date().toISOString() : undefined,
            }
          : ac,
      ),
    });
  };

  const addUs = () => {
    if (!newUs.as_a.trim() || !newUs.i_want.trim()) return;
    const us: UserStory = {
      id: nextUsId(spec.user_stories),
      ...newUs,
      so_that: newUs.so_that || '',
      acceptance_ids: [],
    };
    setSpec({ ...spec, user_stories: [...spec.user_stories, us] });
    setNewUs({ as_a: '', i_want: '', so_that: '' });
  };

  const removeUs = (id: string) => {
    setSpec({ ...spec, user_stories: spec.user_stories.filter((us) => us.id !== id) });
  };

  const addTs = () => {
    if (!newTs.title.trim()) return;
    const ts: TestScenario = {
      id: nextTsId(spec.test_scenarios),
      title: newTs.title,
      steps: newTs.steps.split('\n').filter(Boolean),
      expected: newTs.expected,
      acceptance_ids: [],
    };
    setSpec({ ...spec, test_scenarios: [...spec.test_scenarios, ts] });
    setNewTs({ title: '', steps: '', expected: '' });
  };

  const removeTs = (id: string) => {
    setSpec({ ...spec, test_scenarios: spec.test_scenarios.filter((ts) => ts.id !== id) });
  };

  const RESULT_BADGES: Record<string, { label: string; color: string }> = {
    pass: { label: 'PASS', color: 'text-green-400' },
    fail: { label: 'FAIL', color: 'text-red-400' },
    skip: { label: 'SKIP', color: 'text-zinc-500' },
  };

  const sectionTabs = [
    { key: 'ac' as const, label: `수용 기준 (${spec.acceptance_criteria.length})` },
    { key: 'us' as const, label: `유저 스토리 (${spec.user_stories.length})` },
    { key: 'ts' as const, label: `테스트 시나리오 (${spec.test_scenarios.length})` },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 border border-zinc-600 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{feature.name} — 기능 명세</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-zinc-400">
                  완성도: {completeness.label} ({completeness.score}%)
                </span>
                {verification.total > 0 && (
                  <span className="text-xs text-zinc-400">
                    AC 검증: {verification.verified}/{verification.total}
                  </span>
                )}
                <span
                  className={`text-xs ${spec.spec_status === 'approved' ? 'text-green-400' : spec.spec_status === 'pending-review' ? 'text-blue-400' : 'text-zinc-500'}`}
                >
                  {spec.spec_status === 'approved'
                    ? '승인됨'
                    : spec.spec_status === 'pending-review'
                      ? '검토 대기'
                      : '초안'}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">
              &times;
            </button>
          </div>

          {/* Summary + Effort */}
          <div className="mt-3 flex gap-3">
            <input
              value={spec.summary || ''}
              onChange={(e) => setSpec({ ...spec, summary: e.target.value })}
              className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
              placeholder="기능 요약..."
            />
            <select
              value={spec.estimated_effort || ''}
              onChange={(e) =>
                setSpec({
                  ...spec,
                  estimated_effort: (e.target.value ||
                    undefined) as FeatureSpec['estimated_effort'],
                })
              }
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
            >
              <option value="">규모</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-zinc-700">
          {sectionTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`px-4 py-2 text-sm ${activeSection === tab.key ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Section Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Acceptance Criteria */}
          {activeSection === 'ac' && (
            <div className="space-y-2">
              {spec.acceptance_criteria.map((ac) => (
                <div
                  key={ac.id}
                  className="flex items-center gap-2 py-1.5 px-3 bg-zinc-900/50 rounded group"
                >
                  <input
                    type="checkbox"
                    checked={ac.verified}
                    onChange={() => toggleAcVerified(ac.id)}
                    className="accent-green-500"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">{ac.id}</span>
                  <span
                    className={`text-sm flex-1 ${ac.verified ? 'text-green-300 line-through' : 'text-zinc-200'}`}
                  >
                    {ac.criterion}
                  </span>
                  <button
                    onClick={() => removeAc(ac.id)}
                    className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100"
                  >
                    삭제
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  value={newAc}
                  onChange={(e) => setNewAc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAc()}
                  className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="새 수용 기준 입력 (Enter로 추가)"
                />
                <button
                  onClick={addAc}
                  disabled={!newAc.trim()}
                  className="px-3 py-1.5 text-xs bg-zinc-700 text-white rounded disabled:opacity-50"
                >
                  추가
                </button>
              </div>
            </div>
          )}

          {/* User Stories */}
          {activeSection === 'us' && (
            <div className="space-y-3">
              {spec.user_stories.map((us) => (
                <div key={us.id} className="p-3 bg-zinc-900/50 rounded group">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">{us.id}</span>
                    <span className="text-sm text-zinc-200 flex-1">
                      <strong>{us.as_a}</strong>로서 <strong>{us.i_want}</strong>{' '}
                      {us.so_that && (
                        <>
                          하여 <em>{us.so_that}</em>
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => removeUs(us.id)}
                      className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100"
                    >
                      삭제
                    </button>
                  </div>
                  {us.acceptance_ids.length > 0 && (
                    <div className="mt-1 text-[10px] text-zinc-500">
                      AC: {us.acceptance_ids.join(', ')}
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-2 p-3 bg-zinc-900/30 border border-zinc-700 rounded space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={newUs.as_a}
                    onChange={(e) => setNewUs({ ...newUs, as_a: e.target.value })}
                    className="px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                    placeholder="역할 (As a...)"
                  />
                  <input
                    value={newUs.i_want}
                    onChange={(e) => setNewUs({ ...newUs, i_want: e.target.value })}
                    className="px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                    placeholder="목표 (I want...)"
                  />
                  <input
                    value={newUs.so_that}
                    onChange={(e) => setNewUs({ ...newUs, so_that: e.target.value })}
                    className="px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                    placeholder="이유 (So that...)"
                  />
                </div>
                <button
                  onClick={addUs}
                  disabled={!newUs.as_a || !newUs.i_want}
                  className="px-3 py-1 text-xs bg-zinc-700 text-white rounded disabled:opacity-50"
                >
                  추가
                </button>
              </div>
            </div>
          )}

          {/* Test Scenarios */}
          {activeSection === 'ts' && (
            <div className="space-y-3">
              {spec.test_scenarios.map((ts) => (
                <div key={ts.id} className="p-3 bg-zinc-900/50 rounded group">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">{ts.id}</span>
                    <span className="text-sm text-zinc-200 flex-1">{ts.title}</span>
                    {ts.last_result && (
                      <span
                        className={`text-[10px] font-mono ${RESULT_BADGES[ts.last_result]?.color ?? 'text-zinc-500'}`}
                      >
                        {RESULT_BADGES[ts.last_result]?.label}
                      </span>
                    )}
                    <button
                      onClick={() => removeTs(ts.id)}
                      className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {ts.steps.map((step, i) => (
                      <div key={i}>{step}</div>
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-zinc-300">기대: {ts.expected}</div>
                  {ts.last_tested_at && (
                    <div className="mt-1 text-[10px] text-zinc-500">
                      마지막 테스트: {new Date(ts.last_tested_at).toLocaleString('ko-KR')} by{' '}
                      {ts.last_tested_by}
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-2 p-3 bg-zinc-900/30 border border-zinc-700 rounded space-y-2">
                <input
                  value={newTs.title}
                  onChange={(e) => setNewTs({ ...newTs, title: e.target.value })}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="시나리오 제목"
                />
                <textarea
                  value={newTs.steps}
                  onChange={(e) => setNewTs({ ...newTs, steps: e.target.value })}
                  rows={3}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="테스트 단계 (줄바꿈으로 구분)"
                />
                <input
                  value={newTs.expected}
                  onChange={(e) => setNewTs({ ...newTs, expected: e.target.value })}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                  placeholder="기대 결과"
                />
                <button
                  onClick={addTs}
                  disabled={!newTs.title}
                  className="px-3 py-1 text-xs bg-zinc-700 text-white rounded disabled:opacity-50"
                >
                  추가
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-700 flex items-center justify-between">
          <button
            onClick={generate}
            disabled={generating}
            className="px-3 py-1.5 text-sm text-blue-400 border border-blue-400/30 rounded hover:bg-blue-400/10 disabled:opacity-50"
          >
            {generating ? '요청 중...' : '봇 자동 생성'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
            >
              닫기
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
