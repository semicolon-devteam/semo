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
      JSON.stringify(data.metadata ?? {}),
    ]
  );
  const project = res.rows[0];

  // KB에 gfp_id 저장 (service_domain이 있을 때)
  if (data.service_domain) {
    writeGfpIdToKB(data.service_domain, project).catch((err) =>
      console.error('[GFP] KB gfp-id write failed:', err)
    );
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
  const content = [
    `gfp_id: ${project.gfp_id}`,
    `project_name: ${project.project_name}`,
    `owner: ${project.owner_name}`,
    `status: ${project.status}`,
    `current_phase: ${project.current_phase}`,
    `created_at: ${project.created_at}`,
  ].join('\n');
  await upsertItem(serviceDomain, 'gfp-id', content, 'gfp-pipeline');
  console.log(`[GFP] KB gfp-id written for domain '${serviceDomain}': ${project.gfp_id}`);
}

export async function updateProject(
  gfpId: string,
  data: Partial<Pick<GfpProject, 'project_name' | 'current_phase' | 'status' | 'metadata'>>
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
  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(data.status);
  }
  if (data.metadata !== undefined) {
    sets.push(`metadata = $${idx++}`);
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

export async function listSections(gfpId: string, phase?: number): Promise<GfpPhaseSection[]> {
  let sql = 'SELECT * FROM semo.gfp_phase_sections WHERE gfp_id = $1';
  const params: unknown[] = [gfpId];
  if (phase !== undefined) {
    sql += ' AND phase = $2';
    params.push(phase);
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
}): Promise<GfpPhaseSection> {
  // If qa_items provided without content, auto-generate markdown
  const content = data.content || (data.qa_items ? renderQAContent(data.qa_items) : '');

  const res = await query<GfpPhaseSection>(
    `INSERT INTO semo.gfp_phase_sections (gfp_id, phase, section_key, title, content, ordinal, status, source, qa_items)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (gfp_id, phase, section_key) DO UPDATE SET
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

export async function getPhaseProgress(gfpId: string): Promise<PhaseProgress[]> {
  const res = await query<PhaseProgress>(
    `SELECT phase,
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
            COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
            COUNT(*) FILTER (WHERE status = 'pending-review')::int as pending,
            COUNT(*) FILTER (WHERE status = 'draft')::int as draft
     FROM semo.gfp_phase_sections
     WHERE gfp_id = $1
     GROUP BY phase
     ORDER BY phase`,
    [gfpId]
  );
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
  nextPhase: number | null
): Promise<void> {
  const { upsertItem } = await import('./kb');
  const { PHASE_LABELS, getPhaseAssignee } = await import('./gfp-phases');

  const completedPhases = Array.from({ length: completedPhase + 1 }, (_, i) =>
    `${i}-${(PHASE_LABELS[i] ?? 'unknown').toLowerCase().replace(/\s+/g, '-')}`
  );

  const nextAssignee = nextPhase !== null && nextPhase <= 9
    ? getPhaseAssignee(nextPhase)
    : null;

  const content = [
    `gfp_id: ${gfpId}`,
    `current_phase: ${nextPhase !== null && nextPhase <= 9 ? nextPhase : 'completed'}`,
    `last_completed_phase: ${completedPhase} (${PHASE_LABELS[completedPhase]})`,
    `completed_phases: [${completedPhases.join(', ')}]`,
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
  mappings: GfpPhaseMapping[]
): Promise<number> {
  let count = 0;
  await transaction(async (client) => {
    for (const mapping of mappings) {
      for (let i = 0; i < mapping.sections.length; i++) {
        const sec = mapping.sections[i];
        await client.query(
          `INSERT INTO semo.gfp_phase_sections (gfp_id, phase, section_key, title, content, ordinal, status, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (gfp_id, phase, section_key) DO UPDATE SET
             title = EXCLUDED.title, content = EXCLUDED.content, ordinal = EXCLUDED.ordinal,
             status = EXCLUDED.status, source = EXCLUDED.source`,
          [gfpId, mapping.phase, sec.key, sec.title, sec.content, i, 'pending-review', 'imported']
        );
        count++;
      }
    }
  });
  return count;
}
