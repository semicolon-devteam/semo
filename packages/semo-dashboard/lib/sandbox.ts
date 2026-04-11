/**
 * Sandbox Core — 인큐베이션 샌드박스 핵심 모듈.
 * 프로젝트 생성, teardown, 목록, 리포트, Phase 리셋.
 */

import { query } from './db';
import {
  createProject,
  getProject,
  listProjects,
  listSections,
  updateProject,
  upsertSection,
} from './service';
import { getScenario, generatePlaceholderSection } from './sandbox-scenarios';
import { getPersona } from './sandbox-personas';
import type {
  ServiceProject,
  ServiceSection,
  SandboxConfig,
  SandboxDepth,
  SandboxMode,
  SandboxVirtualPOMode,
  ServiceSectionSource,
} from '@/types';

const MAX_CONCURRENT_SANDBOXES = 3;

// ── Helpers ──

export function isEmptyMode(config: SandboxConfig): boolean {
  return !config.scenario_id;
}

// ── Create ──

export interface CreateSandboxParams {
  scenario_id?: string;
  project_name?: string;
  initial_description?: string;
  depth: SandboxDepth;
  mode?: SandboxMode;
  virtual_po_mode: SandboxVirtualPOMode;
  rejection_rate?: number;
  auto_advance?: boolean;
  phase_delay_ms?: number;
  section_delay_ms?: number;
}

export interface CreateSandboxResult {
  project: ServiceProject;
  error?: string;
}

export async function createSandboxProject(
  params: CreateSandboxParams,
): Promise<CreateSandboxResult> {
  // 동시 실행 제한 체크
  const active = await listSandboxProjects();
  if (active.length >= MAX_CONCURRENT_SANDBOXES) {
    return {
      project: null as unknown as ServiceProject,
      error: `동시 실행 가능한 샌드박스는 최대 ${MAX_CONCURRENT_SANDBOXES}개입니다. 기존 샌드박스를 정리해주세요.`,
    };
  }

  // Empty 모드: scenario_id 없이 생성
  const isEmpty = !params.scenario_id;

  let scenario: ReturnType<typeof getScenario> = null;
  let persona = getPersona('generic')!;

  if (!isEmpty) {
    scenario = getScenario(params.scenario_id!);
    if (!scenario) {
      return {
        project: null as unknown as ServiceProject,
        error: `시나리오 '${params.scenario_id}'를 찾을 수 없습니다.`,
      };
    }
    const scenarioPersona = getPersona(scenario.persona_id);
    if (!scenarioPersona) {
      return {
        project: null as unknown as ServiceProject,
        error: `페르소나 '${scenario.persona_id}'를 찾을 수 없습니다.`,
      };
    }
    persona = scenarioPersona;
  }

  const shortId = Math.random().toString(36).slice(2, 6);
  const serviceDomain = isEmpty
    ? `sandbox-empty-${shortId}`
    : `sandbox-${params.scenario_id}-${shortId}`;
  // Empty 모드는 mock 데이터가 없으므로 항상 live
  const resolvedMode: SandboxMode = isEmpty ? 'live' : (params.mode ?? 'mock');

  // Phase별 거절 가중치 (디자인/기술설계 집중)
  const defaultPhaseWeights: Record<number, number> = {
    0: 0.1,
    1: 0.5,
    2: 0.5,
    3: 0.3,
    4: 2.0, // 디자인 — 거절 집중
    5: 0.5,
    6: 0.8,
    7: 1.8, // 기술 설계 — 거절 집중
    8: 0.5,
    9: 0.3,
  };

  const sandboxConfig: SandboxConfig = {
    enabled: true,
    depth: params.depth,
    mode: resolvedMode,
    virtual_po: {
      mode: params.virtual_po_mode,
      persona_id: isEmpty ? 'generic' : scenario!.persona_id,
      rejection_rate: params.rejection_rate ?? 0.15,
      phase_rejection_weights:
        params.virtual_po_mode === 'semi-auto' ? defaultPhaseWeights : undefined,
    },
    scenario_id: params.scenario_id,
    initial_description: isEmpty ? params.initial_description : undefined,
    auto_advance: params.auto_advance ?? params.virtual_po_mode !== 'interactive',
    slack_suppress: false,
    progressive_reveal: resolvedMode !== 'live',
    phase_timeout_ms: resolvedMode === 'live' ? 300000 : undefined,
    timing: {
      phase_delay_ms: params.phase_delay_ms ?? 500,
      section_delay_ms: params.section_delay_ms ?? 300,
    },
    run_stats: {
      started_at: new Date().toISOString(),
      phases_completed: 0,
      sections_generated: 0,
      sections_reviewed: 0,
      rejections: 0,
    },
    run_generation: 0,
    reinit_count: 0,
  };

  const projectName = isEmpty
    ? `[SANDBOX] ${params.project_name ?? 'Empty Sandbox'}`
    : `[SANDBOX] ${scenario!.project_name}`;

  const project = await createProject({
    project_name: projectName,
    owner_name: `${persona.name} (Virtual PO)`,
    owner_contact: 'sandbox@semo.internal',
    service_domain: serviceDomain,
    metadata: {
      preset: isEmpty ? 'parallel' : scenario!.preset,
      po_profile: persona.po_profile,
      sandbox: sandboxConfig,
      preset_config:
        !isEmpty && scenario!.infra_config ? { infra: scenario!.infra_config } : undefined,
    },
  });

  console.log(
    `[SANDBOX] Created project "${project.project_name}" (${project.service_id}) — ${isEmpty ? 'empty mode' : `scenario: ${params.scenario_id}`}, depth: ${params.depth}, po: ${params.virtual_po_mode}`,
  );

  return { project };
}

