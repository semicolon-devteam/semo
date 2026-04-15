/**
 * Service Project DB Layer (formerly GFP — Greenfield Project Pipeline)
 * CRUD operations for service projects, sections, materials, and research tasks.
 *
 * Table mapping: service_projects, service_sections, service_materials,
 *   service_research_tasks, service_infra_requests
 * KB projection keys: spec/*, pm-status, infra-status (written by pm-pipeline)
 */

import { query, transaction } from '../../db';
import type {
  ServiceProject,
  ServiceSection,
  ServiceMaterial,
  ServiceResearchTask,
  ServiceSectionStatus,
  ServicePhaseMapping,
  ServiceQAItem,
  ServiceTrack,
  ServiceInfraRequest,
  ServiceInfraRequestStatus,
  ServiceInfraCategory,
  FeatureDiscoverySession,
  FeatureConversationSession,
  DeployVerification,
  DeployVerificationChecks,
} from '@/types';

// ── Projects ──

export async function listProjects(status?: string): Promise<ServiceProject[]> {
  let sql = 'SELECT * FROM semo.services';
  const params: string[] = [];
  if (status) {
    sql += ' WHERE status = $1';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const res = await query<ServiceProject>(sql, params);
  return res.rows;
}

export async function getProject(serviceId: string): Promise<ServiceProject | null> {
  const res = await query<ServiceProject>('SELECT * FROM semo.services WHERE service_id =$1', [
    serviceId,
  ]);
  return res.rows[0] ?? null;
}

export async function getChildServices(parentId: string): Promise<ServiceProject[]> {
  const res = await query<ServiceProject>(
    'SELECT * FROM semo.services WHERE parent_service_id = $1 ORDER BY project_name',
    [parentId],
  );
  return res.rows;
}

export async function createProject(data: {
  project_name: string;
  owner_name: string;
  owner_contact?: string;
  service_domain?: string;
  metadata?: Record<string, unknown>;
}): Promise<ServiceProject> {
  // 온톨로지 자동 등록: service_domain이 지정되었으나 아직 등록 안 된 경우
  if (data.service_domain) {
    await ensureOntologyDomain(data.service_domain, data.project_name);
  }

  const res = await query<ServiceProject>(
    `INSERT INTO semo.services (project_name, owner_name, owner_contact, service_domain, metadata, service_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.project_name,
      data.owner_name,
      data.owner_contact ?? null,
      data.service_domain ?? null,
      JSON.stringify({ preset: 'parallel', ...data.metadata }),
      'incubator',
    ],
  );
  const project = res.rows[0];

  // parallel 프리셋: infra_phase = 0 초기화 (Track B 활성화)
  if (data.metadata?.preset === 'parallel') {
    await query('UPDATE semo.services SET infra_phase = 0 WHERE service_id =$1', [
      project.service_id,
    ]);
    project.infra_phase = 0;
  }

  // KB에 gfp_id 저장 (service_domain이 있을 때)
  if (data.service_domain) {
    writeServiceIdToKB(data.service_domain, project).catch((err) =>
      console.error('[PM] KB service-id write failed:', err),
    );

    // infra-ready 프리셋: 인프라 정보를 KB에 별도 기록
    if (data.metadata?.preset === 'infra-ready') {
      writeInfraToKB(data.service_domain, data.metadata).catch((err) =>
        console.error('[PM] KB infra write failed:', err),
      );
    }
  }

  return project;
}

/**
 * 온톨로지에 도메인이 없으면 자동 등록 (service 타입)
 */
async function ensureOntologyDomain(domain: string, projectName: string): Promise<void> {
  const check = await query('SELECT 1 FROM semo.ontology WHERE domain = $1', [domain]);
  if (check.rows.length > 0) return;

  await query(
    `INSERT INTO semo.ontology (domain, schema, entity_type, service, description, tags)
     VALUES ($1, '{}', 'service', $1, $2, $3)
     ON CONFLICT (domain) DO NOTHING`,
    [domain, `${projectName} — 서비스 프로젝트`, ['gfp', 'incubator']],
  );
  console.log(`[PM] Ontology domain '${domain}' auto-registered for project '${projectName}'`);
}

/**
 * 서비스 프로젝트 생성 시 gfp_id를 KB에 기록.
 * 봇이 KB 검색으로 서비스의 서비스 프로젝트를 찾을 수 있도록 함.
 */
async function writeServiceIdToKB(serviceDomain: string, project: ServiceProject): Promise<void> {
  const { upsertItem } = await import('../../core/kb');
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
  console.log(
    `[PM] KB service-id written for domain '${serviceDomain}': ${project.service_id} (preset: ${presetId})`,
  );
}

/**
 * infra-ready 프리셋: 사전 구축된 인프라 정보를 KB에 기록.
 * 봇이 `semo kb get {domain} infra`로 인프라 정보를 조회할 수 있음.
 */
async function writeInfraToKB(
  serviceDomain: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { upsertItem } = await import('../../core/kb');
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
  serviceId: string,
  data: Partial<
    Pick<
      ServiceProject,
      | 'project_name'
      | 'current_phase'
      | 'infra_phase'
      | 'status'
      | 'lifecycle'
      | 'launched_at'
      | 'metadata'
    >
  >,
): Promise<ServiceProject | null> {
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

  if (sets.length === 0) return getProject(serviceId);

  params.push(serviceId);
  const res = await query<ServiceProject>(
    `UPDATE semo.services SET ${sets.join(', ')} WHERE service_id =$${idx} RETURNING *`,
    params,
  );
  return res.rows[0] ?? null;
}

// ── Sections ──

export async function listSections(
  serviceId: string,
  phase?: number,
  track?: ServiceTrack,
): Promise<ServiceSection[]> {
  let sql = 'SELECT * FROM semo.service_sections WHERE service_id =$1';
  const params: unknown[] = [serviceId];
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
  const res = await query<ServiceSection>(sql, params);
  return res.rows;
}

export async function upsertSection(data: {
  service_id: string;
  phase: number;
  section_key: string;
  title: string;
  content: string;
  ordinal?: number;
  status?: ServiceSectionStatus;
  source?: string;
  qa_items?: ServiceQAItem[];
  track?: ServiceTrack;
}): Promise<ServiceSection> {
  // If qa_items provided without content, auto-generate markdown
  const content = data.content || (data.qa_items ? renderQAContent(data.qa_items) : '');
  const track = data.track ?? 'plan';

  const res = await query<ServiceSection>(
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
    ],
  );
  return res.rows[0];
}

export async function updateSectionStatus(
  sectionId: string,
  status: ServiceSectionStatus,
  reviewerNote?: string,
): Promise<ServiceSection | null> {
  const res = await query<ServiceSection>(
    `UPDATE semo.service_sections
     SET status = $1, reviewer_note = $2
     WHERE section_id = $3
     RETURNING *`,
    [status, reviewerNote ?? null, sectionId],
  );
  return res.rows[0] ?? null;
}

export async function updateSectionContent(
  sectionId: string,
  content: string,
  status?: ServiceSectionStatus,
): Promise<ServiceSection | null> {
  const res = await query<ServiceSection>(
    `UPDATE semo.service_sections
     SET content = $1, status = COALESCE($2, status)
     WHERE section_id = $3
     RETURNING *`,
    [content, status ?? null, sectionId],
  );
  return res.rows[0] ?? null;
}

// ── Q&A helpers ──

/**
 * Render qa_items array into readable markdown (for content field, KB write-back, GitHub publish).
 */
export function renderQAContent(items: ServiceQAItem[]): string {
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
  via: 'dashboard' | 'slack',
): Promise<ServiceSection | null> {
  const sectionRes = await query<ServiceSection>(
    'SELECT * FROM semo.service_sections WHERE section_id = $1',
    [sectionId],
  );
  const section = sectionRes.rows[0];
  if (!section || !section.qa_items) return null;

  const qaItems: ServiceQAItem[] = (
    typeof section.qa_items === 'string' ? JSON.parse(section.qa_items) : section.qa_items
  ) as ServiceQAItem[];

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
  const res = await query<ServiceSection>(
    `UPDATE semo.service_sections
     SET qa_items = $1, content = $2
     WHERE section_id = $3
     RETURNING *`,
    [JSON.stringify(qaItems), content, sectionId],
  );
  return res.rows[0] ?? null;
}

// ── Section management (delete / move) ──

export async function deleteSection(
  sectionId: string,
  serviceId: string,
): Promise<ServiceSection | null> {
  const res = await query<ServiceSection>(
    'DELETE FROM semo.service_sections WHERE section_id = $1 AND service_id =$2 RETURNING *',
    [sectionId, serviceId],
  );
  return res.rows[0] ?? null;
}

export async function moveSection(
  sectionId: string,
  serviceId: string,
  targetPhase: number,
  targetTrack?: ServiceTrack,
): Promise<ServiceSection | null> {
  // Fetch current section to check existence and get section_key for conflict check
  const current = await query<ServiceSection>(
    'SELECT * FROM semo.service_sections WHERE section_id = $1 AND service_id =$2',
    [sectionId, serviceId],
  );
  if (!current.rows[0]) return null;

  const section = current.rows[0];
  const track = targetTrack ?? section.track ?? 'plan';

  // Check UNIQUE constraint (service_id, track, phase, section_key)
  const conflict = await query<ServiceSection>(
    `SELECT section_id FROM semo.service_sections
     WHERE service_id =$1 AND track = $2 AND phase = $3 AND section_key = $4 AND section_id != $5`,
    [serviceId, track, targetPhase, section.section_key, sectionId],
  );
  if (conflict.rows.length > 0) {
    throw new Error('CONFLICT');
  }

  const res = await query<ServiceSection>(
    `UPDATE semo.service_sections
     SET phase = $1, track = $2
     WHERE section_id = $3 AND service_id =$4
     RETURNING *`,
    [targetPhase, track, sectionId, serviceId],
  );
  return res.rows[0] ?? null;
}

/**
 * Save Slack thread_ts on a section (for answer collection polling).
 */
export async function updateSectionSlackThread(sectionId: string, threadTs: string): Promise<void> {
  await query('UPDATE semo.service_sections SET slack_thread_ts = $1 WHERE section_id = $2', [
    threadTs,
    sectionId,
  ]);
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

export async function getPhaseProgress(
  serviceId: string,
  track?: ServiceTrack,
): Promise<PhaseProgress[]> {
  let sql = `SELECT phase,
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
            COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
            COUNT(*) FILTER (WHERE status = 'pending-review')::int as pending,
            COUNT(*) FILTER (WHERE status = 'draft')::int as draft
     FROM semo.service_sections
     WHERE service_id =$1`;
  const params: unknown[] = [serviceId];
  if (track !== undefined) {
    sql += ' AND track = $2';
    params.push(track);
  }
  sql += ' GROUP BY phase ORDER BY phase';
  const res = await query<PhaseProgress>(sql, params);
  return res.rows;
}

// ── Materials (KB-backed) ──

function kbToMaterial(item: {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  updated_at?: string;
}): ServiceMaterial {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    material_id: (m.material_id as string) ?? '',
    service_id: (m.service_id as string) ?? '',
    content: item.content,
    phase_mapping: (m.phase_mapping as ServicePhaseMapping[]) ?? null,
    material_type: ((m.material_type as string) ??
      'planning-doc') as ServiceMaterial['material_type'],
    screenshot_data: (m.screenshot_data as string) ?? null,
    stitch_share_url: (m.stitch_share_url as string) ?? null,
    created_at: (m.created_at as string) ?? '',
  } as ServiceMaterial;
}

export async function createMaterial(data: {
  service_id: string;
  content: string;
  phase_mapping?: ServicePhaseMapping[];
}): Promise<ServiceMaterial> {
  const domain = await resolveDomain(data.service_id);
  const materialId = randomUUID();
  const now = new Date().toISOString();
  const item = await kbUpsert(domain, `material/${materialId}`, data.content, 'pm-pipeline', {
    material_id: materialId,
    service_id: data.service_id,
    material_type: 'planning-doc',
    phase_mapping: data.phase_mapping ?? null,
    screenshot_data: null,
    stitch_share_url: null,
    created_at: now,
  });
  return kbToMaterial(item);
}

export async function listMaterials(serviceId: string): Promise<ServiceMaterial[]> {
  const domain = await resolveDomain(serviceId);
  const items = await kbListByKeyPrefix(domain, 'material', '', { orderBy: 'updated_at' });
  return items.map(kbToMaterial);
}

export async function getMaterial(
  serviceId: string,
  materialId: string,
): Promise<ServiceMaterial | null> {
  const domain = await resolveDomain(serviceId);
  const item = await kbGetItem(domain, `material/${materialId}`);
  if (!item) return null;
  return kbToMaterial(item);
}

export async function updateMaterial(
  serviceId: string,
  materialId: string,
  data: { screenshot_data?: string; stitch_share_url?: string },
): Promise<ServiceMaterial | null> {
  const domain = await resolveDomain(serviceId);
  const patch: Record<string, unknown> = {};
  if (data.screenshot_data !== undefined) patch.screenshot_data = data.screenshot_data;
  if (data.stitch_share_url !== undefined) patch.stitch_share_url = data.stitch_share_url;
  if (Object.keys(patch).length === 0) return null;
  const item = await kbUpdateMetadata(domain, `material/${materialId}`, patch);
  return item ? kbToMaterial(item) : null;
}

// ── Stitch Materials (KB-backed) ──

export async function createStitchMaterial(data: {
  service_id: string;
  content: string;
  material_type?: string;
}): Promise<ServiceMaterial> {
  const domain = await resolveDomain(data.service_id);
  const materialId = randomUUID();
  const now = new Date().toISOString();
  const item = await kbUpsert(domain, `material/${materialId}`, data.content, 'pm-pipeline', {
    material_id: materialId,
    service_id: data.service_id,
    material_type: data.material_type ?? 'stitch-export',
    phase_mapping: null,
    screenshot_data: null,
    stitch_share_url: null,
    created_at: now,
  });
  return kbToMaterial(item);
}

// ── Design Step ──

export async function getDesignStep(serviceId: string): Promise<number> {
  const project = await getProject(serviceId);
  if (!project) return 1;
  return (project.metadata?.design_step as number) ?? 1;
}

export async function setDesignStep(serviceId: string, step: number): Promise<void> {
  await query(
    `UPDATE semo.services
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
     WHERE service_id =$2`,
    [JSON.stringify({ design_step: step }), serviceId],
  );
}

/**
 * Phase 4 섹션들의 현재 design step 자동 전진 체크.
 * 현재 스텝의 모든 섹션이 approved면 다음 스텝으로 전진.
 * Returns the new step (or current if no advance).
 */
export async function checkDesignStepAdvance(serviceId: string): Promise<number> {
  const { DESIGN_STEPS, matchesStep } = await import('@/types');

  const currentStep = await getDesignStep(serviceId);
  const stepDef = DESIGN_STEPS.find((s) => s.step === currentStep);
  if (!stepDef || currentStep >= 5) return currentStep;

  const sections = await listSections(serviceId, 4);
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
    await setDesignStep(serviceId, nextStep);
    return nextStep;
  }
  return currentStep;
}

// ── Research Tasks (KB-backed) ──

import { randomUUID } from 'crypto';
import {
  upsertItem as kbUpsert,
  updateMetadata as kbUpdateMetadata,
  listByKeyPrefix as kbListByKeyPrefix,
  deleteItemByKey as kbDelete,
  getItem as kbGetItem,
} from '../../core/kb';

async function resolveDomain(serviceId: string): Promise<string> {
  const project = await getProject(serviceId);
  if (!project?.service_domain) {
    throw new Error(`서비스 ${serviceId}의 도메인을 찾을 수 없습니다.`);
  }
  return project.service_domain;
}

export async function createResearchTask(data: {
  service_id: string;
  task_type: string;
  reference_urls: string[];
  input_prompt: string;
}): Promise<ServiceResearchTask> {
  const domain = await resolveDomain(data.service_id);
  const taskId = randomUUID();
  const now = new Date().toISOString();
  const item = await kbUpsert(domain, `research/${taskId}`, data.input_prompt, 'pm-pipeline', {
    task_id: taskId,
    service_id: data.service_id,
    task_type: data.task_type,
    reference_urls: data.reference_urls,
    status: 'queued',
    result: null,
    created_at: now,
  });
  const m = item.metadata ?? {};
  return {
    task_id: taskId,
    service_id: data.service_id,
    task_type: m.task_type as ServiceResearchTask['task_type'],
    reference_urls: m.reference_urls as string[],
    input_prompt: item.content,
    status: 'queued',
    result: null,
    created_at: now,
    updated_at: item.updated_at ?? now,
  };
}

export async function listResearchTasks(serviceId: string): Promise<ServiceResearchTask[]> {
  const domain = await resolveDomain(serviceId);
  const items = await kbListByKeyPrefix(domain, 'research', '', { orderBy: 'updated_at' });
  return items.map((item) => {
    const m = item.metadata ?? {};
    return {
      task_id: (m.task_id as string) ?? '',
      service_id: (m.service_id as string) ?? serviceId,
      task_type: (m.task_type ?? '') as ServiceResearchTask['task_type'],
      reference_urls: (m.reference_urls as string[]) ?? [],
      input_prompt: item.content,
      status: ((m.status as string) ?? 'queued') as ServiceResearchTask['status'],
      result: (m.result as string) ?? null,
      created_at: (m.created_at as string) ?? '',
      updated_at: item.updated_at ?? '',
    } as ServiceResearchTask;
  });
}

export async function updateResearchTask(
  taskId: string,
  data: Partial<Pick<ServiceResearchTask, 'status' | 'result'>>,
  serviceId?: string,
): Promise<ServiceResearchTask | null> {
  if (!serviceId) return null;
  const domain = await resolveDomain(serviceId);
  const key = `research/${taskId}`;
  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.result !== undefined) patch.result = data.result;
  if (Object.keys(patch).length === 0) return null;

  const item = await kbUpdateMetadata(domain, key, patch);
  if (!item) return null;
  const m = item.metadata ?? {};
  return {
    task_id: (m.task_id as string) ?? taskId,
    service_id: (m.service_id as string) ?? '',
    task_type: (m.task_type ?? '') as ServiceResearchTask['task_type'],
    reference_urls: (m.reference_urls as string[]) ?? [],
    input_prompt: item.content,
    status: ((m.status as string) ?? 'queued') as ServiceResearchTask['status'],
    result: (m.result as string) ?? null,
    created_at: (m.created_at as string) ?? '',
    updated_at: item.updated_at ?? '',
  } as ServiceResearchTask;
}

// ── KB Write-back (phase completion) ──

export async function writebackPhaseToKB(
  serviceId: string,
  phase: number,
  serviceDomain: string,
  phaseName: string,
): Promise<void> {
  // Dynamically import to avoid circular deps
  const { upsertItem } = await import('../../core/kb');

  const sections = await listSections(serviceId, phase);
  const allApproved = sections.length > 0 && sections.every((s) => s.status === 'approved');
  if (!allApproved) return;

  const content = sections
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => `## ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n');

  await upsertItem(serviceDomain, `spec/${phaseName}`, content, 'pm-pipeline');

  // KB write-back 시각 기록
  const sectionIds = sections.map((s) => s.section_id);
  await query(`UPDATE semo.service_sections SET kb_written_at = NOW() WHERE section_id = ANY($1)`, [
    sectionIds,
  ]);
  console.log(
    `[PM] KB write-back: ${serviceDomain} spec/${phaseName} (${sectionIds.length} sections)`,
  );
}

// ── KB Write-back (phase progress) ──

export async function writebackPhaseProgressToKB(
  serviceId: string,
  serviceDomain: string,
  completedPhase: number,
  nextPhase: number | null,
  track: ServiceTrack = 'plan',
): Promise<void> {
  const { upsertItem } = await import('../../core/kb');
  const { PHASE_LABELS, INFRA_PHASE_LABELS, getPhaseAssignee } = await import('./service-phases');

  if (track === 'infra') {
    const content = [
      `service_id: ${serviceId}`,
      `infra_completed_phase: ${completedPhase} (${INFRA_PHASE_LABELS[completedPhase]})`,
      `infra_next_phase: ${nextPhase !== null ? `${nextPhase} (${INFRA_PHASE_LABELS[nextPhase]})` : 'completed'}`,
      `updated_at: ${new Date().toISOString()}`,
    ].join('\n');

    await upsertItem(serviceDomain, 'infra-status', content, 'pm-pipeline');
    console.log(
      `[PM] KB infra progress: ${serviceDomain}/infra-status → phase ${nextPhase ?? 'done'}`,
    );
    return;
  }

  const completedPhases = Array.from(
    { length: completedPhase + 1 },
    (_, i) => `${i}-${(PHASE_LABELS[i] ?? 'unknown').toLowerCase().replace(/\s+/g, '-')}`,
  );

  const nextAssignee = nextPhase !== null && nextPhase <= 9 ? getPhaseAssignee(nextPhase) : null;

  // Include infra track info if available
  const project = await getProject(serviceId);
  const infraLines = project?.infra_phase !== null ? [`infra_phase: ${project?.infra_phase}`] : [];

  const content = [
    `service_id: ${serviceId}`,
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
  serviceId: string,
  mappings: ServicePhaseMapping[],
  track: ServiceTrack = 'plan',
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
          [
            serviceId,
            mapping.phase,
            sec.key,
            sec.title,
            sec.content,
            i,
            'pending-review',
            'imported',
            track,
          ],
        );
        count++;
      }
    }
  });
  return count;
}

