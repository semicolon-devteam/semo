/**
 * Service Project DB Layer (formerly GFP — Greenfield Project Pipeline)
 * CRUD operations for service projects, sections, materials, and research tasks.
 *
 * All data is KB-backed: section/*, material/*, feature/*, research/*, infra-request/*
 * KB projection keys: spec/*, pm-status, infra-status (written by pm-pipeline)
 */

import { query } from '../../db';
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

// ── Projects (KB-backed) ──
// KB key: pipeline/config — 모든 ServiceProject 필드를 metadata에 저장

function kbToProject(item: {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  updated_at?: string;
}): ServiceProject {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    service_id: (m.service_id as string) ?? item.domain,
    project_name: (m.project_name as string) ?? '',
    service_domain: item.domain,
    owner_name: (m.owner_name as string) ?? '',
    owner_contact: (m.owner_contact as string) ?? null,
    current_phase: (m.current_phase as number) ?? 0,
    infra_phase: (m.infra_phase as number) ?? null,
    status: ((m.status as string) ?? 'active') as ServiceProject['status'],
    lifecycle: ((m.lifecycle as string) ?? 'build') as ServiceProject['lifecycle'],
    launched_at: (m.launched_at as string) ?? null,
    metadata: (m.project_metadata as Record<string, unknown>) ?? {},
    created_at: (m.created_at as string) ?? '',
    updated_at: (item.updated_at as string) ?? '',
    tech_stack: (m.tech_stack as string) ?? null,
    service_url: (m.service_url as string) ?? null,
    bm: (m.bm as string) ?? null,
    repo: (m.repo as string) ?? null,
    slack_channel: (m.slack_channel as string) ?? null,
    service_type: ((m.service_type as string) ?? 'incubator') as ServiceProject['service_type'],
    parent_service_id: (m.parent_service_id as string) ?? null,
  };
}