// ── Mock Section Injection ──

/**
 * 특정 Phase의 Mock 섹션을 주입.
 * 시나리오에 사전 콘텐츠가 있으면 사용, 없으면 placeholder 생성.
 */
export async function injectMockSections(
  serviceId: string,
  phase: number,
  scenarioId: string,
): Promise<ServiceSection[]> {
  const scenario = getScenario(scenarioId);
  if (!scenario) return [];

  const mockSections = scenario.mock_sections[phase];
  const sections: ServiceSection[] = [];

  if (mockSections && mockSections.length > 0) {
    for (let i = 0; i < mockSections.length; i++) {
      const mock = mockSections[i];
      const section = await upsertSection({
        service_id: serviceId,
        phase,
        track: 'plan',
        section_key: mock.section_key,
        title: mock.title,
        content: mock.content,
        ordinal: i,
        status: 'pending-review',
        source: mock.source as ServiceSectionSource,
      });
      sections.push(section);
    }
  } else {
    // Placeholder 생성
    const placeholder = generatePlaceholderSection(phase, scenarioId);
    const section = await upsertSection({
      service_id: serviceId,
      phase,
      track: 'plan',
      section_key: placeholder.section_key,
      title: placeholder.title,
      content: placeholder.content,
      ordinal: 0,
      status: 'pending-review',
      source: placeholder.source as ServiceSectionSource,
    });
    sections.push(section);
  }

  // run_stats 업데이트
  await incrementRunStat(serviceId, 'sections_generated', sections.length);

  return sections;
}

/**
 * Progressive Mock: 전체 섹션을 draft로 등록 후, 하나씩 pending-review → PO 리뷰.
 * Phase complete 조기 트리거 방지: draft 섹션이 남아있으므로 every(approved)가 false 유지.
 */