// ── Infra Requests (KB-backed) ──

export async function listInfraRequests(serviceId: string): Promise<ServiceInfraRequest[]> {
  const domain = await resolveDomain(serviceId);
  const items = await kbListByKeyPrefix(domain, 'infra-request', '', { orderBy: 'updated_at' });
  return items.map((item) => {
    const m = item.metadata ?? {};
    return {
      request_id: (m.request_id as string) ?? '',
      service_id: (m.service_id as string) ?? serviceId,
      source_phase: (m.source_phase as number) ?? 0,
      source_section_id: (m.source_section_id as string) ?? null,
      category: (m.category as string) ?? 'other',
      title: (m.title as string) ?? '',
      description: item.content || null,
      priority: (m.priority as string) ?? 'normal',
      status: (m.status as string) ?? 'pending',
      slack_thread_ts: (m.slack_thread_ts as string) ?? null,
      created_at: (m.created_at as string) ?? '',
      updated_at: item.updated_at ?? '',
    } as ServiceInfraRequest;
  });
}

export async function createInfraRequest(data: {
  service_id: string;
  source_phase: number;
  source_section_id?: string;
  category: ServiceInfraCategory;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high';
}): Promise<ServiceInfraRequest> {
  const domain = await resolveDomain(data.service_id);
  const requestId = randomUUID();
  const now = new Date().toISOString();
  await kbUpsert(domain, `infra-request/${requestId}`, data.description ?? '', 'pm-pipeline', {
    request_id: requestId,
    service_id: data.service_id,
    source_phase: data.source_phase,
    source_section_id: data.source_section_id ?? null,
    category: data.category,
    title: data.title,
    priority: data.priority ?? 'normal',
    status: 'pending',
    slack_thread_ts: null,
    created_at: now,
  });
  return {
    request_id: requestId,
    service_id: data.service_id,
    source_phase: data.source_phase,
    source_section_id: data.source_section_id ?? null,
    category: data.category,
    title: data.title,
    description: data.description ?? null,
    priority: data.priority ?? 'normal',
    status: 'pending',
    slack_thread_ts: null,
    created_at: now,
    updated_at: now,
  };
}