export async function listProjects(status?: string): Promise<ServiceProject[]> {
  const { listByKeyAcrossDomains: listAcross } = await import('../../core/kb');
  const where = status ? { status } : undefined;
  const items = await listAcross('service', 'pipeline/config', where);
  const projects = items.map(kbToProject);
  return projects.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

export async function getProject(serviceIdOrDomain: string): Promise<ServiceProject | null> {
  // domain으로 직접 조회 시도
  const item = await kbGetItem(serviceIdOrDomain, 'pipeline/config');
  if (item) return kbToProject(item);

  // UUID service_id로 검색 (레거시 호환)
  const { listByKeyAcrossDomains: listAcross } = await import('../../core/kb');
  const found = await listAcross('service', 'pipeline/config', { service_id: serviceIdOrDomain });
  if (found.length > 0) return kbToProject(found[0]);

  return null;
}

export async function getChildServices(parentId: string): Promise<ServiceProject[]> {
  const { listByKeyAcrossDomains: listAcross } = await import('../../core/kb');
  const items = await listAcross('service', 'pipeline/config', { parent_service_id: parentId });
  return items.map(kbToProject).sort((a, b) => a.project_name.localeCompare(b.project_name));
}

export async function createProject(data: {
  project_name: string;
  owner_name: string;
  owner_contact?: string;
  service_domain?: string;
  metadata?: Record<string, unknown>;
}): Promise<ServiceProject> {
  const domain = data.service_domain;
  if (!domain) throw new Error('service_domain은 필수입니다.');

  // 온톨로지 자동 등록
  await ensureOntologyDomain(domain, data.project_name);

  const serviceId = randomUUID();
  const now = new Date().toISOString();
  const projectMetadata = { preset: 'parallel', ...data.metadata };
  const infraPhase = projectMetadata.preset === 'parallel' ? 0 : null;

  const item = await kbUpsert(domain, 'pipeline/config', data.project_name, 'pm-pipeline', {
    service_id: serviceId,
    project_name: data.project_name,
    owner_name: data.owner_name,
    owner_contact: data.owner_contact ?? null,
    current_phase: 0,
    infra_phase: infraPhase,
    status: 'active',
    lifecycle: 'build',
    service_type: 'incubator',
    parent_service_id: null,
    tech_stack: null,
    service_url: null,
    bm: null,
    repo: null,
    slack_channel: null,
    launched_at: null,
    project_metadata: projectMetadata,
    created_at: now,
  });
  const project = kbToProject(item);

  // gfp-id KB 기록
  writeServiceIdToKB(domain, project).catch((err) =>
    console.error('[PM] KB service-id write failed:', err),
  );

  // infra-ready 프리셋
  if (data.metadata?.preset === 'infra-ready') {
    writeInfraToKB(domain, data.metadata).catch((err) =>
      console.error('[PM] KB infra write failed:', err),
    );
  }

  return project;
}

/**
 * 온톨로지에 도메인이 없으면 자동 등록 (service 타입)
 */
async function ensureOntologyDomain(domain: string, projectName: string): Promise<void> {
  const check = await query(`SELECT 1 FROM ${DB_SCHEMA}.ontology WHERE domain = $1`, [domain]);
  if (check.rows.length > 0) return;

  await query(
    `INSERT INTO ${DB_SCHEMA}.ontology (domain, schema, entity_type, service, description, tags)
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
  const project = await getProject(serviceId);
  if (!project?.service_domain) return null;
  const domain = project.service_domain;

  const patch: Record<string, unknown> = {};
  if (data.project_name !== undefined) patch.project_name = data.project_name;
  if (data.current_phase !== undefined) patch.current_phase = data.current_phase;
  if (data.infra_phase !== undefined) patch.infra_phase = data.infra_phase;
  if (data.status !== undefined) patch.status = data.status;
  if (data.lifecycle !== undefined) {
    patch.lifecycle = data.lifecycle;
    if (data.lifecycle === 'ops' && !project.launched_at) {
      patch.launched_at = new Date().toISOString();
    }
  }
  if (data.launched_at !== undefined) patch.launched_at = data.launched_at;
  if (data.metadata !== undefined) {
    // 기존 metadata와 병합
    patch.project_metadata = { ...(project.metadata ?? {}), ...data.metadata };
  }

  if (Object.keys(patch).length === 0) return project;

  const item = await kbUpdateMetadata(domain, 'pipeline/config', patch);
  return item ? kbToProject(item) : null;
}

// ── Sections (KB-backed) ──
// KB key: section/{track}/{phase}/{section_key}
// section_id는 `{track}/{phase}/{section_key}` 형태 또는 레거시 UUID

function sectionKbKey(track: string, phase: number, sectionKey: string): string {
  return `section/${track}/${phase}/${sectionKey}`;
}

function kbToSection(
  item: {
    domain: string;
    key: string;
    content: string;
    metadata?: Record<string, unknown>;
    updated_at?: string;
  },
  subKey?: string,
): ServiceSection {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  // sub_key에서 track/phase/section_key 추출
  const sk = subKey ?? (item.key.startsWith('section/') ? item.key.slice(8) : '');
  const parts = sk.split('/');
  return {
    section_id: (m.section_id as string) ?? sk,
    service_id: (m.service_id as string) ?? '',
    phase: (m.phase as number) ?? (parts.length >= 2 ? parseInt(parts[1]) : 0),
    track: ((m.track as string) ?? parts[0] ?? 'plan') as ServiceTrack,
    section_key: (m.section_key as string) ?? (parts.length >= 3 ? parts.slice(2).join('/') : ''),
    title: (m.title as string) ?? '',
    content: item.content,
    ordinal: (m.ordinal as number) ?? 0,
    status: ((m.status as string) ?? 'draft') as ServiceSectionStatus,
    reviewer_note: (m.reviewer_note as string) ?? null,
    source: ((m.source as string) ?? 'manual') as ServiceSection['source'],
    kb_written_at: (m.kb_written_at as string) ?? null,
    qa_items: (m.qa_items as ServiceQAItem[]) ?? null,
    slack_thread_ts: (m.slack_thread_ts as string) ?? null,
    created_at: (m.created_at as string) ?? '',
    updated_at: (item.updated_at as string) ?? '',
  };
}

export async function listSections(
  serviceId: string,
  phase?: number,
  track?: ServiceTrack,
): Promise<ServiceSection[]> {
  const domain = await resolveDomain(serviceId);
  let prefix = '';
  if (track !== undefined && phase !== undefined) {
    prefix = `${track}/${phase}/`;
  } else if (track !== undefined) {
    prefix = `${track}/`;
  } else if (phase !== undefined) {
    // phase만 있으면 모든 track에서 필터
    const items = await kbListByKeyPrefix(domain, 'section', '', { orderBy: 'metadata.ordinal' });
    return items
      .map((i) => kbToSection(i, i.key.startsWith('section/') ? i.key.slice(8) : ''))
      .filter((s) => s.phase === phase)
      .sort((a, b) => a.phase - b.phase || a.ordinal - b.ordinal);
  }
  const items = await kbListByKeyPrefix(domain, 'section', prefix, { orderBy: 'metadata.ordinal' });
  return items
    .map((i) => kbToSection(i, i.key.startsWith('section/') ? i.key.slice(8) : ''))
    .sort((a, b) => a.phase - b.phase || a.ordinal - b.ordinal);
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
  const track = data.track ?? 'plan';
  const content = data.content || (data.qa_items ? renderQAContent(data.qa_items) : '');
  const domain = await resolveDomain(data.service_id);
  const key = sectionKbKey(track, data.phase, data.section_key);
  const sectionId = `${track}/${data.phase}/${data.section_key}`;
  const now = new Date().toISOString();

  const item = await kbUpsert(domain, key, content, data.source ?? 'manual', {
    section_id: sectionId,
    service_id: data.service_id,
    phase: data.phase,
    track,
    section_key: data.section_key,
    title: data.title,
    ordinal: data.ordinal ?? 0,
    status: data.status ?? 'draft',
    source: data.source ?? 'manual',
    reviewer_note: null,
    qa_items: data.qa_items ?? null,
    slack_thread_ts: null,
    kb_written_at: null,
    created_at: now,
  });
  return kbToSection(item, sectionId);
}

export async function updateSectionStatus(
  sectionId: string,
  status: ServiceSectionStatus,
  reviewerNote?: string,
  serviceId?: string,
): Promise<ServiceSection | null> {
  if (!serviceId) return null;
  const domain = await resolveDomain(serviceId);
  const key = `section/${sectionId}`;
  const patch: Record<string, unknown> = { status };
  if (reviewerNote !== undefined) patch.reviewer_note = reviewerNote;
  const item = await kbUpdateMetadata(domain, key, patch);
  return item ? kbToSection(item, sectionId) : null;
}

export async function updateSectionContent(
  sectionId: string,
  content: string,
  status?: ServiceSectionStatus,
  serviceId?: string,
): Promise<ServiceSection | null> {
  let domain: string;
  if (serviceId) {
    domain = await resolveDomain(serviceId);
  } else {
    // service_id 없으면 section_id 기반 cross-domain KB 검색 fallback
    const { listByKeyAcrossDomains: listAcross } = await import('../../core/kb');
    const found = await listAcross('service', `section/${sectionId}`);
    if (found.length === 0) return null;
    domain = found[0].domain;
  }
  const key = `section/${sectionId}`;
  const patch: Record<string, unknown> = {};
  if (status) patch.status = status;
  // content 변경 → 임베딩 재생성 필요
  const item = await kbUpsert(domain, key, content, 'pm-pipeline', patch);
  return kbToSection(item, sectionId);
}

// ── Q&A helpers ──

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

export async function answerQAItems(
  sectionId: string,
  answers: Array<{ id: string; answer: string }>,
  via: 'dashboard' | 'slack',
  serviceId?: string,
): Promise<ServiceSection | null> {
  if (!serviceId) return null;
  const domain = await resolveDomain(serviceId);
  const key = `section/${sectionId}`;
  const existing = await kbGetItem(domain, key);
  if (!existing) return null;

  const m = existing.metadata ?? {};
  const qaItems: ServiceQAItem[] = (
    Array.isArray(m.qa_items)
      ? m.qa_items
      : typeof m.qa_items === 'string'
        ? JSON.parse(m.qa_items as string)
        : []
  ) as ServiceQAItem[];
  if (qaItems.length === 0) return null;

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
  // content + qa_items 동시 업데이트
  const updated = await kbUpsert(domain, key, content, 'pm-pipeline', { qa_items: qaItems });
  return kbToSection(updated, sectionId);
}

// ── Section management (delete / move) ──

export async function deleteSection(
  sectionId: string,
  serviceId: string,
): Promise<ServiceSection | null> {
  const domain = await resolveDomain(serviceId);
  const key = `section/${sectionId}`;
  const existing = await kbGetItem(domain, key);
  if (!existing) return null;
  const section = kbToSection(existing, sectionId);
  const { deleteItemByKey } = await import('../../core/kb');
  await deleteItemByKey(domain, key);
  return section;
}

export async function moveSection(
  sectionId: string,
  serviceId: string,
  targetPhase: number,
  targetTrack?: ServiceTrack,
): Promise<ServiceSection | null> {
  const domain = await resolveDomain(serviceId);
  const oldKey = `section/${sectionId}`;
  const existing = await kbGetItem(domain, oldKey);
  if (!existing) return null;

  const section = kbToSection(existing, sectionId);
  const track = targetTrack ?? section.track ?? 'plan';
  const newSectionId = `${track}/${targetPhase}/${section.section_key}`;
  const newKey = `section/${newSectionId}`;

  // Check conflict
  const conflict = await kbGetItem(domain, newKey);
  if (conflict && newKey !== oldKey) {
    throw new Error('CONFLICT');
  }

  // Delete old, create new
  const { deleteItemByKey } = await import('../../core/kb');
  await deleteItemByKey(domain, oldKey);
  const item = await kbUpsert(domain, newKey, section.content, 'pm-pipeline', {
    ...existing.metadata,
    section_id: newSectionId,
    phase: targetPhase,
    track,
  });
  return kbToSection(item, newSectionId);
}

export async function updateSectionSlackThread(
  sectionId: string,
  threadTs: string,
  serviceId?: string,
): Promise<void> {
  if (!serviceId) return;
  const domain = await resolveDomain(serviceId);
  await kbUpdateMetadata(domain, `section/${sectionId}`, { slack_thread_ts: threadTs });
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
  const domain = await resolveDomain(serviceId);
  const prefix = track ? `${track}/` : '';
  const items = await kbListByKeyPrefix(domain, 'section', prefix);
  const sections = items.map((i) =>
    kbToSection(i, i.key.startsWith('section/') ? i.key.slice(8) : ''),
  );

  // Group by phase and count statuses
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
    else if (s.status === 'draft') p.draft++;
  }

  return Array.from(phaseMap.values()).sort((a, b) => a.phase - b.phase);
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
  await updateProject(serviceId, { metadata: { design_step: step } });
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

  // KB write-back 시각 기록 (각 섹션의 metadata에 kb_written_at 기록)
  const now = new Date().toISOString();
  for (const s of sections) {
    await kbUpdateMetadata(serviceDomain, `section/${s.section_id}`, { kb_written_at: now });
  }
  console.log(
    `[PM] KB write-back: ${serviceDomain} spec/${phaseName} (${sections.length} sections)`,
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
  for (const mapping of mappings) {
    for (let i = 0; i < mapping.sections.length; i++) {
      const sec = mapping.sections[i];
      await upsertSection({
        service_id: serviceId,
        phase: mapping.phase,
        section_key: sec.key,
        title: sec.title,
        content: sec.content,
        ordinal: i,
        status: 'pending-review',
        source: 'imported',
        track,
      });
      count++;
    }
  }
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
  // pipeline/config에서 프로젝트 메타 조회 (KB 기반)
  const project = await getProject(serviceDomain);

  // KB에서 자유형 텍스트 키 조회
  const { list: kbListAll } = await import('../../core/kb');
  const kbItems = await kbListAll(serviceDomain);
  const map = new Map(kbItems.map((r) => [r.key, r.content]));

  return {
    baseInformation: map.get('base-information') ?? null,
    po: project?.owner_name ?? null,
    techStack: project?.tech_stack ?? null,
    serviceUrl: project?.service_url ?? null,
    repo: project?.repo ?? null,
    slackChannel: project?.slack_channel ?? null,
    bm: project?.bm ?? null,
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
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

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