export async function injectAndReviewProgressive(
  serviceId: string,
  phase: number,
  sandbox: SandboxConfig,
): Promise<void> {
  const scenario = getScenario(sandbox.scenario_id!);
  if (!scenario) return;

  const mockSections = scenario.mock_sections[phase];
  const items =
    mockSections && mockSections.length > 0
      ? mockSections
      : [generatePlaceholderSection(phase, sandbox.scenario_id!)];

  // 1. 모든 섹션을 draft로 한꺼번에 등록
  const sections: ServiceSection[] = [];
  for (let i = 0; i < items.length; i++) {
    const mock = items[i];
    const section = await upsertSection({
      service_id: serviceId,
      phase,
      track: 'plan',
      section_key: mock.section_key,
      title: mock.title,
      content: mock.content,
      ordinal: i,
      status: 'draft',
      source: (mock.source ?? 'imported') as ServiceSectionSource,
    });
    sections.push(section);
  }
  await incrementRunStat(serviceId, 'sections_generated', sections.length);

  // 2. Slack: Phase 시작 알림
  const { postSlackMessage } = await import('./slack');
  const { PHASE_LABELS } = await import('./service-phases');
  const sandboxChannel =
    sandbox.notify_channel || process.env.SANDBOX_SLACK_CHANNEL || 'C0ARK2M9NPM';
  const phaseLabel = PHASE_LABELS[phase] ?? `Phase ${phase}`;
  await postSlackMessage(
    sandboxChannel,
    `Phase ${phase} (${phaseLabel}) 시작 — ${sections.length}개 섹션 생성 중`,
    { botId: 'semiclaw' },
  ).catch(() => {});

  // 3. 순차 reveal + PO 리뷰
  const delay = sandbox.timing.section_delay_ms;
  const { processVirtualPOReview } = await import('./sandbox-virtual-po');

  for (let i = 0; i < sections.length; i++) {
    if (i > 0 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // draft → pending-review (섹션 "도착" 연출)
    await query(
      `UPDATE semo.service_sections SET status = 'pending-review' WHERE section_id = $1`,
      [sections[i].section_id],
    );
    sections[i].status = 'pending-review';

    // auto-pilot/semi-auto → 즉시 PO 리뷰
    if (sandbox.virtual_po.mode !== 'interactive') {
      await processVirtualPOReview(serviceId, sections[i], sandbox);
    }
  }

  console.log(
    `[SANDBOX] Progressive: injected & reviewed ${sections.length} sections for Phase ${phase} of ${serviceId}`,
  );
}

// ── Teardown ──

export async function teardownSandboxProject(serviceId: string): Promise<{ error?: string }> {
  const project = await getProject(serviceId);
  if (!project) return { error: '프로젝트를 찾을 수 없습니다.' };

  const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
    | SandboxConfig
    | undefined;
  if (!sandbox?.enabled) return { error: '이 프로젝트는 샌드박스가 아닙니다.' };

  // 1. DB cascade delete (sections, materials, research_tasks, infra_requests, etc.)
  await query('DELETE FROM semo.services WHERE service_id = $1', [serviceId]);

  // 2. KB namespace 정리
  if (project.service_domain) {
    try {
      const { deleteItemsByDomain } = await import('./kb');
      await deleteItemsByDomain(project.service_domain);
      console.log(`[SANDBOX] KB domain '${project.service_domain}' cleaned up`);
    } catch (err) {
      console.error('[SANDBOX] KB cleanup failed:', err);
    }

    // Ontology domain 정리
    await query('DELETE FROM semo.ontology WHERE domain = $1', [project.service_domain]).catch(
      (err) => console.error('[SANDBOX] Ontology cleanup failed:', err),
    );
  }

  console.log(`[SANDBOX] Torn down project "${project.project_name}" (${serviceId})`);
  return {};
}

export async function teardownAllSandboxProjects(): Promise<{
  count: number;
  errors: string[];
}> {
  const projects = await listSandboxProjects();
  const errors: string[] = [];

  for (const p of projects) {
    const result = await teardownSandboxProject(p.service_id);
    if (result.error) errors.push(`${p.project_name}: ${result.error}`);
  }

  return { count: projects.length - errors.length, errors };
}

// ── List & Query ──

export async function listSandboxProjects(): Promise<ServiceProject[]> {
  const res = await query<ServiceProject>(
    `SELECT * FROM semo.services
     WHERE metadata->'sandbox'->>'enabled' = 'true'
     ORDER BY created_at DESC`,
  );
  return res.rows;
}

export interface SandboxReport {
  project: ServiceProject;
  config: SandboxConfig;
  sections_by_phase: Record<number, { total: number; approved: number; rejected: number }>;
  run_stats: SandboxConfig['run_stats'];
  verification: { passed: boolean; issues: string[] };
  /** include_sections=true 시 전체 섹션 콘텐츠 */
  sections_detail?: ServiceSection[];
}

export async function getSandboxReport(
  serviceId: string,
  options?: { include_sections?: boolean },
): Promise<SandboxReport | null> {
  const project = await getProject(serviceId);
  if (!project) return null;

  const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
    | SandboxConfig
    | undefined;
  if (!sandbox?.enabled) return null;

  // Phase별 섹션 집계
  const allSections = await listSections(serviceId);
  const sectionsByPhase: Record<number, { total: number; approved: number; rejected: number }> = {};

  for (const s of allSections) {
    if (!sectionsByPhase[s.phase]) {
      sectionsByPhase[s.phase] = { total: 0, approved: 0, rejected: 0 };
    }
    sectionsByPhase[s.phase].total++;
    if (s.status === 'approved') sectionsByPhase[s.phase].approved++;
    if (s.status === 'rejected') sectionsByPhase[s.phase].rejected++;
  }

  // 검증: empty 모드(시나리오 없음)에서는 expected_section_counts 스킵
  const issues: string[] = [];
  const scenario = sandbox.scenario_id ? getScenario(sandbox.scenario_id) : null;
  if (scenario) {
    for (const [phase, expected] of Object.entries(scenario.expected_section_counts)) {
      const phaseNum = Number(phase);
      const actual = sectionsByPhase[phaseNum]?.total ?? 0;
      if (actual < (expected as number)) {
        issues.push(`Phase ${phaseNum}: 예상 ${expected}개, 실제 ${actual}개 섹션`);
      }
    }
  }

  return {
    project,
    config: sandbox,
    sections_by_phase: sectionsByPhase,
    run_stats: sandbox.run_stats,
    verification: { passed: issues.length === 0, issues },
    ...(options?.include_sections ? { sections_detail: allSections } : {}),
  };
}

// ── Phase Reset ──

export async function resetToPhase(
  serviceId: string,
  targetPhase: number,
): Promise<{ error?: string }> {
  const project = await getProject(serviceId);
  if (!project) return { error: '프로젝트를 찾을 수 없습니다.' };

  const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
    | SandboxConfig
    | undefined;
  if (!sandbox?.enabled) return { error: '이 프로젝트는 샌드박스가 아닙니다.' };

  // targetPhase 이후의 섹션 삭제
  await query(
    'DELETE FROM semo.service_sections WHERE service_id = $1 AND phase > $2 AND track = $3',
    [serviceId, targetPhase, 'plan'],
  );

  // current_phase 롤백
  await updateProject(serviceId, { current_phase: targetPhase });

  // run_stats 리셋
  const updatedStats = {
    ...sandbox.run_stats,
    completed_at: undefined,
    phases_completed: targetPhase,
  };
  await updateProject(serviceId, {
    metadata: { sandbox: { ...sandbox, run_stats: updatedStats } },
  });

  console.log(`[SANDBOX] Reset project ${serviceId} to Phase ${targetPhase}`);
  return {};
}

// ── Reinitialize ──

export interface ReinitializeSandboxParams {
  scenario_id?: string;
  virtual_po_mode?: SandboxVirtualPOMode;
  rejection_rate?: number;
  auto_advance?: boolean;
  depth?: SandboxDepth;
}

export async function reinitializeSandbox(
  serviceId: string,
  params?: ReinitializeSandboxParams,
): Promise<{ error?: string }> {
  const project = await getProject(serviceId);
  if (!project) return { error: '프로젝트를 찾을 수 없습니다.' };

  const sandbox = (project.metadata as Record<string, unknown>)?.sandbox as
    | SandboxConfig
    | undefined;
  if (!sandbox?.enabled) return { error: '이 프로젝트는 샌드박스가 아닙니다.' };

  // 시나리오 변경 시 유효성 체크
  const newScenarioId = params?.scenario_id ?? sandbox.scenario_id;
  if (params?.scenario_id && params.scenario_id !== sandbox.scenario_id) {
    const scenario = getScenario(params.scenario_id);
    if (!scenario) return { error: `시나리오 '${params.scenario_id}'를 찾을 수 없습니다.` };
  }

  // 1. 전체 plan-track 섹션 삭제
  await query('DELETE FROM semo.service_sections WHERE service_id = $1 AND track = $2', [
    serviceId,
    'plan',
  ]);

  // 2. KB 도메인 엔트리 정리
  if (project.service_domain) {
    try {
      const { deleteItemsByDomain } = await import('./kb');
      await deleteItemsByDomain(project.service_domain);
    } catch (err) {
      console.error('[SANDBOX] KB cleanup on reinit failed:', err);
    }
  }

  // 3. SandboxConfig 머지 (오버라이드 적용)
  const updatedConfig: SandboxConfig = {
    ...sandbox,
    scenario_id: newScenarioId,
    depth: params?.depth ?? sandbox.depth,
    auto_advance: params?.auto_advance ?? sandbox.auto_advance,
    virtual_po: {
      ...sandbox.virtual_po,
      mode: params?.virtual_po_mode ?? sandbox.virtual_po.mode,
      rejection_rate: params?.rejection_rate ?? sandbox.virtual_po.rejection_rate,
    },
    run_generation: (sandbox.run_generation ?? 0) + 1,
    reinit_count: (sandbox.reinit_count ?? 0) + 1,
    run_stats: {
      started_at: new Date().toISOString(),
      phases_completed: 0,
      sections_generated: 0,
      sections_reviewed: 0,
      rejections: 0,
    },
  };

  // 4. 프로젝트 업데이트
  await updateProject(serviceId, {
    current_phase: 0,
    metadata: { sandbox: updatedConfig },
  });

  // 5. KB service-id 재작성 (fire-and-forget)
  if (project.service_domain) {
    try {
      const { upsertItem } = await import('./kb');
      const updated = await getProject(serviceId);
      if (updated) {
        await upsertItem(
          project.service_domain,
          'gfp-id',
          `service_id: ${updated.service_id}\nproject_name: ${updated.project_name}\nowner: ${updated.owner_name}`,
          'pm-pipeline',
        );
      }
    } catch (err) {
      console.error('[SANDBOX] KB service-id rewrite on reinit failed:', err);
    }
  }

  console.log(
    `[SANDBOX] Reinitialized project ${serviceId} (generation: ${updatedConfig.run_generation})`,
  );
  return {};
}

// ── Run Stats Helper ──

type RunStatKey = 'sections_generated' | 'sections_reviewed' | 'rejections' | 'phases_completed';

const RUN_STAT_PATHS: Record<RunStatKey, { jsonPath: string; jsonQuery: string }> = {
  sections_generated: {
    jsonPath: '{sandbox,run_stats,sections_generated}',
    jsonQuery: "metadata->'sandbox'->'run_stats'->>'sections_generated'",
  },
  sections_reviewed: {
    jsonPath: '{sandbox,run_stats,sections_reviewed}',
    jsonQuery: "metadata->'sandbox'->'run_stats'->>'sections_reviewed'",
  },
  rejections: {
    jsonPath: '{sandbox,run_stats,rejections}',
    jsonQuery: "metadata->'sandbox'->'run_stats'->>'rejections'",
  },
  phases_completed: {
    jsonPath: '{sandbox,run_stats,phases_completed}',
    jsonQuery: "metadata->'sandbox'->'run_stats'->>'phases_completed'",
  },
};

async function incrementRunStat(
  serviceId: string,
  stat: RunStatKey,
  amount: number = 1,
): Promise<void> {
  const paths = RUN_STAT_PATHS[stat];
  await query(
    `UPDATE semo.services
     SET metadata = jsonb_set(
       metadata,
       '${paths.jsonPath}',
       (COALESCE((${paths.jsonQuery})::int, 0) + $1)::text::jsonb
     )
     WHERE service_id = $2`,
    [amount, serviceId],
  );
}

export { incrementRunStat };

/**
 * Sandbox auto-advance 트리거 (service-actions.ts에서 호출).
 * phase complete 시 다음 phase로 자동 진행.
 */
export function triggerSandboxAdvance(
  serviceId: string,
  nextPhase: number,
  metadata: Record<string, unknown>,
): void {
  const sandbox = metadata?.sandbox as SandboxConfig | undefined;
  if (!sandbox?.enabled) return;
  // interactive 모드에서도 mock 주입은 진행 (auto_advance=false라도)
  if (!sandbox.auto_advance && sandbox.virtual_po.mode !== 'interactive') return;

  // 완료된 phase 타이밍 기록 (nextPhase - 1이 방금 완료된 phase)
  if (nextPhase > 0) {
    logPhaseComplete(serviceId, nextPhase - 1).catch(() => {});
  }

  scheduleSandboxNextPhase(serviceId, nextPhase, metadata).catch((err) =>
    console.error('[SANDBOX] Auto-advance trigger failed:', err),
  );
}

// ── Depth → Max Phase mapping ──

export function getMaxPhaseForDepth(depth: SandboxDepth): number {
  switch (depth) {
    case 'plan-only':
      return 9;
    case 'full':
      return 9; // plan phases만, 구현은 Track B
    case 'e2e':
      return 9; // plan + ops simulation
    default:
      return 9;
  }
}

/**
 * 샌드박스 auto-advance: 다음 Phase Mock 주입 스케줄.
 * project-actions.ts의 phase complete 훅에서 호출됨.
 */
export async function scheduleSandboxNextPhase(
  serviceId: string,
  nextPhase: number,
  metadata: Record<string, unknown>,
): Promise<void> {
  const sandbox = metadata.sandbox as SandboxConfig | undefined;
  if (!sandbox?.enabled) return;
  if (!sandbox.auto_advance && sandbox.virtual_po.mode !== 'interactive') return;

  // Live 모드: 실제 봇에게 디스패치 (empty 모드 포함)
  if (sandbox.mode === 'live') {
    const scenario = sandbox.scenario_id ? getScenario(sandbox.scenario_id) : null;
    await dispatchLiveSandboxPhase(serviceId, nextPhase, scenario, sandbox);
    return;
  }

  const maxPhase = getMaxPhaseForDepth(sandbox.depth);
  if (nextPhase > maxPhase) {
    // 완료
    await query(
      `UPDATE semo.services
       SET metadata = jsonb_set(metadata, '{sandbox,run_stats,completed_at}', $1::jsonb)
       WHERE service_id = $2`,
      [JSON.stringify(new Date().toISOString()), serviceId],
    );
    console.log(`[SANDBOX] Run completed for ${serviceId}`);
    return;
  }

  const delay = sandbox.timing.phase_delay_ms;
  const scheduledGeneration = sandbox.run_generation ?? 0;

  setTimeout(async () => {
    try {
      // Generation guard: reinitialize 됐으면 이 체인은 무효
      const fresh = await getProject(serviceId);
      if (!fresh) return;
      const freshSandbox = (fresh.metadata as Record<string, unknown>)?.sandbox as
        | SandboxConfig
        | undefined;
      if ((freshSandbox?.run_generation ?? 0) !== scheduledGeneration) {
        console.log(
          `[SANDBOX] Stale advance for ${serviceId} (gen ${scheduledGeneration} vs ${freshSandbox?.run_generation}), skipping`,
        );
        return;
      }

      // Progressive reveal: 섹션 단위 시간차 주입 + PO 리뷰 인터리브
      if (sandbox.progressive_reveal !== false) {
        await injectAndReviewProgressive(serviceId, nextPhase, sandbox);

        // interactive 모드 + notify_channel → Slack 버튼 메시지
        if (sandbox.virtual_po.mode === 'interactive' && sandbox.notify_channel) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space';
            await fetch(`${baseUrl}/api/projects/sandbox/slack-review`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                service_id: serviceId,
                channel_id: sandbox.notify_channel,
                thread_ts: sandbox.notify_thread_ts,
              }),
            });
          } catch (err) {
            console.error('[SANDBOX] Slack review notification failed:', err);
          }
        }
        return;
      }

      // 기존 일괄 주입 (progressive_reveal=false, backward compat)
      const sections = await injectMockSections(serviceId, nextPhase, sandbox.scenario_id!);
      console.log(
        `[SANDBOX] Injected ${sections.length} mock sections for Phase ${nextPhase} of ${serviceId}`,
      );

      // auto-pilot/semi-auto → 가상 PO 자동 리뷰 트리거
      if (sandbox.virtual_po.mode !== 'interactive') {
        const { processVirtualPOReviewBatch } = await import('./sandbox-virtual-po');
        setTimeout(
          () =>
            processVirtualPOReviewBatch(serviceId, sections, sandbox).catch((err) =>
              console.error('[SANDBOX] Virtual PO batch review failed:', err),
            ),
          sandbox.timing.section_delay_ms,
        );
      }

      // interactive 모드 + notify_channel → 다음 Phase Slack 버튼 메시지 자동 발송
      if (sandbox.virtual_po.mode === 'interactive' && sandbox.notify_channel) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://semo.semi-colon.space';
          await fetch(`${baseUrl}/api/projects/sandbox/slack-review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_id: serviceId,
              channel_id: sandbox.notify_channel,
              thread_ts: sandbox.notify_thread_ts,
            }),
          });
        } catch (err) {
          console.error('[SANDBOX] Slack review notification failed:', err);
        }
      }
    } catch (err) {
      console.error(`[SANDBOX] Mock injection failed for Phase ${nextPhase}:`, err);
    }
  }, delay);
}

// ── Live Mode: Bot Dispatch ──

/**
 * Live 모드: 실제 봇에게 Phase 섹션 생성을 디스패치.
 * 봇은 callback API(sandbox-section-submit)로 섹션 제출.
 */
export async function dispatchLiveSandboxPhase(
  serviceId: string,
  phase: number,
  scenario: ReturnType<typeof getScenario> | null,
  sandbox: SandboxConfig,
): Promise<void> {
  const { getPhaseAssignee, PHASE_LABELS } = await import('./service-phases');
  const { dispatchBotMessage } = await import('./service-bot');
  const { postSlackMessage } = await import('./slack');

  const assignee = getPhaseAssignee(phase);
  const phaseLabel = PHASE_LABELS[phase] ?? `Phase ${phase}`;
  const persona = getPersona(sandbox.virtual_po.persona_id);
  const sandboxChannel =
    sandbox.notify_channel || process.env.SANDBOX_SLACK_CHANNEL || 'C0ARK2M9NPM';

  // 이전 Phase 승인 콘텐츠 수집 (Phase 1+ 컨텍스트)
  let prevContext = '';
  if (phase > 0) {
    const prevSections = await listSections(serviceId, phase - 1, 'plan');
    const approved = prevSections.filter((s) => s.status === 'approved');
    if (approved.length > 0) {
      prevContext = `\n## Previous Phase (${phase - 1}) Approved Content\n${approved.map((s) => `### ${s.title}\n${s.content.slice(0, 500)}`).join('\n\n')}\n`;
    }
  }

  const profileCtx = persona
    ? `\n## PO Profile\nTech: ${persona.po_profile.tech_level}, Design: ${persona.po_profile.design_sensitivity}, Domain: ${persona.po_profile.domain_area}\n`
    : '';

  const description = scenario?.initial_description ?? sandbox.initial_description ?? '';

  const message = `[Sandbox Live Phase: ${serviceId}]

## Phase ${phase} — ${phaseLabel}
${description}
${profileCtx}${prevContext}
## Instructions
Generate sections for Phase ${phase} (${phaseLabel}).
Submit each section via POST /api/projects/callback with:
\`\`\`json
{
  "type": "sandbox-section-submit",
  "service_id": "${serviceId}",
  "phase": ${phase},
  "section_key": "...",
  "title": "...",
  "content": "...",
  "bot_id": "${assignee.botId}"
}
\`\`\``;

  await dispatchBotMessage(assignee.botId, message, sandboxChannel);

  // Phase 타이밍 + 봇 할당 기록
  await logPhaseStart(serviceId, phase, assignee.botId);

  // Slack: Phase 시작 알림
  await postSlackMessage(
    sandboxChannel,
    `[Live] Phase ${phase} (${phaseLabel}) — ${assignee.botId}에게 디스패치 완료`,
    { botId: 'semiclaw' },
  ).catch(() => {});

  // Phase timeout 등록
  const timeoutMs = sandbox.phase_timeout_ms ?? 300000;
  setTimeout(async () => {
    try {
      const project = await getProject(serviceId);
      if (!project) return;
      if (project.current_phase > phase) return; // 이미 진행됨
      const sections = await listSections(serviceId, phase, 'plan');
      if (sections.length > 0) return; // 섹션 도착함

      console.warn(`[SANDBOX] Live phase ${phase} timeout for ${serviceId}`);
      await postSlackMessage(
        sandboxChannel,
        `⚠️ Phase ${phase} (${phaseLabel}) 타임아웃 — 봇 응답 없음 (${Math.round(timeoutMs / 1000)}초)`,
        { botId: 'semiclaw' },
      );
    } catch {
      // ignore
    }
  }, timeoutMs);

  console.log(`[SANDBOX] Live dispatch: Phase ${phase} → ${assignee.botId} for ${serviceId}`);
}