export async function updateInfraRequest(
  requestId: string,
  status: ServiceInfraRequestStatus,
  slackThreadTs?: string,
  serviceId?: string,
): Promise<ServiceInfraRequest | null> {
  if (!serviceId) return null;
  const domain = await resolveDomain(serviceId);
  const patch: Record<string, unknown> = { status };
  if (slackThreadTs) patch.slack_thread_ts = slackThreadTs;
  const item = await kbUpdateMetadata(domain, `infra-request/${requestId}`, patch);
  if (!item) return null;
  const m = item.metadata ?? {};
  return {
    request_id: (m.request_id as string) ?? requestId,
    service_id: (m.service_id as string) ?? '',
    source_phase: (m.source_phase as number) ?? 0,
    source_section_id: (m.source_section_id as string) ?? null,
    category: (m.category as string) ?? 'other',
    title: (m.title as string) ?? '',
    description: item.content || null,
    priority: (m.priority as string) ?? 'normal',
    status: (m.status as string) ?? 'pending',
    slack_thread_ts: (m.slack_thread_ts as string) ?? null,
    created_at: (m.created_at as string) ?? '',
    updated_at: item.updated_at ?? '',
  } as ServiceInfraRequest;
}

export async function checkInfraTrackComplete(serviceId: string): Promise<boolean> {
  const project = await getProject(serviceId);
  if (!project || project.infra_phase === null) return true; // No infra track → considered complete
  if (project.infra_phase < 2) return false; // Infra has 3 phases (0, 1, 2)

  // Check phase 2 sections are all approved
  const sections = await listSections(serviceId, 2, 'infra');
  if (sections.length === 0) return project.infra_phase > 2;
  return sections.every((s) => s.status === 'approved');
}

