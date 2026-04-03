/**
 * GFP (Greenfield Project Pipeline) DB Layer
 * CRUD operations for GFP projects, sections, materials, and research tasks.
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
} from '@/types';

// ── Projects ──

export async function listProjects(status?: string): Promise<GfpProject[]> {
  let sql = 'SELECT * FROM semo.gfp_projects';
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
    'SELECT * FROM semo.gfp_projects WHERE gfp_id = $1',
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
    `INSERT INTO semo.gfp_projects (project_name, owner_name, owner_contact, service_domain, metadata)
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
      'UPDATE semo.gfp_projects SET infra_phase = 0 WHERE gfp_id = $1',
      [project.gfp_id]
    );
    project.infra_phase = 0;
  }

  // KB에 gfp_id 저장 (service_domain이 있을 때)
  if (data.service_domain) {
    writeGfpIdToKB(data.service_domain, project).catch((err) =>
      console.error('[GFP] KB gfp-id write failed:', err)
    );

    // infra-ready 프리셋: 인프라 정보를 KB에 별도 기록
    if (data.metadata?.preset === 'infra-ready') {
      writeInfraToKB(data.service_domain, data.metadata).catch((err) =>
        console.error('[GFP] KB infra write failed:', err)
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
  console.log(`[GFP] Ontology domain '${domain}' auto-registered for project '${projectName}'`);
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
    `gfp_id: ${project.gfp_id}`,
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

  await upsertItem(serviceDomain, 'gfp-id', lines.join('\n'), 'gfp-pipeline');
  console.log(`[GFP] KB gfp-id written for domain '${serviceDomain}': ${project.gfp_id} (preset: ${presetId})`);
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

  await upsertItem(serviceDomain, 'infra', lines.join('\n'), 'gfp-pipeline');
  console.log(`[GFP] KB infra written for domain '${serviceDomain}'`);
}

export async function updateProject(
  gfpId: string,
  data: Partial<Pick<GfpProject, 'project_name' | 'current_phase' | 'infra_phase' | 'status' | 'metadata'>>
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
  if (data.metadata !== undefined) {
    sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
    params.push(JSON.stringify(data.metadata));
  }

  if (sets.length === 0) return getProject(gfpId);

  params.push(gfpId);
  const res = await query<GfpProject>(
    `UPDATE semo.gfp_projects SET ${sets.join(', ')} WHERE gfp_id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

// ── Sections ──

export async function listSections(gfpId: string, phase?: number, track?: GfpTrack): Promise<GfpPhaseSection[]> {
  let sql = 'SELECT * FROM semo.gfp_phase_sections WHERE gfp_id = $1';
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
  gfp_id: string;
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
    `INSERT INTO semo.gfp_phase_sections (gfp_id, phase, section_key, title, content, ordinal, status, source, qa_items, track)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (gfp_id, track, phase, section_key) DO UPDATE SET
       title   = EXCLUDED.title,
       content = EXCLUDED.content,
       ordinal = EXCLUDED.ordinal,
       status  = EXCLUDED.status,
       source  = EXCLUDED.source,
       qa_items = EXCLUDED.qa_items
     RETURNING *`,
    [
      data.gfp_id,
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
    `UPDATE semo.gfp_phase_sections
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
    `UPDATE semo.gfp_phase_sections
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
    'SELECT * FROM semo.gfp_phase_sections WHERE section_id = $1',
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
    `UPDATE semo.gfp_phase_sections
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
    'DELETE FROM semo.gfp_phase_sections WHERE section_id = $1 AND gfp_id = $2 RETURNING *',
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
    'SELECT * FROM semo.gfp_phase_sections WHERE section_id = $1 AND gfp_id = $2',
    [sectionId, gfpId]
  );
  if (!current.rows[0]) return null;

  const section = current.rows[0];
  const track = targetTrack ?? section.track ?? 'plan';

  // Check UNIQUE constraint (gfp_id, track, phase, section_key)
  const conflict = await query<GfpPhaseSection>(
    `SELECT section_id FROM semo.gfp_phase_sections
     WHERE gfp_id = $1 AND track = $2 AND phase = $3 AND section_key = $4 AND section_id != $5`,
    [gfpId, track, targetPhase, section.section_key, sectionId]
  );
  if (conflict.rows.length > 0) {
    throw new Error('CONFLICT');
  }

  const res = await query<GfpPhaseSection>(
    `UPDATE semo.gfp_phase_sections
     SET phase = $1, track = $2
     WHERE section_id = $3 AND gfp_id = $4
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
    'UPDATE semo.gfp_phase_sections SET slack_thread_ts = $1 WHERE section_id = $2',
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
     FROM semo.gfp_phase_sections
     WHERE gfp_id = $1`;
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
  gfp_id: string;
  content: string;
  phase_mapping?: GfpPhaseMapping[];
}): Promise<GfpMaterial> {
  const res = await query<GfpMaterial>(
    `INSERT INTO semo.gfp_materials (gfp_id, content, phase_mapping)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.gfp_id, data.content, data.phase_mapping ? JSON.stringify(data.phase_mapping) : null]
  );
  return res.rows[0];
}

export async function listMaterials(gfpId: string): Promise<GfpMaterial[]> {
  const res = await query<GfpMaterial>(
    'SELECT * FROM semo.gfp_materials WHERE gfp_id = $1 ORDER BY created_at DESC',
    [gfpId]
  );
  return res.rows;
}

// ── Stitch Materials ──

export async function createStitchMaterial(data: {
  gfp_id: string;
  content: string;
  material_type?: string;
}): Promise<GfpMaterial> {
  const materialType = data.material_type ?? 'stitch-export';
  const res = await query<GfpMaterial>(
    `INSERT INTO semo.gfp_materials (gfp_id, content, material_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.gfp_id, data.content, materialType]
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
    `UPDATE semo.gfp_projects
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
     WHERE gfp_id = $2`,
    [JSON.stringify({ design_step: step }), gfpId]
  );
}

/**
 * Phase 4 섹션들의 현재 design step 자동 전진 체크.
 * 현재 스텝의 모든 섹션이 approved면 다음 스텝으로 전진.
 * Returns the new step (or current if no advance).
 */