// ── Phase Timing ──

async function logPhaseStart(serviceId: string, phase: number, botId: string): Promise<void> {
  // phase_timings 초기화 + 해당 phase 기록
  await query(
    `UPDATE semo.services
     SET metadata = jsonb_set(
       jsonb_set(
         metadata,
         '{sandbox,run_stats,phase_timings}',
         COALESCE(metadata->'sandbox'->'run_stats'->'phase_timings', '{}'::jsonb)
       ),
       $1::text[],
       $2::jsonb
     )
     WHERE service_id = $3`,
    [
      ['sandbox', 'run_stats', 'phase_timings', String(phase)],
      JSON.stringify({ started_at: new Date().toISOString() }),
      serviceId,
    ],
  );
  // bot_assignments 기록
  await query(
    `UPDATE semo.services
     SET metadata = jsonb_set(
       jsonb_set(
         metadata,
         '{sandbox,run_stats,bot_assignments}',
         COALESCE(metadata->'sandbox'->'run_stats'->'bot_assignments', '{}'::jsonb)
       ),
       $1::text[],
       $2::jsonb
     )
     WHERE service_id = $3`,
    [['sandbox', 'run_stats', 'bot_assignments', String(phase)], JSON.stringify(botId), serviceId],
  );
}

async function logPhaseComplete(serviceId: string, phase: number): Promise<void> {
  await query(
    `UPDATE semo.services
     SET metadata = jsonb_set(
       metadata,
       $1::text[],
       $2::jsonb
     )
     WHERE service_id = $3
       AND metadata->'sandbox'->'run_stats'->'phase_timings'->$4 IS NOT NULL`,
    [
      ['sandbox', 'run_stats', 'phase_timings', String(phase), 'completed_at'],
      JSON.stringify(new Date().toISOString()),
      serviceId,
      String(phase),
    ],
  );
}

// ── Cost Tracking ──

export async function incrementSandboxCost(serviceId: string, costDelta: number): Promise<void> {
  await query(
    `UPDATE semo.services
     SET metadata = jsonb_set(
       metadata,
       '{sandbox,run_stats,cost_usd}',
       (COALESCE((metadata->'sandbox'->'run_stats'->>'cost_usd')::numeric, 0) + $1)::text::jsonb
     )
     WHERE service_id = $2`,
    [costDelta, serviceId],
  );
}
