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
  return res.rows[0];
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
}): Promise<GfpPhaseSection> {
  const res = await query<GfpPhaseSection>(
    `INSERT INTO semo.gfp_phase_sections (gfp_id, phase, section_key, title, content, ordinal, status, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (gfp_id, phase, section_key) DO UPDATE SET
       title   = EXCLUDED.title,
       content = EXCLUDED.content,
       ordinal = EXCLUDED.ordinal,
       status  = EXCLUDED.status,
       source  = EXCLUDED.source
     RETURNING *`,
    [
      data.gfp_id,
      data.phase,
      data.section_key,
      data.title,
      data.content,
      data.ordinal ?? 0,
      data.status ?? 'draft',
      data.source ?? 'manual',
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