// ── Deploy Verifications (KB-backed) ──

export async function createDeployVerification(data: {
  service_id: string;
  infra_phase: number;
  checks: DeployVerificationChecks;
  verified_by: string;
}): Promise<DeployVerification> {
  const isStrictPhase = data.infra_phase === 2;
  const allPassed = Object.entries(data.checks).every(([key, c]) => {
    if (c.status === 'pass') return true;
    if (c.status === 'skip') {
      if (isStrictPhase && (key === 'pod_status' || key === 'health_endpoint')) return false;
      return true;
    }
    return false;
  });
  const overall = allPassed ? 'pass' : 'fail';
  const domain = await resolveDomain(data.service_id);
  const verificationId = randomUUID();
  const now = new Date().toISOString();
  const dateSlug = now.slice(0, 10);

  await kbUpsert(domain, `deploy-verify/${data.infra_phase}/${dateSlug}`, '', 'pm-pipeline', {
    verification_id: verificationId,
    service_id: data.service_id,
    infra_phase: data.infra_phase,
    checks: data.checks,
    overall_status: overall,
    verified_by: data.verified_by,
    created_at: now,
  });

  return {
    verification_id: verificationId,
    service_id: data.service_id,
    infra_phase: data.infra_phase,
    checks: data.checks,
    overall_status: overall as DeployVerification['overall_status'],
    verified_by: data.verified_by,
    created_at: now,
  };
}

