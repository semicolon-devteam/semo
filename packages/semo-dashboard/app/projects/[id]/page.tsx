'use client';

import { useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ServicePhaseNav from '@/components/service/ServicePhaseNav';
import ServiceProgressBar from '@/components/service/ServiceProgressBar';
import ServiceSectionCard from '@/components/service/ServiceSectionCard';
import ServiceMaterialUpload from '@/components/service/ServiceMaterialUpload';
import ServiceResearchPanel from '@/components/service/ServiceResearchPanel';
import ServiceStitchPanel from '@/components/service/ServiceStitchPanel';
import ServiceDesignStepNav from '@/components/service/ServiceDesignStepNav';
import ServicePresetInfoPanel from '@/components/service/ServicePresetInfoPanel';
import ServiceInfraRequestPanel from '@/components/service/ServiceInfraRequestPanel';
import ServiceInfraFlagModal from '@/components/service/ServiceInfraFlagModal';
import type {
  ServiceProject,
  ServiceSection,
  GfpResearchTask,
  GfpInfraRequest,
  DesignStep,
  ServicePresetId,
  ServiceTrack,
} from '@/types';
import { DESIGN_STEPS, matchesStep } from '@/types';
import type { PhaseProgress } from '@/lib/service';
import { PHASE_LABELS, INFRA_PHASE_LABELS } from '@/lib/service-phases';
import { GFP_PRESETS } from '@/lib/service-presets';
import { PoProfileProvider } from '@/components/service/PoProfileContext';
import { getPoProfile } from '@/lib/po-profile';

interface ProjectWithProgress extends ServiceProject {
  progress: PhaseProgress[];
}

async function fetchProjectData(id: string): Promise<ProjectWithProgress | null> {
  try {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchSectionsData(
  id: string,
  phase: number,
  track: ServiceTrack = 'plan',
): Promise<ServiceSection[]> {
  try {
    const res = await fetch(`/api/projects/${id}/sections?phase=${phase}&track=${track}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchResearchData(id: string): Promise<GfpResearchTask[]> {
  try {
    const res = await fetch(`/api/projects/${id}/research`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchInfraRequests(id: string): Promise<GfpInfraRequest[]> {
  try {
    const res = await fetch(`/api/projects/${id}/infra-requests`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchInfraProgress(id: string): Promise<PhaseProgress[]> {
  try {
    // Fetch all sections for infra track and compute progress client-side
    const res = await fetch(`/api/projects/${id}/sections?track=infra`);
    if (!res.ok) return [];
    const sections: ServiceSection[] = await res.json();
    const phaseMap = new Map<number, PhaseProgress>();
    for (const s of sections) {
      if (!phaseMap.has(s.phase)) {
        phaseMap.set(s.phase, {
          phase: s.phase,
          total: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          draft: 0,
        });
      }
      const p = phaseMap.get(s.phase)!;
      p.total++;
      if (s.status === 'approved') p.approved++;
      else if (s.status === 'rejected') p.rejected++;
      else if (s.status === 'pending-review') p.pending++;
      else p.draft++;
    }
    return Array.from(phaseMap.values()).sort((a, b) => a.phase - b.phase);
  } catch {
    return [];
  }
}

export default function GfpDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const phaseParam = searchParams.get('phase');
  const sectionParam = searchParams.get('section');
  const trackParam = searchParams.get('track') as ServiceTrack | null;
  const stepParam = searchParams.get('step');
  const actionParam = searchParams.get('action');
  const sectionIdParam = searchParams.get('sectionId');

  const [project, setProject] = useState<ProjectWithProgress | null>(null);
  const [slackActionProcessed, setSlackActionProcessed] = useState(false);
  const [sections, setSections] = useState<ServiceSection[]>([]);
  const [researchTasks, setResearchTasks] = useState<GfpResearchTask[]>([]);
  const [infraRequests, setInfraRequests] = useState<GfpInfraRequest[]>([]);
  const [infraProgress, setInfraProgress] = useState<PhaseProgress[]>([]);
  const [activePhase, setActivePhase] = useState(0);
  const [activeTrack, setActiveTrack] = useState<ServiceTrack>(trackParam ?? 'plan');
  const [loading, setLoading] = useState(true);
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSection, setNewSection] = useState({ section_key: '', title: '', content: '' });
  const [initialized, setInitialized] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeDesignStep, setActiveDesignStep] = useState<DesignStep>(1);
  const [showInfraFlagModal, setShowInfraFlagModal] = useState(false);
  const [infraFlagSectionId, setInfraFlagSectionId] = useState<string | undefined>();

  const refresh = useCallback(
    // eslint-disable-next-line -- pre-existing memoization pattern
    async (phase?: number, track?: ServiceTrack) => {
      const p = phase ?? activePhase;
      const t = track ?? activeTrack;
      const [proj, secs, tasks, infraReqs, infraProg] = await Promise.all([
        fetchProjectData(id),
        fetchSectionsData(id, p, t),
        fetchResearchData(id),
        fetchInfraRequests(id),
        fetchInfraProgress(id),
      ]);
      setProject(proj);
      setSections(secs);
      setResearchTasks(tasks);
      setInfraRequests(infraReqs);
      setInfraProgress(infraProg);
      setLoading(false);
    },
    [id, activePhase, activeTrack],
  );

  // Initial load: project 먼저 가져온 뒤 올바른 Phase로 섹션 로드
  if (loading && !initialized) {
    setInitialized(true);
    (async () => {
      const proj = await fetchProjectData(id);
      if (!proj) {
        setLoading(false);
        return;
      }
      const initTrack = trackParam ?? 'plan';
      // URL ?phase=N 우선, 없으면 current_phase (or infra_phase for infra track)
      const targetPhase =
        phaseParam !== null
          ? parseInt(phaseParam, 10)
          : initTrack === 'infra'
            ? Math.min(proj.infra_phase ?? 0, 2)
            : (proj.current_phase ?? 0);
      setActivePhase(targetPhase);
      setActiveTrack(initTrack);
      const [secs, tasks, infraReqs, infraProg] = await Promise.all([
        fetchSectionsData(id, targetPhase, initTrack),
        fetchResearchData(id),
        fetchInfraRequests(id),
        fetchInfraProgress(id),
      ]);
      setProject(proj);
      setSections(secs);
      setResearchTasks(tasks);
      setInfraRequests(infraReqs);
      setInfraProgress(infraProg);
      // Phase 4: determine active design step
      if (targetPhase === 4 && initTrack === 'plan') {
        let ds: number | null = null;

        // 1. URL ?step= 직접 지정
        if (stepParam) {
          ds = parseInt(stepParam, 10);
        }
        // 2. URL ?section= prefix에서 추론
        if (!ds && sectionParam) {
          const matched = DESIGN_STEPS.find((def) => matchesStep(sectionParam, def));
          if (matched) ds = matched.step;
        }
        // 3. project metadata에서
        if (!ds) {
          ds = (proj.metadata?.design_step as number) ?? null;
        }
        // 4. 폴백: 첫 번째 콘텐츠가 있는 step 찾기 (빈 Step 1 스킵)
        if (!ds || ds < 1 || ds > 5) {
          const firstActive = DESIGN_STEPS.find((def) => {
            const stepSecs = secs.filter((s) => matchesStep(s.section_key, def));
            return stepSecs.length > 0;
          });
          ds = firstActive?.step ?? 1;
        }

        setActiveDesignStep(ds as DesignStep);
      }
      setLoading(false);

      // Slack URL 버튼에서 진입한 경우 자동 액션 처리
      if (actionParam && sectionIdParam && !slackActionProcessed) {
        setSlackActionProcessed(true);
        if (actionParam === 'approve') {
          if (window.confirm(`이 섹션을 승인하시겠습니까?`)) {
            try {
              const res = await fetch(`/api/projects/${id}/sections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sectionId: sectionIdParam, action: 'approve' }),
              });
              if (res.ok) {
                alert('승인 완료');
                await refresh(targetPhase, initTrack);
              } else {
                alert('승인 실패: ' + (await res.text()));
              }
            } catch {
              alert('승인 처리 중 오류 발생');
            }
          }
        } else if (actionParam === 'reject') {
          const reason = window.prompt('거절 사유를 입력해주세요:');
          if (reason !== null) {
            try {
              const res = await fetch(`/api/projects/${id}/sections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sectionId: sectionIdParam,
                  action: 'reject',
                  reviewerNote: reason,
                }),
              });
              if (res.ok) {
                alert('거절 완료');
                await refresh(targetPhase, initTrack);
              } else {
                alert('거절 실패: ' + (await res.text()));
              }
            } catch {
              alert('거절 처리 중 오류 발생');
            }
          }
        }
        // URL에서 action param 제거 (뒤로가기 시 재실행 방지)
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('sectionId');
        window.history.replaceState({}, '', url.toString());
      }
    })();
  }

  async function handlePhaseClick(phase: number) {
    setActivePhase(phase);
    const secs = await fetchSectionsData(id, phase, activeTrack);
    setSections(secs);
    if (phase === 4 && activeTrack === 'plan') {
      // 첫 번째 콘텐츠가 있는 step으로 이동 (빈 Step 1 스킵)
      const firstActive = DESIGN_STEPS.find((def) => {
        const stepSecs = secs.filter((s) => matchesStep(s.section_key, def));
        return stepSecs.length > 0;
      });
      const ds = firstActive?.step ?? ((project?.metadata?.design_step as number) || 1);
      setActiveDesignStep(ds as DesignStep);
    }
  }

  async function handleTrackChange(track: ServiceTrack) {
    setActiveTrack(track);
    const targetPhase =
      track === 'infra' ? Math.min(project?.infra_phase ?? 0, 2) : (project?.current_phase ?? 0);
    setActivePhase(targetPhase);
    const secs = await fetchSectionsData(id, targetPhase, track);
    setSections(secs);
  }

  async function handleApprove(sectionId: string) {
    await fetch(`/api/projects/${id}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, status: 'approved' }),
    });
    refresh();
  }

  async function handleReject(sectionId: string, note: string) {
    await fetch(`/api/projects/${id}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, status: 'rejected', reviewer_note: note }),
    });
    refresh();
  }

  async function handleUndoReject(sectionId: string) {
    await fetch(`/api/projects/${id}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, status: 'pending-review' }),
    });
    refresh();
  }

  async function handleApproveAll() {
    const targets = sections.filter((s) => s.status !== 'approved' && s.status !== 'rejected');
    if (targets.length === 0) return;
    setApprovingAll(true);
    for (const s of targets) {
      await fetch(`/api/projects/${id}/sections`, {
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
    await fetch(`/api/projects/${id}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: activePhase,
        section_key: newSection.section_key.trim(),
        title: newSection.title.trim(),
        content: newSection.content.trim(),
        status: 'draft',
        source: 'manual',
        track: activeTrack,
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

  // lifecycle='ops' or 'sunset' → 운영 대시보드 렌더
  if (project.lifecycle === 'ops' || project.lifecycle === 'sunset') {
    const ServiceOpsView = require('@/components/service-ops/ServiceOpsView').default;
    return <ServiceOpsView projectId={id} />;
  }

  const hasInfraTrack = project.infra_phase !== null && project.infra_phase !== undefined;
  const showResearch = activeTrack === 'plan' && activePhase <= 2;
  const showStitch = activeTrack === 'plan' && activePhase === 4;
  const phaseLabels = activeTrack === 'plan' ? PHASE_LABELS : INFRA_PHASE_LABELS;

  // Phase 3: filter sections by active design step
  const activeStepDef = DESIGN_STEPS.find((s) => s.step === activeDesignStep);
  const phaseSections =
    showStitch && activeStepDef
      ? sections.filter((s) => matchesStep(s.section_key, activeStepDef))
      : sections;

  // Build step statuses for the nav
  const stepStatuses: Record<number, 'pending' | 'in-progress' | 'completed'> = {};
  const skippedSteps = (project.metadata?.skipped_design_steps as number[]) ?? [];
  if (showStitch) {
    for (const def of DESIGN_STEPS) {
      if (skippedSteps.includes(def.step)) {
        stepStatuses[def.step] = 'completed'; // 스킵된 step은 완료로 표시
        continue;
      }
      const stepSecs = sections.filter((s) => matchesStep(s.section_key, def));
      if (stepSecs.length === 0) {
        stepStatuses[def.step] = 'pending';
      } else if (stepSecs.every((s) => s.status === 'approved')) {
        stepStatuses[def.step] = 'completed';
      } else {
        stepStatuses[def.step] = 'in-progress';
      }
    }
  }

  const poProfile = getPoProfile(project.metadata as Record<string, unknown>);

  return (
    <PoProfileProvider value={poProfile}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/gfp"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
              >
                GFP
              </Link>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {project.project_name}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>오너: {project.owner_name}</span>
              {project.service_domain && <span>| 도메인: {project.service_domain}</span>}
              {(() => {
                const pid = (project.metadata as Record<string, unknown>)?.preset as
                  | ServicePresetId
                  | undefined;
                const pdef = pid && pid !== 'standard' ? GFP_PRESETS[pid] : null;
                return pdef ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {pdef.label}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        {/* Phase Navigation */}
        <div className="mb-6">
          <ServicePhaseNav
            currentPhase={activePhase}
            progress={project.progress}
            onPhaseClick={handlePhaseClick}
            skipCcPhases={(() => {
              const pc = (project.metadata as Record<string, unknown>)?.preset_config as
                | Record<string, unknown>
                | undefined;
              return (pc?.skip_cc as number[]) ?? [];
            })()}
            activeTrack={activeTrack}
            infraPhase={project.infra_phase}
            infraProgress={infraProgress}
            onTrackChange={hasInfraTrack ? handleTrackChange : undefined}
          />
        </div>

        {/* Progress Overview */}
        {project.progress.length > 0 && activeTrack === 'plan' && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              전체 진행률
            </h3>
            <ServiceProgressBar progress={project.progress} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content — Sections */}
          <div className="lg:col-span-2 space-y-4">
            {/* Phase 3: Design Step Navigation */}
            {showStitch && (
              <div className="mb-4">
                <ServiceDesignStepNav
                  currentStep={activeDesignStep}
                  stepStatuses={stepStatuses}
                  onStepClick={setActiveDesignStep}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeTrack === 'infra' ? `인프라 ${activePhase}단계` : `${activePhase}단계`}:{' '}
                {phaseLabels[activePhase] ?? `${activePhase}단계`}
                {showStitch && activeStepDef && (
                  <span className="text-sm font-normal text-purple-600 dark:text-purple-400 ml-2">
                    / {activeStepDef.label}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                {/* Infra flag button (only on plan track) */}
                {activeTrack === 'plan' && hasInfraTrack && (
                  <button
                    onClick={() => {
                      setInfraFlagSectionId(undefined);
                      setShowInfraFlagModal(true);
                    }}
                    className="text-xs px-3 py-1.5 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-medium rounded-md transition-colors"
                  >
                    인프라 요구사항
                  </button>
                )}
                {phaseSections.filter((s) => s.status !== 'approved' && s.status !== 'rejected')
                  .length > 0 && (
                  <button
                    onClick={handleApproveAll}
                    disabled={approvingAll}
                    className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-md transition-colors inline-flex items-center gap-1.5"
                  >
                    {approvingAll && (
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    전체승인 (
                    {
                      phaseSections.filter(
                        (s) => s.status !== 'approved' && s.status !== 'rejected',
                      ).length
                    }
                    )
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
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      섹션 키
                    </label>
                    <input
                      type="text"
                      value={newSection.section_key}
                      onChange={(e) =>
                        setNewSection((s) => ({ ...s, section_key: e.target.value }))
                      }
                      placeholder="예: overview, core-value"
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      제목
                    </label>
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
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    내용 (Markdown)
                  </label>
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
                <ServiceSectionCard
                  key={section.section_id}
                  section={section}
                  serviceId={id}
                  focused={sectionParam ? section.section_key === sectionParam : undefined}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onUndoReject={handleUndoReject}
                  onQASaved={refresh}
                />
              ))
            )}
          </div>

          {/* Sidebar — Material Upload + Research + Infra */}
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
                <ServicePresetInfoPanel metadata={project.metadata as Record<string, unknown>} />
                {/* Infra request panel (always visible if infra track exists) */}
                {hasInfraTrack && (
                  <ServiceInfraRequestPanel
                    serviceId={id}
                    requests={infraRequests}
                    onRefresh={() => refresh()}
                  />
                )}
                <ServiceMaterialUpload serviceId={id} onUploaded={refresh} />
                {showStitch && (
                  <ServiceStitchPanel
                    serviceId={id}
                    sections={sections}
                    designStep={activeDesignStep}
                    onUploaded={refresh}
                  />
                )}
                {showResearch && (
                  <ServiceResearchPanel
                    serviceId={id}
                    tasks={researchTasks}
                    onTaskCreated={refresh}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Infra Flag Modal */}
        {showInfraFlagModal && (
          <ServiceInfraFlagModal
            serviceId={id}
            sourcePhase={activePhase}
            sourceSectionId={infraFlagSectionId}
            onClose={() => setShowInfraFlagModal(false)}
            onCreated={() => refresh()}
          />
        )}
      </div>
    </PoProfileProvider>
  );
}
