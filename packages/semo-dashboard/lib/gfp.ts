/**
 * Service Project DB Layer (formerly GFP — Greenfield Project Pipeline)
 * CRUD operations for service projects, sections, materials, and research tasks.
 *
 * Table mapping: service_projects, service_sections, service_materials,
 *   service_research_tasks, service_infra_requests
 * KB projection keys: spec/*, pm-status, infra-status (written by pm-pipeline)
 */

import { query, transaction } from './db';
import type {
  GfpProject,
  GfpPhaseSection,
  GfpMaterial,
  GfpResearchTask,
  GfpSectionStatus,
  GfpPhaseMapping,
  GfpQAItem,
  GfpTrack,
  GfpInfraRequest,
  GfpInfraRequestStatus,
  GfpInfraCategory,
  ServiceKPIMetric,
  ServiceActionItem,
  ServiceIteration,
} from '@/types';

// ── Projects ──

export async function listProjects(status?: string): Promise<GfpProject[]> {
  let sql = 'SELECT * FROM semo.services';
  const params: string[] = [];
  if (status) {
    sql += ' WHERE status = $1';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const res = await query<GfpProject>(sql, params);
  return res.rows;
}

export async function getProject(gfpId: string): Promise<GfpProject | null> {
  const res = await query<GfpProject>(
    'SELECT * FROM semo.services WHERE service_id =$1',
    [gfpId]
  );
  return res.rows[0] ?? null;
}

export async function createProject(data: {
  project_name: string;
  owner_name: string;
  owner_contact?: string;
  service_domain?: string;
  metadata?: Record<string, unknown>;
}): Promise<GfpProject> {
  // 온톨로지 자동 등록: service_domain이 지정되었으나 아직 등록 안 된 경우
  if (data.service_domain) {
    await ensureOntologyDomain(data.service_domain, data.project_name);
  }

  const res = await query<GfpProject>(
    `INSERT INTO semo.services (project_name, owner_name, owner_contact, service_domain, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.project_name,
      data.owner_name,
      data.owner_contact ?? null,
      data.service_domain ?? null,
      JSON.stringify({ preset: 'parallel', ...data.metadata }),
    ]
  );
  const project = res.rows[0];

  // parallel 프리셋: infra_phase = 0 초기화 (Track B 활성화)
  if (data.metadata?.preset === 'parallel') {
    await query(
      'UPDATE semo.services SET infra_phase = 0 WHERE service_id =$1',
      [project.service_id]
    );
    project.infra_phase = 0;
  }

  // KB에 gfp_id 저장 (service_domain이 있을 때)
  if (data.service_domain) {
    writeGfpIdToKB(data.service_domain, project).catch((err) =>
      console.error('[PM] KB gfp-id write failed:', err)
    );

    // infra-ready 프리셋: 인프라 정보를 KB에 별도 기록
    if (data.metadata?.preset === 'infra-ready') {
      writeInfraToKB(data.service_domain, data.metadata).catch((err) =>
        console.error('[PM] KB infra write failed:', err)
      );
    }
  }

  return project;
}

/**
 * 온톨로지에 도메인이 없으면 자동 등록 (service 타입)
 */
async function ensureOntologyDomain(domain: string, projectName: string): Promise<void> {
  const check = await query(
    'SELECT 1 FROM semo.ontology WHERE domain = $1',
    [domain]
  );
  if (check.rows.length > 0) return;

  await query(
    `INSERT INTO semo.ontology (domain, schema, entity_type, service, description, tags)
     VALUES ($1, '{}', 'service', $1, $2, $3)
     ON CONFLICT (domain) DO NOTHING`,
    [domain, `${projectName} — GFP 프로젝트`, ['gfp', 'incubator']]
  );
  console.log(`[PM] Ontology domain '${domain}' auto-registered for project '${projectName}'`);
}

/**
 * GFP 프로젝트 생성 시 gfp_id를 KB에 기록.
 * 봇이 KB 검색으로 서비스의 GFP 프로젝트를 찾을 수 있도록 함.
 */
async function writeGfpIdToKB(serviceDomain: string, project: GfpProject): Promise<void> {
  const { upsertItem } = await import('./kb');
  const presetId = (project.metadata?.preset as string) ?? 'standard';
  const presetConfig = project.metadata?.preset_config as Record<string, unknown> | undefined;
  const infraConfig = presetConfig?.infra as Record<string, unknown> | undefined;

  const lines = [
    `service_id: ${project.service_id}`,
    `project_name: ${project.project_name}`,
    `owner: ${project.owner_name}`,
    `status: ${project.status}`,
    `current_phase: ${project.current_phase}`,
    `preset: ${presetId}`,
  ];

  if (presetId === 'infra-ready' && infraConfig) {
    if (infraConfig.repo_url) lines.push(`infra_repo: ${infraConfig.repo_url}`);
    if (infraConfig.live_url) lines.push(`infra_live_url: ${infraConfig.live_url}`);
  }

  lines.push(`created_at: ${project.created_at}`);

  await upsertItem(serviceDomain, 'gfp-id', lines.join('\n'), 'pm-pipeline');
  console.log(`[PM] KB gfp-id written for domain '${serviceDomain}': ${project.service_id} (preset: ${presetId})`);
}

/**
 * infra-ready 프리셋: 사전 구축된 인프라 정보를 KB에 기록.
 * 봇이 `semo kb get {domain} infra`로 인프라 정보를 조회할 수 있음.
 */
async function writeInfraToKB(serviceDomain: string, metadata: Record<string, unknown>): Promise<void> {
  const { upsertItem } = await import('./kb');
  const presetConfig = metadata.preset_config as Record<string, unknown> | undefined;
  const infra = presetConfig?.infra as Record<string, unknown> | undefined;
  if (!infra) return;

  const lines = [
    infra.repo_url ? `repo_url: ${infra.repo_url}` : null,
    infra.live_url ? `live_url: ${infra.live_url}` : null,
    infra.deploy_pipeline ? `deploy_pipeline: ${infra.deploy_pipeline}` : null,
    `dns_configured: ${infra.dns_configured ?? false}`,
    infra.provisioned_by ? `provisioned_by: ${infra.provisioned_by}` : null,
    `provisioned_at: ${infra.provisioned_at ?? new Date().toISOString()}`,
    'source: gfp-preset-infra-ready',
  ].filter(Boolean);

  await upsertItem(serviceDomain, 'infra', lines.join('\n'), 'pm-pipeline');
  console.log(`[PM] KB infra written for domain '${serviceDomain}'`);
}

export async function updateProject(
  gfpId: string,
  data: Partial<Pick<GfpProject, 'project_name' | 'current_phase' | 'infra_phase' | 'status' | 'lifecycle' | 'launched_at' | 'metadata'>>
): Promise<GfpProject | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.project_name !== undefined) {
    sets.push(`project_name = $${idx++}`);
    params.push(data.project_name);
  }
  if (data.current_phase !== undefined) {
    sets.push(`current_phase = $${idx++}`);
    params.push(data.current_phase);
  }
  if (data.infra_phase !== undefined) {
    sets.push(`infra_phase = $${idx++}`);
    params.push(data.infra_phase);
  }
  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(data.status);
  }
  if (data.lifecycle !== undefined) {
    sets.push(`lifecycle = $${idx++}`);
    params.push(data.lifecycle);
    if (data.lifecycle === 'ops') {
      sets.push(`launched_at = COALESCE(launched_at, NOW())`);
    }
  }
  if (data.launched_at !== undefined) {
    sets.push(`launched_at = $${idx++}`);
    params.push(data.launched_at);
  }
  if (data.metadata !== undefined) {
    sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
    params.push(JSON.stringify(data.metadata));
  }

  if (sets.length === 0) return getProject(gfpId);

  params.push(gfpId);
  const res = await query<GfpProject>(
    `UPDATE semo.services SET ${sets.join(', ')} WHERE service_id =$${idx} RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

// ── Sections ──

export async function listSections(gfpId: string, phase?: number, track?: GfpTrack): Promise<GfpPhaseSection[]> {
  let sql = 'SELECT * FROM semo.service_sections WHERE service_id =$1';
  const params: unknown[] = [gfpId];
  let idx = 2;
  if (phase !== undefined) {
    sql += ` AND phase = $${idx++}`;
    params.push(phase);
  }
  if (track !== undefined) {
    sql += ` AND track = $${idx++}`;
    params.push(track);
  }
  sql += ' ORDER BY phase, ordinal';
  const res = await query<GfpPhaseSection>(sql, params);
  return res.rows;
}

export async function upsertSection(data: {
  service_id: string;
  phase: number;
  section_key: string;
  title: string;
  content: string;
  ordinal?: number;
  status?: GfpSectionStatus;
  source?: string;
  qa_items?: GfpQAItem[];
  track?: GfpTrack;
}): Promise<GfpPhaseSection> {
  // If qa_items provided without content, auto-generate markdown
  const content = data.content || (data.qa_items ? renderQAContent(data.qa_items) : '');
  const track = data.track ?? 'plan';

  const res = await query<GfpPhaseSection>(
    `INSERT INTO semo.service_sections (service_id, phase, section_key, title, content, ordinal, status, source, qa_items, track)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (service_id, track, phase, section_key) DO UPDATE SET
       title   = EXCLUDED.title,
       content = EXCLUDED.content,
       ordinal = EXCLUDED.ordinal,
       status  = EXCLUDED.status,
       source  = EXCLUDED.source,
       qa_items = EXCLUDED.qa_items
     RETURNING *`,
    [
      data.service_id,
      data.phase,
      data.section_key,
      data.title,
      content,
      data.ordinal ?? 0,
      data.status ?? 'draft',
      data.source ?? 'manual',
      data.qa_items ? JSON.stringify(data.qa_items) : null,
      track,
    ]
  );
  return res.rows[0];
}

export async function updateSectionStatus(
  sectionId: string,
  status: GfpSectionStatus,
  reviewerNote?: string
): Promise<GfpPhaseSection | null> {
  const res = await query<GfpPhaseSection>(
    `UPDATE semo.service_sections
     SET status = $1, reviewer_note = $2
     WHERE section_id = $3
     RETURNING *`,
    [status, reviewerNote ?? null, sectionId]
  );
  return res.rows[0] ?? null;
}

export async function updateSectionContent(
  sectionId: string,
  content: string,
  status?: GfpSectionStatus
): Promise<GfpPhaseSection | null> {
  const res = await query<GfpPhaseSection>(
    `UPDATE semo.service_sections
     SET content = $1, status = COALESCE($2, status)
     WHERE section_id = $3
     RETURNING *`,
    [content, status ?? null, sectionId]
  );
  return res.rows[0] ?? null;
}

// ── Q&A helpers ──

/**
 * Render qa_items array into readable markdown (for content field, KB write-back, GitHub publish).
 */
export function renderQAContent(items: GfpQAItem[]): string {
  return items
    .map((item) => {
      const bullets = item.sub_bullets?.length
        ? '\n' + item.sub_bullets.map((b) => `  - ${b}`).join('\n')
        : '';
      const answer = item.answer
        ? `\n> ${item.answer.replace(/\n/g, '\n> ')}`
        : '\n_Awaiting answer_';
      return `**${item.id.toUpperCase()}: ${item.question}**${bullets}${answer}`;
    })
    .join('\n\n');
}

/**
 * Save answers to Q&A items on a section. Merges into existing qa_items and regenerates content.
 */
export async function answerQAItems(
  sectionId: string,
  answers: Array<{ id: string; answer: string }>,
  via: 'dashboard' | 'slack'
): Promise<GfpPhaseSection | null> {
  const sectionRes = await query<GfpPhaseSection>(
    'SELECT * FROM semo.service_sections WHERE section_id = $1',
    [sectionId]
  );
  const section = sectionRes.rows[0];
  if (!section || !section.qa_items) return null;

  const qaItems: GfpQAItem[] = (typeof section.qa_items === 'string'
    ? JSON.parse(section.qa_items)
    : section.qa_items) as GfpQAItem[];

  const now = new Date().toISOString();
  for (const ans of answers) {
    const item = qaItems.find((q) => q.id === ans.id);
    if (item && ans.answer.trim()) {
      item.answer = ans.answer.trim();
      item.answered_at = now;
      item.answered_via = via;
    }
  }

  const content = renderQAContent(qaItems);
  const res = await query<GfpPhaseSection>(
    `UPDATE semo.service_sections
     SET qa_items = $1, content = $2
     WHERE section_id = $3
     RETURNING *`,
    [JSON.stringify(qaItems), content, sectionId]
  );
  return res.rows[0] ?? null;
}

// ── Section management (delete / move) ──

export async function deleteSection(sectionId: string, gfpId: string): Promise<GfpPhaseSection | null> {
  const res = await query<GfpPhaseSection>(
    'DELETE FROM semo.service_sections WHERE section_id = $1 AND service_id =$2 RETURNING *',
    [sectionId, gfpId]
  );
  return res.rows[0] ?? null;
}

export async function moveSection(
  sectionId: string,
  gfpId: string,
  targetPhase: number,
  targetTrack?: GfpTrack
): Promise<GfpPhaseSection | null> {
  // Fetch current section to check existence and get section_key for conflict check
  const current = await query<GfpPhaseSection>(
    'SELECT * FROM semo.service_sections WHERE section_id = $1 AND service_id =$2',
    [sectionId, gfpId]
  );
  if (!current.rows[0]) return null;

  const section = current.rows[0];
  const track = targetTrack ?? section.track ?? 'plan';

  // Check UNIQUE constraint (service_id, track, phase, section_key)
  const conflict = await query<GfpPhaseSection>(
    `SELECT section_id FROM semo.service_sections
     WHERE service_id =$1 AND track = $2 AND phase = $3 AND section_key = $4 AND section_id != $5`,
    [gfpId, track, targetPhase, section.section_key, sectionId]
  );
  if (conflict.rows.length > 0) {
    throw new Error('CONFLICT');
  }

  const res = await query<GfpPhaseSection>(
    `UPDATE semo.service_sections
     SET phase = $1, track = $2
     WHERE section_id = $3 AND service_id =$4
     RETURNING *`,
    [targetPhase, track, sectionId, gfpId]
  );
  return res.rows[0] ?? null;
}

/**
 * Save Slack thread_ts on a section (for answer collection polling).
 */
export async function updateSectionSlackThread(
  sectionId: string,
  threadTs: string
): Promise<void> {
  await query(
    'UPDATE semo.service_sections SET slack_thread_ts = $1 WHERE section_id = $2',
    [threadTs, sectionId]
  );
}

// ── Phase progress helpers ──

export interface PhaseProgress {
  phase: number;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  draft: number;
}

export async function getPhaseProgress(gfpId: string, track?: GfpTrack): Promise<PhaseProgress[]> {
  let sql = `SELECT phase,
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
            COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
            COUNT(*) FILTER (WHERE status = 'pending-review')::int as pending,
            COUNT(*) FILTER (WHERE status = 'draft')::int as draft
     FROM semo.service_sections
     WHERE service_id =$1`;
  const params: unknown[] = [gfpId];
  if (track !== undefined) {
    sql += ' AND track = $2';
    params.push(track);
  }
  sql += ' GROUP BY phase ORDER BY phase';
  const res = await query<PhaseProgress>(sql, params);
  return res.rows;
}

// ── Materials ──

export async function createMaterial(data: {
  service_id: string;
  content: string;
  phase_mapping?: GfpPhaseMapping[];
}): Promise<GfpMaterial> {
  const res = await query<GfpMaterial>(
    `INSERT INTO semo.service_materials (service_id, content, phase_mapping)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.service_id, data.content, data.phase_mapping ? JSON.stringify(data.phase_mapping) : null]
  );
  return res.rows[0];
}

export async function listMaterials(gfpId: string): Promise<GfpMaterial[]> {
  const res = await query<GfpMaterial>(
    'SELECT * FROM semo.service_materials WHERE service_id =$1 ORDER BY created_at DESC',
    [gfpId]
  );
  return res.rows;
}

// ── Stitch Materials ──

export async function createStitchMaterial(data: {
  service_id: string;
  content: string;
  material_type?: string;
}): Promise<GfpMaterial> {
  const materialType = data.material_type ?? 'stitch-export';
  const res = await query<GfpMaterial>(
    `INSERT INTO semo.service_materials (service_id, content, material_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.service_id, data.content, materialType]
  );
  return res.rows[0];
}

// ── Design Step ──

export async function getDesignStep(gfpId: string): Promise<number> {
  const project = await getProject(gfpId);
  if (!project) return 1;
  return (project.metadata?.design_step as number) ?? 1;
}

export async function setDesignStep(gfpId: string, step: number): Promise<void> {
  await query(
    `UPDATE semo.services
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
     WHERE service_id =$2`,
    [JSON.stringify({ design_step: step }), gfpId]
  );
}

/**
 * Phase 4 섹션들의 현재 design step 자동 전진 체크.
 * 현재 스텝의 모든 섹션이 approved면 다음 스텝으로 전진.
 * Returns the new step (or current if no advance).
 */
export async function checkDesignStepAdvance(gfpId: string): Promise<number> {
  const { DESIGN_STEPS, matchesStep } = await import('@/types');

  const currentStep = await getDesignStep(gfpId);
  const stepDef = DESIGN_STEPS.find((s) => s.step === currentStep);
  if (!stepDef || currentStep >= 5) return currentStep;

  const sections = await listSections(gfpId, 4);
  const stepSections = sections.filter((s) => matchesStep(s.section_key, stepDef));

  // 해당 스텝에 섹션이 없으면 전진하지 않음
  if (stepSections.length === 0) return currentStep;

  // Step 3: stitch-result 또는 impl-screen이 최소 1개 있어야 전진
  // (stitch-prompt만 있고 결과물이 없으면 step 3에서 대기)
  if (currentStep === 3) {
    const hasResults = stepSections.some(
      (s) => s.section_key.startsWith('stitch-result-') || s.section_key.startsWith('impl-screen-'),
    );
    if (!hasResults) return currentStep;
  }

  const allApproved = stepSections.every((s) => s.status === 'approved');
  if (allApproved) {
    const nextStep = currentStep + 1;
    await setDesignStep(gfpId, nextStep);
    return nextStep;
  }
  return currentStep;
}

// ── Research Tasks ──

export async function createResearchTask(data: {
  service_id: string;
  task_type: string;
  reference_urls: string[];
  input_prompt: string;
}): Promise<GfpResearchTask> {
  const res = await query<GfpResearchTask>(
    `INSERT INTO semo.service_research_tasks (service_id, task_type, reference_urls, input_prompt)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.service_id, data.task_type, data.reference_urls, data.input_prompt]
  );
  return res.rows[0];
}

export async function listResearchTasks(gfpId: string): Promise<GfpResearchTask[]> {
  const res = await query<GfpResearchTask>(
    'SELECT * FROM semo.service_research_tasks WHERE service_id =$1 ORDER BY created_at DESC',
    [gfpId]
  );
  return res.rows;
}

export async function updateResearchTask(
  taskId: string,
  data: Partial<Pick<GfpResearchTask, 'status' | 'result'>>
): Promise<GfpResearchTask | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(data.status);
  }
  if (data.result !== undefined) {
    sets.push(`result = $${idx++}`);
    params.push(data.result);
  }
  if (sets.length === 0) return null;

  params.push(taskId);
  const res = await query<GfpResearchTask>(
    `UPDATE semo.service_research_tasks SET ${sets.join(', ')} WHERE task_id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

// ── KB Write-back (phase completion) ──

export async function writebackPhaseToKB(
  gfpId: string,
  phase: number,
  serviceDomain: string,
  phaseName: string
): Promise<void> {
  // Dynamically import to avoid circular deps
  const { upsertItem } = await import('./kb');

  const sections = await listSections(gfpId, phase);
  const allApproved = sections.length > 0 && sections.every((s) => s.status === 'approved');
  if (!allApproved) return;

  const content = sections
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => `## ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n');

  await upsertItem(serviceDomain, `spec/${phaseName}`, content, 'pm-pipeline');

  // KB write-back 시각 기록
  const sectionIds = sections.map((s) => s.section_id);
  await query(
    `UPDATE semo.service_sections SET kb_written_at = NOW() WHERE section_id = ANY($1)`,
    [sectionIds]
  );
  console.log(`[PM] KB write-back: ${serviceDomain} spec/${phaseName} (${sectionIds.length} sections)`);
}

// ── KB Write-back (phase progress) ──

export async function writebackPhaseProgressToKB(
  gfpId: string,
  serviceDomain: string,
  completedPhase: number,
  nextPhase: number | null,
  track: GfpTrack = 'plan'
): Promise<void> {
  const { upsertItem } = await import('./kb');
  const { PHASE_LABELS, INFRA_PHASE_LABELS, getPhaseAssignee } = await import('./gfp-phases');

  if (track === 'infra') {
    const content = [
      `service_id: ${gfpId}`,
      `infra_completed_phase: ${completedPhase} (${INFRA_PHASE_LABELS[completedPhase]})`,
      `infra_next_phase: ${nextPhase !== null ? `${nextPhase} (${INFRA_PHASE_LABELS[nextPhase]})` : 'completed'}`,
      `updated_at: ${new Date().toISOString()}`,
    ].join('\n');

    await upsertItem(serviceDomain, 'infra-status', content, 'pm-pipeline');
    console.log(`[PM] KB infra progress: ${serviceDomain}/infra-status → phase ${nextPhase ?? 'done'}`);
    return;
  }

  const completedPhases = Array.from({ length: completedPhase + 1 }, (_, i) =>
    `${i}-${(PHASE_LABELS[i] ?? 'unknown').toLowerCase().replace(/\s+/g, '-')}`
  );

  const nextAssignee = nextPhase !== null && nextPhase <= 9
    ? getPhaseAssignee(nextPhase)
    : null;

  // Include infra track info if available
  const project = await getProject(gfpId);
  const infraLines = project?.infra_phase !== null
    ? [`infra_phase: ${project?.infra_phase}`]
    : [];

  const content = [
    `service_id: ${gfpId}`,
    `current_phase: ${nextPhase !== null && nextPhase <= 9 ? nextPhase : 'completed'}`,
    `last_completed_phase: ${completedPhase} (${PHASE_LABELS[completedPhase]})`,
    `completed_phases: [${completedPhases.join(', ')}]`,
    ...infraLines,
    nextAssignee
      ? `next_assignee: ${nextAssignee.botId} (Phase ${nextPhase} — ${PHASE_LABELS[nextPhase!]})`
      : 'status: all-phases-completed',
    `updated_at: ${new Date().toISOString()}`,
  ].join('\n');

  // 새 pm-status 키에 쓰기 + 레거시 gfp-status 병행 유지
  await Promise.all([
    upsertItem(serviceDomain, 'pm-status', content, 'pm-pipeline'),
    upsertItem(serviceDomain, 'gfp-status', content, 'pm-pipeline'),
  ]);
  console.log(`[PM] KB phase progress: ${serviceDomain}/pm-status → phase ${nextPhase ?? 'done'}`);
}

// ── Bulk section creation from material mapping ──

export async function createSectionsFromMapping(
  gfpId: string,
  mappings: GfpPhaseMapping[],
  track: GfpTrack = 'plan'
): Promise<number> {
  let count = 0;
  await transaction(async (client) => {
    for (const mapping of mappings) {
      for (let i = 0; i < mapping.sections.length; i++) {
        const sec = mapping.sections[i];
        await client.query(
          `INSERT INTO semo.service_sections (service_id, phase, section_key, title, content, ordinal, status, source, track)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (service_id, track, phase, section_key) DO UPDATE SET
             title = EXCLUDED.title, content = EXCLUDED.content, ordinal = EXCLUDED.ordinal,
             status = EXCLUDED.status, source = EXCLUDED.source`,
          [gfpId, mapping.phase, sec.key, sec.title, sec.content, i, 'pending-review', 'imported', track]
        );
        count++;
      }
    }
  });
  return count;
}

// ── Infra Requests ──

export async function listInfraRequests(gfpId: string): Promise<GfpInfraRequest[]> {
  const res = await query<GfpInfraRequest>(
    'SELECT * FROM semo.service_infra_requests WHERE service_id =$1 ORDER BY created_at DESC',
    [gfpId]
  );
  return res.rows;
}

export async function createInfraRequest(data: {
  service_id: string;
  source_phase: number;
  source_section_id?: string;
  category: GfpInfraCategory;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high';
}): Promise<GfpInfraRequest> {
  const res = await query<GfpInfraRequest>(
    `INSERT INTO semo.service_infra_requests (service_id, source_phase, source_section_id, category, title, description, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.service_id,
      data.source_phase,
      data.source_section_id ?? null,
      data.category,
      data.title,
      data.description ?? null,
      data.priority ?? 'normal',
    ]
  );
  return res.rows[0];
}

export async function updateInfraRequest(
  requestId: string,
  status: GfpInfraRequestStatus,
  slackThreadTs?: string
): Promise<GfpInfraRequest | null> {
  const res = await query<GfpInfraRequest>(
    `UPDATE semo.service_infra_requests
     SET status = $1, slack_thread_ts = COALESCE($2, slack_thread_ts), updated_at = NOW()
     WHERE request_id = $3
     RETURNING *`,
    [status, slackThreadTs ?? null, requestId]
  );
  return res.rows[0] ?? null;
}

export async function checkInfraTrackComplete(gfpId: string): Promise<boolean> {
  const project = await getProject(gfpId);
  if (!project || project.infra_phase === null) return true; // No infra track → considered complete
  if (project.infra_phase < 2) return false; // Infra has 3 phases (0, 1, 2)

  // Check phase 2 sections are all approved
  const sections = await listSections(gfpId, 2, 'infra');
  if (sections.length === 0) return project.infra_phase > 2;
  return sections.every((s) => s.status === 'approved');
}

// ── Service Features (ops mode) ──

export interface ServiceFeature {
  feature_id: string;
  service_id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  parent_id: string | null;
  iteration_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function listFeatures(projectId: string): Promise<ServiceFeature[]> {
  const res = await query<ServiceFeature>(
    'SELECT * FROM semo.service_features WHERE service_id = $1 ORDER BY category, sort_order, name',
    [projectId]
  );
  return res.rows;
}

export async function createFeature(data: {
  service_id: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  parent_id?: string;
  iteration_id?: string;
  sort_order?: number;
  metadata?: Record<string, unknown>;
}): Promise<ServiceFeature> {
  const res = await query<ServiceFeature>(
    `INSERT INTO semo.service_features (service_id, name, description, category, status, parent_id, iteration_id, sort_order, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.service_id,
      data.name,
      data.description ?? null,
      data.category ?? 'core',
      data.status ?? 'active',
      data.parent_id ?? null,
      data.iteration_id ?? null,
      data.sort_order ?? 0,
      JSON.stringify(data.metadata ?? {}),
    ]
  );
  return res.rows[0];
}

export async function updateFeature(
  featureId: string,
  data: Partial<Pick<ServiceFeature, 'name' | 'description' | 'category' | 'status' | 'parent_id' | 'iteration_id' | 'sort_order' | 'metadata'>>
): Promise<ServiceFeature | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.category !== undefined) { sets.push(`category = $${idx++}`); params.push(data.category); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }
  if (data.parent_id !== undefined) { sets.push(`parent_id = $${idx++}`); params.push(data.parent_id); }
  if (data.iteration_id !== undefined) { sets.push(`iteration_id = $${idx++}`); params.push(data.iteration_id); }
  if (data.sort_order !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(data.sort_order); }
  if (data.metadata !== undefined) {
    sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
    params.push(JSON.stringify(data.metadata));
  }

  if (sets.length === 0) return null;
  params.push(featureId);
  const res = await query<ServiceFeature>(
    `UPDATE semo.service_features SET ${sets.join(', ')} WHERE feature_id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

export async function deleteFeature(featureId: string): Promise<boolean> {
  const res = await query(
    `UPDATE semo.service_features SET status = 'deprecated' WHERE feature_id = $1`,
    [featureId]
  );
  return (res.rowCount ?? 0) > 0;
}

// ── Service Overview (KB aggregation for ops mode) ──

export interface ServiceOverviewKB {
  baseInformation: string | null;
  po: string | null;
  techStack: string | null;
  serviceUrl: string | null;
  repo: string | null;
  slackChannel: string | null;
  bm: string | null;
  currentSituation: string | null;
  infra: string | null;
}

export async function getServiceOverviewKB(serviceDomain: string): Promise<ServiceOverviewKB> {
  const keys = [
    'base-information', 'po', 'tech-stack', 'service-url',
    'repo', 'slack-channel', 'bm', 'current-situation', 'infra',
  ];
  const res = await query<{ key: string; content: string }>(
    `SELECT key, content FROM semo.knowledge_base
     WHERE domain = $1 AND key = ANY($2) AND sub_key = ''
     ORDER BY key`,
    [serviceDomain, keys]
  );
  const map = new Map(res.rows.map((r) => [r.key, r.content]));
  return {
    baseInformation: map.get('base-information') ?? null,
    po: map.get('po') ?? null,
    techStack: map.get('tech-stack') ?? null,
    serviceUrl: map.get('service-url') ?? null,
    repo: map.get('repo') ?? null,
    slackChannel: map.get('slack-channel') ?? null,
    bm: map.get('bm') ?? null,
    currentSituation: map.get('current-situation') ?? null,
    infra: map.get('infra') ?? null,
  };
}

export async function getServiceKPIData(serviceDomain: string, limit = 5) {
  // KPI snapshots — latest N
  const kpiRes = await query<{ key: string; sub_key: string; content: string; updated_at: string }>(
    `SELECT key, sub_key, content, updated_at::text
     FROM semo.knowledge_base
     WHERE domain = $1 AND key = 'kpi' AND sub_key != ''
     ORDER BY sub_key DESC LIMIT $2`,
    [serviceDomain, limit]
  );

  // Action items — latest N
  const actionRes = await query<{ key: string; sub_key: string; content: string; updated_at: string }>(
    `SELECT key, sub_key, content, updated_at::text
     FROM semo.knowledge_base
     WHERE domain = $1 AND key = 'action-item' AND sub_key != ''
     ORDER BY sub_key DESC LIMIT $2`,
    [serviceDomain, limit]
  );

  // Milestones
  const milestoneRes = await query<{ key: string; sub_key: string; content: string; metadata: Record<string, unknown> }>(
    `SELECT key, sub_key, content, metadata
     FROM semo.knowledge_base
     WHERE domain = $1 AND key = 'milestone'
     ORDER BY sub_key`,
    [serviceDomain]
  );

  return {
    kpiSnapshots: kpiRes.rows.map((r) => ({ subKey: r.sub_key, content: r.content, updatedAt: r.updated_at })),
    actionItems: actionRes.rows.map((r) => ({ subKey: r.sub_key, content: r.content, updatedAt: r.updated_at })),
    milestones: milestoneRes.rows.map((r) => ({ subKey: r.sub_key, content: r.content, metadata: r.metadata ?? {} })),
  };
}

// ── KPI Metrics (DB records) ──

export async function listKPIMetrics(projectId: string, period?: string, limit = 50): Promise<ServiceKPIMetric[]> {
  if (period) {
    const res = await query<ServiceKPIMetric>(
      `SELECT * FROM semo.service_kpi_metrics
       WHERE service_id = $1 AND period = $2::date
       ORDER BY category, metric_name`,
      [projectId, period]
    );
    return res.rows;
  }
  const res = await query<ServiceKPIMetric>(
    `SELECT * FROM semo.service_kpi_metrics
     WHERE service_id = $1
     ORDER BY period DESC, category, metric_name
     LIMIT $2`,
    [projectId, limit]
  );
  return res.rows;
}

export async function listKPIPeriods(projectId: string): Promise<string[]> {
  const res = await query<{ period: string }>(
    `SELECT DISTINCT period::text FROM semo.service_kpi_metrics
     WHERE service_id = $1 ORDER BY period DESC`,
    [projectId]
  );
  return res.rows.map((r) => r.period);
}

export async function batchCreateKPIMetrics(
  projectId: string,
  period: string,
  source: string,
  metrics: Array<Omit<ServiceKPIMetric, 'metric_id' | 'service_id' | 'period' | 'source' | 'created_at' | 'updated_at'>>
): Promise<ServiceKPIMetric[]> {
  return transaction(async (client) => {
    const results: ServiceKPIMetric[] = [];
    for (const m of metrics) {
      const res = await client.query<ServiceKPIMetric>(
        `INSERT INTO semo.service_kpi_metrics
           (service_id, iteration_id, period, metric_name, metric_label, category,
            current_value, baseline_value, target_value, unit, wow_change, signal, achieved, source, metadata)
         VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          projectId, m.iteration_id ?? null, period, m.metric_name, m.metric_label ?? null, m.category ?? 'common',
          m.current_value ?? null, m.baseline_value ?? null, m.target_value ?? null,
          m.unit ?? null, m.wow_change ?? null, m.signal ?? 'neutral', m.achieved ?? false,
          source, JSON.stringify(m.metadata ?? {}),
        ]
      );
      results.push(res.rows[0]);
    }
    return results;
  });
}

export async function updateKPIMetric(
  metricId: string,
  data: Partial<Pick<ServiceKPIMetric, 'current_value' | 'baseline_value' | 'target_value' | 'wow_change' | 'signal' | 'achieved' | 'metric_label' | 'category' | 'unit' | 'metadata'>>
): Promise<ServiceKPIMetric | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (key === 'metadata') {
      sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
      params.push(JSON.stringify(val));
    } else {
      sets.push(`${key} = $${idx++}`);
      params.push(val);
    }
  }
  if (sets.length === 0) return null;
  params.push(metricId);
  const res = await query<ServiceKPIMetric>(
    `UPDATE semo.service_kpi_metrics SET ${sets.join(', ')} WHERE metric_id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

export async function deleteKPIMetric(metricId: string): Promise<boolean> {
  const res = await query('DELETE FROM semo.service_kpi_metrics WHERE metric_id = $1', [metricId]);
  return (res.rowCount ?? 0) > 0;
}

// ── Service Action Items (DB records) ──

export async function listServiceActionItems(projectId: string, status?: string): Promise<ServiceActionItem[]> {
  if (status) {
    const res = await query<ServiceActionItem>(
      `SELECT * FROM semo.service_action_items
       WHERE service_id = $1 AND status = $2
       ORDER BY sort_order, created_at DESC`,
      [projectId, status]
    );
    return res.rows;
  }
  const res = await query<ServiceActionItem>(
    `SELECT * FROM semo.service_action_items
     WHERE service_id = $1
     ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END, sort_order, created_at DESC`,
    [projectId]
  );
  return res.rows;
}

export async function createServiceActionItem(data: {
  service_id: string;
  description: string;
  assignee?: string;
  deadline?: string;
  status?: string;
  priority?: string;
  category?: string;
  source?: string;
  related_url?: string;
  sort_order?: number;
  iteration_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<ServiceActionItem> {
  const res = await query<ServiceActionItem>(
    `INSERT INTO semo.service_action_items
       (service_id, iteration_id, description, assignee, deadline, status, priority, category, source, related_url, sort_order, metadata)
     VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.service_id, data.iteration_id ?? null, data.description,
      data.assignee ?? null, data.deadline ?? null, data.status ?? 'open',
      data.priority ?? 'normal', data.category ?? null, data.source ?? 'manual',
      data.related_url ?? null, data.sort_order ?? 0, JSON.stringify(data.metadata ?? {}),
    ]
  );
  return res.rows[0];
}

export async function updateServiceActionItem(
  itemId: string,
  data: Partial<Pick<ServiceActionItem, 'description' | 'assignee' | 'deadline' | 'status' | 'priority' | 'category' | 'related_url' | 'sort_order' | 'metadata'>>
): Promise<ServiceActionItem | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (key === 'metadata') {
      sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
      params.push(JSON.stringify(val));
    } else {
      sets.push(`${key} = $${idx++}`);
      params.push(val);
    }
  }
  // auto-set completed_at
  if (data.status === 'completed') {
    sets.push(`completed_at = NOW()`);
  } else if (data.status === 'open') {
    sets.push(`completed_at = NULL`);
  }

  if (sets.length === 0) return null;
  params.push(itemId);
  const res = await query<ServiceActionItem>(
    `UPDATE semo.service_action_items SET ${sets.join(', ')} WHERE action_item_id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

export async function deleteServiceActionItem(itemId: string): Promise<boolean> {
  const res = await query('DELETE FROM semo.service_action_items WHERE action_item_id = $1', [itemId]);
  return (res.rowCount ?? 0) > 0;
}

// ── Service Iterations (ops mode sprint management) ──

export async function listIterations(projectId: string, status?: string): Promise<ServiceIteration[]> {
  if (status) {
    const res = await query<ServiceIteration>(
      `SELECT * FROM semo.service_iterations
       WHERE service_id = $1 AND status = $2
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, created_at DESC`,
      [projectId, status]
    );
    return res.rows;
  }
  const res = await query<ServiceIteration>(
    `SELECT * FROM semo.service_iterations
     WHERE service_id = $1
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, created_at DESC`,
    [projectId]
  );
  return res.rows;
}

export async function getIteration(iterationId: string): Promise<ServiceIteration | null> {
  const res = await query<ServiceIteration>(
    'SELECT * FROM semo.service_iterations WHERE iteration_id = $1',
    [iterationId]
  );
  return res.rows[0] ?? null;
}

export async function createIteration(data: {
  service_id: string;
  title: string;
  goal?: string;
  status?: string;
  started_at?: string;
}): Promise<ServiceIteration> {
  const res = await query<ServiceIteration>(
    `INSERT INTO semo.service_iterations (service_id, title, goal, status, started_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.service_id,
      data.title,
      data.goal ?? null,
      data.status ?? 'planned',
      data.started_at ?? null,
    ]
  );
  return res.rows[0];
}

export async function updateIteration(
  iterationId: string,
  data: Partial<Pick<ServiceIteration, 'title' | 'goal' | 'status' | 'started_at' | 'completed_at' | 'retrospective'>>
): Promise<ServiceIteration | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.title !== undefined) { sets.push(`title = $${idx++}`); params.push(data.title); }
  if (data.goal !== undefined) { sets.push(`goal = $${idx++}`); params.push(data.goal); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }
  if (data.started_at !== undefined) { sets.push(`started_at = $${idx++}`); params.push(data.started_at); }
  if (data.completed_at !== undefined) { sets.push(`completed_at = $${idx++}`); params.push(data.completed_at); }
  if (data.retrospective !== undefined) { sets.push(`retrospective = $${idx++}`); params.push(data.retrospective); }

  if (sets.length === 0) return null;
  params.push(iterationId);
  const res = await query<ServiceIteration>(
    `UPDATE semo.service_iterations SET ${sets.join(', ')} WHERE iteration_id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

export async function activateIteration(iterationId: string): Promise<ServiceIteration | null> {
  const res = await query<ServiceIteration>(
    `UPDATE semo.service_iterations SET status = 'active', started_at = NOW() WHERE iteration_id = $1 RETURNING *`,
    [iterationId]
  );
  return res.rows[0] ?? null;
}

export async function completeIteration(iterationId: string, retrospective?: string): Promise<ServiceIteration | null> {
  const res = await query<ServiceIteration>(
    `UPDATE semo.service_iterations SET status = 'completed', completed_at = NOW(), retrospective = COALESCE($2, retrospective)
     WHERE iteration_id = $1 RETURNING *`,
    [iterationId, retrospective ?? null]
  );
  return res.rows[0] ?? null;
}

export async function deleteIteration(iterationId: string): Promise<boolean> {
  const res = await query('DELETE FROM semo.service_iterations WHERE iteration_id = $1', [iterationId]);
  return (res.rowCount ?? 0) > 0;
}