export async function getLatestVerification(
  serviceId: string,
  infraPhase: number,
): Promise<DeployVerification | null> {
  const domain = await resolveDomain(serviceId);
  const items = await kbListByKeyPrefix(domain, 'deploy-verify', `${infraPhase}/`, {
    orderBy: 'updated_at',
  });
  if (items.length === 0) return null;
  const item = items[0]; // latest by updated_at DESC
  const m = item.metadata ?? {};
  return {
    verification_id: (m.verification_id as string) ?? '',
    service_id: (m.service_id as string) ?? serviceId,
    infra_phase: (m.infra_phase as number) ?? infraPhase,
    checks: (m.checks as DeployVerificationChecks) ?? {},
    overall_status: ((m.overall_status as string) ??
      'fail') as DeployVerification['overall_status'],
    verified_by: (m.verified_by as string) ?? '',
    created_at: (m.created_at as string) ?? '',
  };
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

// ── Features (KB-backed) ──

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || randomUUID().slice(0, 8)
  );
}

function kbToFeature(item: {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  updated_at?: string;
}): ServiceFeature {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    feature_id: (m.feature_id as string) ?? '',
    service_id: (m.service_id as string) ?? '',
    name: (m.name as string) ?? '',
    description: item.content || null,
    category: (m.category as string) ?? 'core',
    status: (m.status as string) ?? 'active',
    parent_id: (m.parent_id as string) ?? null,
    iteration_id: null, // iteration_id 폐기 (Phase 1)
    sort_order: (m.sort_order as number) ?? 0,
    metadata: (m.feature_metadata as Record<string, unknown>) ?? {},
    created_at: (m.created_at as string) ?? '',
    updated_at: (item.updated_at as string) ?? '',
  } as ServiceFeature;
}