export async function checkDesignStepAdvance(gfpId: string): Promise<number> {
  const { DESIGN_STEPS } = await import('@/types');

  const currentStep = await getDesignStep(gfpId);
  const stepDef = DESIGN_STEPS.find((s) => s.step === currentStep);
  if (!stepDef || currentStep >= 5) return currentStep;

  const sections = await listSections(gfpId, 4);
  const stepSections = sections.filter((s) => s.section_key.startsWith(stepDef.prefix));

  // 해당 스텝에 섹션이 없으면 전진하지 않음
  if (stepSections.length === 0) return currentStep;

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
  gfp_id: string;
  task_type: string;
  reference_urls: string[];
  input_prompt: string;
}): Promise<GfpResearchTask> {
  const res = await query<GfpResearchTask>(
    `INSERT INTO semo.gfp_research_tasks (gfp_id, task_type, reference_urls, input_prompt)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.gfp_id, data.task_type, data.reference_urls, data.input_prompt]
  );
  return res.rows[0];
}

export async function listResearchTasks(gfpId: string): Promise<GfpResearchTask[]> {
  const res = await query<GfpResearchTask>(
    'SELECT * FROM semo.gfp_research_tasks WHERE gfp_id = $1 ORDER BY created_at DESC',
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
    `UPDATE semo.gfp_research_tasks SET ${sets.join(', ')} WHERE task_id = $${idx} RETURNING *`,
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

  await upsertItem(serviceDomain, `spec/${phaseName}`, content, 'gfp-pipeline');

  // KB write-back 시각 기록
  const sectionIds = sections.map((s) => s.section_id);
  await query(
    `UPDATE semo.gfp_phase_sections SET kb_written_at = NOW() WHERE section_id = ANY($1)`,
    [sectionIds]
  );
  console.log(`[GFP] KB write-back: ${serviceDomain} spec/${phaseName} (${sectionIds.length} sections)`);
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
      `gfp_id: ${gfpId}`,
      `infra_completed_phase: ${completedPhase} (${INFRA_PHASE_LABELS[completedPhase]})`,
      `infra_next_phase: ${nextPhase !== null ? `${nextPhase} (${INFRA_PHASE_LABELS[nextPhase]})` : 'completed'}`,
      `updated_at: ${new Date().toISOString()}`,
    ].join('\n');

    await upsertItem(serviceDomain, 'infra-status', content, 'gfp-pipeline');
    console.log(`[GFP] KB infra progress: ${serviceDomain}/infra-status → phase ${nextPhase ?? 'done'}`);
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
    `gfp_id: ${gfpId}`,
    `current_phase: ${nextPhase !== null && nextPhase <= 9 ? nextPhase : 'completed'}`,
    `last_completed_phase: ${completedPhase} (${PHASE_LABELS[completedPhase]})`,
    `completed_phases: [${completedPhases.join(', ')}]`,
    ...infraLines,
    nextAssignee
      ? `next_assignee: ${nextAssignee.botId} (Phase ${nextPhase} — ${PHASE_LABELS[nextPhase!]})`
      : 'status: all-phases-completed',
    `updated_at: ${new Date().toISOString()}`,
  ].join('\n');

  await upsertItem(serviceDomain, 'gfp-status', content, 'gfp-pipeline');
  console.log(`[GFP] KB phase progress: ${serviceDomain}/gfp-status → phase ${nextPhase ?? 'done'}`);
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
          `INSERT INTO semo.gfp_phase_sections (gfp_id, phase, section_key, title, content, ordinal, status, source, track)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (gfp_id, track, phase, section_key) DO UPDATE SET
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
    'SELECT * FROM semo.gfp_infra_requests WHERE gfp_id = $1 ORDER BY created_at DESC',
    [gfpId]
  );
  return res.rows;
}

export async function createInfraRequest(data: {
  gfp_id: string;
  source_phase: number;
  source_section_id?: string;
  category: GfpInfraCategory;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high';
}): Promise<GfpInfraRequest> {
  const res = await query<GfpInfraRequest>(
    `INSERT INTO semo.gfp_infra_requests (gfp_id, source_phase, source_section_id, category, title, description, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.gfp_id,
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
    `UPDATE semo.gfp_infra_requests
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
