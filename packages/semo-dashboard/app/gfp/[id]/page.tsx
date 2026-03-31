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
import type { GfpProject, GfpPhaseSection, GfpResearchTask } from '@/types';
import type { PhaseProgress } from '@/lib/gfp';

interface ProjectWithProgress extends GfpProject {
  progress: PhaseProgress[];
}

const PHASE_LABELS: Record<number, string> = {
  0: 'Constitution',
  1: 'Discovery',
  2: 'PRD',
  3: 'Design System',
  4: 'Epic',
  5: 'Functional Spec',
  6: 'Technical Plan',
  7: 'Task Breakdown',
  8: 'Handoff',
};

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

  const [project, setProject] = useState<ProjectWithProgress | null>(null);
  const [sections, setSections] = useState<GfpPhaseSection[]>([]);
  const [researchTasks, setResearchTasks] = useState<GfpResearchTask[]>([]);
  const [activePhase, setActivePhase] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSection, setNewSection] = useState({ section_key: '', title: '', content: '' });
  const [initialized, setInitialized] = useState(false);

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
      setLoading(false);
    })();
  }

  async function handlePhaseClick(phase: number) {
    setActivePhase(phase);
    const secs = await fetchSectionsData(id, phase);
    setSections(secs);
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
        <p className="text-lg text-gray-500 dark:text-gray-400">Project not found</p>
        <Link href="/gfp" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Back to projects
        </Link>
      </div>
    );
  }

  const phaseSections = sections;
  const showResearch = activePhase <= 2;
  const showStitch = activePhase === 3;

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
            Owner: {project.owner_name}
            {project.service_domain && ` | Domain: ${project.service_domain}`}
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
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Overall Progress</h3>
          <GfpProgressBar progress={project.progress} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content — Sections */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Phase {activePhase}: {PHASE_LABELS[activePhase] ?? `Phase ${activePhase}`}
            </h2>
            <button
              onClick={() => setShowNewSection(!showNewSection)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showNewSection ? 'Cancel' : '+ Add Section'}
            </button>
          </div>

          {/* New section form */}
          {showNewSection && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Section Key</label>
                  <input
                    type="text"
                    value={newSection.section_key}
                    onChange={(e) => setNewSection((s) => ({ ...s, section_key: e.target.value }))}
                    placeholder="e.g., overview, core-value"
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={newSection.title}
                    onChange={(e) => setNewSection((s) => ({ ...s, title: e.target.value }))}
                    placeholder="Section title"
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Content (Markdown)</label>
                <textarea
                  value={newSection.content}
                  onChange={(e) => setNewSection((s) => ({ ...s, content: e.target.value }))}
                  placeholder="Section content..."
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
                  Add Section
                </button>
              </div>
            </div>
          )}

          {/* Section cards */}
          {phaseSections.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-sm">No sections in this phase yet.</p>
              <p className="text-xs mt-1">Add sections manually or upload a planning document.</p>
            </div>
          ) : (
            phaseSections.map((section) => (
              <GfpSectionCard
                key={section.section_id}
                section={section}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </div>

        {/* Sidebar — Material Upload + Research */}
        <div className="space-y-4">
          <GfpMaterialUpload
            gfpId={id}
            onUploaded={refresh}
          />
          {showStitch && (
            <GfpStitchPanel
              gfpId={id}
              sections={phaseSections}
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
      </div>
    </div>
  );
}