export async function listFeatures(projectId: string): Promise<ServiceFeature[]> {
  const domain = await resolveDomain(projectId);
  const items = await kbListByKeyPrefix(domain, 'feature', '');
  const features = items.map(kbToFeature);
  features.sort((a, b) => {
    const catCmp = (a.category ?? '').localeCompare(b.category ?? '');
    if (catCmp !== 0) return catCmp;
    const sortCmp = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sortCmp !== 0) return sortCmp;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
  return features;
}

export async function getFeatureById(
  projectId: string,
  featureId: string,
): Promise<ServiceFeature | null> {
  const domain = await resolveDomain(projectId);
  // feature_id가 sub_key인 경우
  const item = await kbGetItem(domain, `feature/${featureId}`);
  if (item) return kbToFeature(item);
  // slug 기반인 경우 전체 검색
  const items = await kbListByKeyPrefix(domain, 'feature', '', {
    where: { feature_id: featureId },
  });
  if (items.length === 0) return null;
  return kbToFeature(items[0]);
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
  const domain = await resolveDomain(data.service_id);
  const featureId = randomUUID();
  const slug = slugify(data.name);
  const now = new Date().toISOString();

  const item = await kbUpsert(
    domain,
    `feature/${featureId}`,
    data.description ?? '',
    'pm-pipeline',
    {
      feature_id: featureId,
      slug,
      service_id: data.service_id,
      name: data.name,
      category: data.category ?? 'core',
      status: data.status ?? 'active',
      parent_id: data.parent_id ?? null,
      sort_order: data.sort_order ?? 0,
      feature_metadata: data.metadata ?? {},
      created_at: now,
    },
  );
  return kbToFeature(item);
}

export async function updateFeature(
  featureId: string,
  data: Partial<
    Pick<
      ServiceFeature,
      | 'name'
      | 'description'
      | 'category'
      | 'status'
      | 'parent_id'
      | 'iteration_id'
      | 'sort_order'
      | 'metadata'
    >
  >,
  serviceId?: string,
): Promise<ServiceFeature | null> {
  // description 변경 시 content 업데이트 (임베딩 재생성)
  if (data.description !== undefined && serviceId) {
    const domain = await resolveDomain(serviceId);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.category !== undefined) patch.category = data.category;
    if (data.status !== undefined) patch.status = data.status;
    if (data.parent_id !== undefined) patch.parent_id = data.parent_id;
    if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
    if (data.metadata !== undefined) patch.feature_metadata = data.metadata;
    const item = await kbUpsert(
      domain,
      `feature/${featureId}`,
      data.description ?? '',
      'pm-pipeline',
      patch,
    );
    return kbToFeature(item);
  }

  // metadata만 업데이트 (임베딩 비용 없음)
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.category !== undefined) patch.category = data.category;
  if (data.status !== undefined) patch.status = data.status;
  if (data.parent_id !== undefined) patch.parent_id = data.parent_id;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (data.metadata !== undefined) patch.feature_metadata = data.metadata;
  if (Object.keys(patch).length === 0) return null;

  // serviceId 없으면 cross-domain 검색
  if (!serviceId) {
    const { list: kbListAll } = await import('../../core/kb');
    const found = await kbListAll(undefined, undefined, {
      key: 'feature',
      where: { feature_id: featureId },
    });
    if (found.length === 0) return null;
    const item = await kbUpdateMetadata(found[0].domain, `feature/${featureId}`, patch);
    return item ? kbToFeature(item) : null;
  }

  const domain = await resolveDomain(serviceId);
  const item = await kbUpdateMetadata(domain, `feature/${featureId}`, patch);
  return item ? kbToFeature(item) : null;
}

