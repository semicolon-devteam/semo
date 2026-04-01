'use client';

import { useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GfpPhaseNav from '@/components/gfp/GfpPhaseNav';
import GfpProgressBar from '@/components/gfp/GfpProgressBar';
import GfpSectionCard from '@/components/gfp/GfpSectionCard';
import GfpMaterialUpload from '@/components/gfp/GfpMaterialUpload';
import GfpResearchPanel from '@/components/gfp/GfpResearchPanel';
import GfpStitchPanel from '@/components/gfp/GfpStitchPanel';
import GfpDesignStepNav from '@/components/gfp/GfpDesignStepNav';
import type { GfpProject, GfpPhaseSection, GfpResearchTask, DesignStep } from '@/types';
import { DESIGN_STEPS } from '@/types';
import type { PhaseProgress } from '@/lib/gfp';
import { PHASE_LABELS } from '@/lib/gfp-phases';

interface ProjectWithProgress extends GfpProject {
  progress: PhaseProgress[];
}

async function fetchProjectData(id: string): Promise<ProjectWithProgress | null> {
  try {
    const res = await fetch(`/api/gfp/${id}`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchSectionsData(id: string, phase: number): Promise<GfpPhaseSection[]> {
  try {
    const res = await fetch(`/api/gfp/${id}/sections?phase=${phase}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchResearchData(id: string): Promise<GfpResearchTask[]> {
  try {
    const res = await fetch(`/api/gfp/${id}/research`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default function GfpDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const phaseParam = searchParams.get('phase');
  const sectionParam = searchParams.get('section');

  const [project, setProject] = useState<ProjectWithProgress | null>(null);
  const [sections, setSections] = useState<GfpPhaseSection[]>([]);
  const [researchTasks, setResearchTasks] = useState<GfpResearchTask[]>([]);
  const [activePhase, setActivePhase] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSection, setNewSection] = useState({ section_key: '', title: '', content: '' });
  const [initialized, setInitialized] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeDesignStep, setActiveDesignStep] = useState<DesignStep>(1);

  const refresh = useCallback(async (phase?: number) => {
    const p = phase ?? activePhase;
    const [proj, secs, tasks] = await Promise.all([
      fetchProjectData(id),
      fetchSectionsData(id, p),
      fetchResearchData(id),
    ]);
    setProject(proj);
    setSections(secs);
    setResearchTasks(tasks);
    setLoading(false);
  }, [id, activePhase]);

  // Initial load: project 먼저 가져온 뒤 올바른 Phase로 섹션 로드
  if (loading && !initialized) {
    setInitialized(true);
    (async () => {
      const proj = await fetchProjectData(id);
      if (!proj) { setLoading(false); return; }
      // URL ?phase=N 우선, 없으면 current_phase
      const targetPhase = phaseParam !== null ? parseInt(phaseParam, 10) : (proj.current_phase ?? 0);
      setActivePhase(targetPhase);
      const [secs, tasks] = await Promise.all([
        fetchSectionsData(id, targetPhase),
        fetchResearchData(id),
      ]);
      setProject(proj);
      setSections(secs);
      setResearchTasks(tasks);
      // Phase 4: fetch design step from project metadata
      if (targetPhase === 4) {
        const ds = (proj.metadata?.design_step as number) ?? 1;
        setActiveDesignStep(ds as DesignStep);
      }
      setLoading(false);
    })();
  }

  async function handlePhaseClick(phase: number) {
    setActivePhase(phase);
    const secs = await fetchSectionsData(id, phase);
    setSections(secs);
    if (phase === 4 && project) {
      const ds = (project.metadata?.design_step as number) ?? 1;
      setActiveDesignStep(ds as DesignStep);
    }
  }

  async function handleApprove(sectionId: string) {
    await fetch(`/api/gfp/${id}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, status: 'approved' }),
    });
    refresh();
  }

  async function handleReject(sectionId: string, note: string) {
    await fetch(`/api/gfp/${id}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, status: 'rejected', reviewer_note: note }),
    });
    refresh();
  }

  async function handleUndoReject(sectionId: string) {
    await fetch(`/api/gfp/${id}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, status: 'pending-review' }),
    });
    refresh();
  }

  async function handleApproveAll() {
    const targets = sections.filter(
      (s) => s.status !== 'approved' && s.status !== 'rejected'
    );
    if (targets.length === 0) return;
    setApprovingAll(true);
    for (const s of targets) {
      await fetch(`/api/gfp/${id}/sections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: s.section_id, status: 'approved' }),
      });
    }
    setApprovingAll(false);
    refresh();
  }

  async function handleAddSection() {
    if (!newSection.section_key.trim() || !newSection.title.trim()) return;
    await fetch(`/api/gfp/${id}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: activePhase,
        section_key: newSection.section_key.trim(),
        title: newSection.title.trim(),
        content: newSection.content.trim(),
        status: 'draft',
        source: 'manual',
      }),
    });
    setNewSection({ section_key: '', title: '', content: '' });
    setShowNewSection(false);
    refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-lg text-gray-500 dark:text-gray-400">프로젝트를 찾을 수 없습니다</p>
        <Link href="/gfp" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          프로젝트 목록으로
        </Link>
      </div>
    );
  }

  const showResearch = activePhase <= 2;
  const showStitch = activePhase === 4;

  // Phase 3: filter sections by active design step
  const activeStepDef = DESIGN_STEPS.find((s) => s.step === activeDesignStep);
  const phaseSections = showStitch && activeStepDef
    ? sections.filter((s) => s.section_key.startsWith(activeStepDef.prefix))
    : sections;

  // Build step statuses for the nav
  const stepStatuses: Record<number, 'pending' | 'in-progress' | 'completed'> = {};
  if (showStitch) {
    for (const def of DESIGN_STEPS) {
      const stepSecs = sections.filter((s) => s.section_key.startsWith(def.prefix));
      if (stepSecs.length === 0) {
        stepStatuses[def.step] = 'pending';
      } else if (stepSecs.every((s) => s.status === 'approved')) {
        stepStatuses[def.step] = 'completed';
      } else {
        stepStatuses[def.step] = 'in-progress';
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/gfp" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
              GFP
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {project.project_name}
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            오너: {project.owner_name}
            {project.service_domain && ` | 도메인: ${project.service_domain}`}
          </p>
        </div>
      </div>

      {/* Phase Navigation */}
      <div className="mb-6">
        <GfpPhaseNav
          currentPhase={activePhase}
          progress={project.progress}
          onPhaseClick={handlePhaseClick}
        />
      </div>

      {/* Progress Overview */}
      {project.progress.length > 0 && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">전체 진행률</h3>
          <GfpProgressBar progress={project.progress} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content — Sections */}
        <div className="lg:col-span-2 space-y-4">
          {/* Phase 3: Design Step Navigation */}
          {showStitch && (
            <div className="mb-4">
              <GfpDesignStepNav
                currentStep={activeDesignStep}
                stepStatuses={stepStatuses}
                onStepClick={setActiveDesignStep}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {activePhase}단계: {PHASE_LABELS[activePhase] ?? `${activePhase}단계`}
              {showStitch && activeStepDef && (
                <span className="text-sm font-normal text-purple-600 dark:text-purple-400 ml-2">
                  / {activeStepDef.label}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3">
              {phaseSections.filter((s) => s.status !== 'approved' && s.status !== 'rejected').length > 0 && (
                <button
                  onClick={handleApproveAll}
                  disabled={approvingAll}
                  className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-md transition-colors inline-flex items-center gap-1.5"
                >
                  {approvingAll && (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  전체승인 ({phaseSections.filter((s) => s.status !== 'approved' && s.status !== 'rejected').length})
                </button>
              )}
              <button
                onClick={() => setShowNewSection(!showNewSection)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showNewSection ? '취소' : '+ 섹션 추가'}
              </button>
            </div>
          </div>

          {/* New section form */}
          {showNewSection && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">섹션 키</label>
                  <input
                    type="text"
                    value={newSection.section_key}
                    onChange={(e) => setNewSection((s) => ({ ...s, section_key: e.target.value }))}
                    placeholder="예: overview, core-value"
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">제목</label>
                  <input
                    type="text"
                    value={newSection.title}
                    onChange={(e) => setNewSection((s) => ({ ...s, title: e.target.value }))}
                    placeholder="섹션 제목"
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">내용 (Markdown)</label>
                <textarea
                  value={newSection.content}
                  onChange={(e) => setNewSection((s) => ({ ...s, content: e.target.value }))}
                  placeholder="섹션 내용..."
                  rows={4}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddSection}
                  disabled={!newSection.section_key.trim() || !newSection.title.trim()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-md transition-colors"
                >
                  섹션 추가
                </button>
              </div>
            </div>
          )}

          {/* Section cards */}
          {phaseSections.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-sm">이 Phase에 섹션이 없습니다.</p>
              <p className="text-xs mt-1">수동으로 섹션을 추가하거나 기획 문서를 업로드하세요.</p>
            </div>
          ) : (
            phaseSections.map((section) => (
              <GfpSectionCard
                key={section.section_id}
                section={section}
                gfpId={id}
                focused={sectionParam ? section.section_key === sectionParam : undefined}
                onApprove={handleApprove}
                onReject={handleReject}
                onUndoReject={handleUndoReject}
                onQASaved={refresh}
              />
            ))
          )}
        </div>

        {/* Sidebar — Material Upload + Research */}
        <div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">도구</span>
            <span className="text-xs text-gray-500">{sidebarOpen ? '▲' : '▼'}</span>
          </button>
          {sidebarOpen && (
            <div className="space-y-4">
              <GfpMaterialUpload
                gfpId={id}
                onUploaded={refresh}
              />
              {showStitch && (
                <GfpStitchPanel
                  gfpId={id}
                  sections={sections}
                  designStep={activeDesignStep}
                  onUploaded={refresh}
                />
              )}
              {showResearch && (
                <GfpResearchPanel
                  gfpId={id}
                  tasks={researchTasks}
                  onTaskCreated={refresh}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