export async function deleteFeature(featureId: string, serviceId?: string): Promise<boolean> {
  // Soft delete: status → deprecated
  const result = await updateFeature(featureId, { status: 'deprecated' }, serviceId);
  return result !== null;
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
  // 1) services 테이블에서 SoT 컬럼 조회
  const svcRes = await query<{
    owner_name: string | null;
    tech_stack: string | null;
    service_url: string | null;
    repo: string | null;
    slack_channel: string | null;
    bm: string | null;
    status: string | null;
  }>(
    `SELECT owner_name, tech_stack, service_url, repo, slack_channel, bm, status
     FROM semo.services WHERE service_domain = $1 LIMIT 1`,
    [serviceDomain],
  );
  const svc = svcRes.rows[0];

  // 2) KB에서 자유형 텍스트 키만 조회
  const kbKeys = ['base-information', 'current-situation', 'infra'];
  const kbRes = await query<{ key: string; content: string }>(
    `SELECT key, content FROM semo.knowledge_base
     WHERE domain = $1 AND key = ANY($2) AND (sub_key = '' OR sub_key IS NULL)
     ORDER BY key`,
    [serviceDomain, kbKeys],
  );
  const map = new Map(kbRes.rows.map((r) => [r.key, r.content]));

  return {
    baseInformation: map.get('base-information') ?? null,
    po: svc?.owner_name ?? null,
    techStack: svc?.tech_stack ?? null,
    serviceUrl: svc?.service_url ?? null,
    repo: svc?.repo ?? null,
    slackChannel: svc?.slack_channel ?? null,
    bm: svc?.bm ?? null,
    currentSituation: map.get('current-situation') ?? null,
    infra: map.get('infra') ?? null,
  };
}

// ── KPI (re-exported from lib/kpi.ts) ──
export {
  getServiceKPIData,
  listKPIMetrics,
  listKPIPeriods,
  batchCreateKPIMetrics,
  updateKPIMetric,
  deleteKPIMetric,
} from './kpi';

// ── Action Items (re-exported from lib/action-items.ts) ──
export {
  listActionItems,
  createActionItem,
  updateActionItem,
  deleteActionItem,
} from '../../core/action-items';
export type { ActionItemFilters } from '../../core/action-items';

// ── Iterations (re-exported from lib/iterations.ts) ──
export {
  listIterations,
  getIteration,
  createIteration,
  updateIteration,
  activateIteration,
  completeIteration,
  deleteIteration,
} from './iterations';

// ── Feature Discovery Sessions (KB-backed) ──

export async function createDiscoverySession(data: {
  service_id: string;
  source_url: string;
}): Promise<FeatureDiscoverySession> {
  const domain = await resolveDomain(data.service_id);
  const sessionId = randomUUID();
  const now = new Date().toISOString();
  await kbUpsert(domain, `session/discovery/${sessionId}`, data.source_url, 'pm-pipeline', {
    session_id: sessionId,
    service_id: data.service_id,
    source_url: data.source_url,
    status: 'crawling',
    candidates: null,
    confirmed: null,
    screenshots: null,
    error: null,
    created_at: now,
  });
  return {
    session_id: sessionId,
    service_id: data.service_id,
    source_url: data.source_url,
    status: 'crawling',
    candidates: null,
    confirmed: null,
    screenshots: null,
    error: null,
    created_at: now,
    updated_at: now,
  } as unknown as FeatureDiscoverySession;
}

export async function getDiscoverySession(
  sessionId: string,
  serviceId?: string,
): Promise<FeatureDiscoverySession | null> {
  if (serviceId) {
    const domain = await resolveDomain(serviceId);
    const item = await kbGetItem(domain, `session/discovery/${sessionId}`);
    if (!item) return null;
    const m = item.metadata ?? {};
    return {
      session_id: sessionId,
      service_id: (m.service_id as string) ?? '',
      source_url: (m.source_url as string) ?? item.content,
      status: (m.status as string) ?? 'pending',
      candidates: (m.candidates as unknown) ?? null,
      confirmed: (m.confirmed as unknown) ?? null,
      screenshots: (m.screenshots as unknown) ?? null,
      error: (m.error as string) ?? null,
      created_at: (m.created_at as string) ?? '',
      updated_at: item.updated_at ?? '',
    } as unknown as FeatureDiscoverySession;
  }
  // Fallback: search across domains (for callback route)
  const { list: kbList } = await import('../../core/kb');
  const items = await kbList(undefined, undefined, {
    key: 'session',
    where: { session_id: sessionId },
  });
  if (items.length === 0) return null;
  const item = items[0];
  const m = item.metadata ?? {};
  return {
    session_id: sessionId,
    service_id: (m.service_id as string) ?? '',
    source_url: (m.source_url as string) ?? item.content,
    status: (m.status as string) ?? 'pending',
    candidates: (m.candidates as unknown) ?? null,
    confirmed: (m.confirmed as unknown) ?? null,
    screenshots: (m.screenshots as unknown) ?? null,
    error: (m.error as string) ?? null,
    created_at: (m.created_at as string) ?? '',
    updated_at: item.updated_at ?? '',
  } as unknown as FeatureDiscoverySession;
}

export async function updateDiscoverySession(
  sessionId: string,
  data: Partial<
    Pick<FeatureDiscoverySession, 'status' | 'candidates' | 'confirmed' | 'screenshots' | 'error'>
  >,
  serviceId?: string,
): Promise<FeatureDiscoverySession | null> {
  // Resolve domain: use serviceId if available, else find via getDiscoverySession
  let domain: string;
  if (serviceId) {
    domain = await resolveDomain(serviceId);
  } else {
    const existing = await getDiscoverySession(sessionId);
    if (!existing) return null;
    domain = await resolveDomain(existing.service_id);
  }

  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.candidates !== undefined) patch.candidates = data.candidates;
  if (data.confirmed !== undefined) patch.confirmed = data.confirmed;
  if (data.screenshots !== undefined) patch.screenshots = data.screenshots;
  if (data.error !== undefined) patch.error = data.error;

  if (Object.keys(patch).length === 0) return null;
  await kbUpdateMetadata(domain, `session/discovery/${sessionId}`, patch);
  return getDiscoverySession(sessionId, serviceId);
}

export async function listDiscoverySessions(serviceId: string): Promise<FeatureDiscoverySession[]> {
  const domain = await resolveDomain(serviceId);
  const items = await kbListByKeyPrefix(domain, 'session', 'discovery/', { orderBy: 'updated_at' });
  return items.map((item) => {
    const m = item.metadata ?? {};
    return {
      session_id: (m.session_id as string) ?? '',
      service_id: (m.service_id as string) ?? serviceId,
      source_url: (m.source_url as string) ?? item.content,
      status: (m.status as string) ?? 'pending',
      candidates: (m.candidates as unknown) ?? null,
      confirmed: (m.confirmed as unknown) ?? null,
      screenshots: (m.screenshots as unknown) ?? null,
      error: (m.error as string) ?? null,
      created_at: (m.created_at as string) ?? '',
      updated_at: item.updated_at ?? '',
    } as unknown as FeatureDiscoverySession;
  });
}

// ── Feature Conversation Sessions (KB-backed) ──

export async function createConversationSession(data: {
  service_id: string;
  mode?: string;
  slack_channel?: string;
  slack_thread_ts?: string;
}): Promise<FeatureConversationSession> {
  const domain = await resolveDomain(data.service_id);
  const sessionId = randomUUID();
  const now = new Date().toISOString();
  await kbUpsert(domain, `session/conversation/${sessionId}`, '', 'pm-pipeline', {
    session_id: sessionId,
    service_id: data.service_id,
    mode: data.mode ?? 'create',
    status: 'collecting',
    features: null,
    slack_channel: data.slack_channel ?? null,
    slack_thread_ts: data.slack_thread_ts ?? null,
    created_at: now,
  });
  return {
    session_id: sessionId,
    service_id: data.service_id,
    mode: data.mode ?? 'create',
    status: 'collecting',
    features: null,
    slack_channel: data.slack_channel ?? null,
    slack_thread_ts: data.slack_thread_ts ?? null,
    created_at: now,
    updated_at: now,
  } as unknown as FeatureConversationSession;
}

export async function getConversationSession(
  sessionId: string,
  serviceId?: string,
): Promise<FeatureConversationSession | null> {
  if (serviceId) {
    const domain = await resolveDomain(serviceId);
    const item = await kbGetItem(domain, `session/conversation/${sessionId}`);
    if (!item) return null;
    const m = item.metadata ?? {};
    return {
      session_id: sessionId,
      service_id: (m.service_id as string) ?? '',
      mode: (m.mode as string) ?? 'create',
      status: (m.status as string) ?? 'active',
      features: (m.features as unknown) ?? null,
      slack_channel: (m.slack_channel as string) ?? null,
      slack_thread_ts: (m.slack_thread_ts as string) ?? null,
      created_at: (m.created_at as string) ?? '',
      updated_at: item.updated_at ?? '',
    } as unknown as FeatureConversationSession;
  }
  // Fallback: cross-domain search
  const { list: kbList } = await import('../../core/kb');
  const items = await kbList(undefined, undefined, {
    key: 'session',
    where: { session_id: sessionId },
  });
  if (items.length === 0) return null;
  const item = items[0];
  const m = item.metadata ?? {};
  return {
    session_id: sessionId,
    service_id: (m.service_id as string) ?? '',
    mode: (m.mode as string) ?? 'create',
    status: (m.status as string) ?? 'active',
    features: (m.features as unknown) ?? null,
    slack_channel: (m.slack_channel as string) ?? null,
    slack_thread_ts: (m.slack_thread_ts as string) ?? null,
    created_at: (m.created_at as string) ?? '',
    updated_at: item.updated_at ?? '',
  } as unknown as FeatureConversationSession;
}

export async function updateConversationSession(
  sessionId: string,
  data: Partial<Pick<FeatureConversationSession, 'status' | 'features'>>,
  serviceId?: string,
): Promise<FeatureConversationSession | null> {
  let domain: string;
  if (serviceId) {
    domain = await resolveDomain(serviceId);
  } else {
    const existing = await getConversationSession(sessionId);
    if (!existing) return null;
    domain = await resolveDomain(existing.service_id);
  }

  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.features !== undefined) patch.features = data.features;

  if (Object.keys(patch).length === 0) return null;
  await kbUpdateMetadata(domain, `session/conversation/${sessionId}`, patch);
  return getConversationSession(sessionId, serviceId);
}

// ── Bulk Feature Creation ──

export async function bulkCreateFeatures(
  serviceId: string,
  features: Array<{
    name: string;
    description?: string;
    category?: string;
    status?: string;
    parent_id?: string;
    metadata?: Record<string, unknown>;
  }>,
): Promise<ServiceFeature[]> {
  if (features.length === 0) return [];
  const results: ServiceFeature[] = [];
  for (const f of features) {
    const feature = await createFeature({
      service_id: serviceId,
      name: f.name,
      description: f.description,
      category: f.category,
      status: f.status,
      parent_id: f.parent_id,
      metadata: f.metadata,
    });
    results.push(feature);
  }
  return results;
}
