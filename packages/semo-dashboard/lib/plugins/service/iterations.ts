/**
 * Iterations — KB-backed (Phase 1 migration)
 * 기존 service_iterations 테이블 → KB iteration/* 키로 전환
 */

import { randomUUID } from 'crypto';
import {
  upsertItem,
  updateMetadata,
  listByKeyPrefix,
  deleteItemByKey,
  getItem,
} from '../../core/kb';
import { getProject } from './service';
import type { ServiceIteration, IterationStatus } from '@/types';

async function resolveDomain(serviceId: string): Promise<string> {
  const project = await getProject(serviceId);
  if (!project?.service_domain) {
    throw new Error(`서비스 ${serviceId}의 도메인을 찾을 수 없습니다.`);
  }
  return project.service_domain;
}

function kbToIteration(item: {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  updated_at?: string;
}): ServiceIteration {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    iteration_id: (m.iteration_id as string) ?? '',
    service_id: (m.service_id as string) ?? '',
    title: (m.title as string) ?? '',
    goal: (item.content as string) || null,
    status: ((m.status as string) ?? 'planned') as IterationStatus,
    started_at: (m.started_at as string) ?? null,
    completed_at: (m.completed_at as string) ?? null,
    retrospective: (m.retrospective as string) ?? null,
    created_at: (m.created_at as string) ?? '',
    updated_at: (item.updated_at as string) ?? '',
  };
}

export async function listIterations(
  projectId: string,
  status?: string,
): Promise<ServiceIteration[]> {
  const domain = await resolveDomain(projectId);
  const where = status ? { status } : undefined;
  const items = await listByKeyPrefix(domain, 'iteration', '', { where });
  const iterations = items.map(kbToIteration);
  // Sort: active first, then planned, then completed
  const statusOrder: Record<string, number> = { active: 0, planned: 1, completed: 2 };
  return iterations.sort((a, b) => (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2));
}

export async function getIteration(
  projectId: string,
  iterationId: string,
): Promise<ServiceIteration | null> {
  const domain = await resolveDomain(projectId);
  const item = await getItem(domain, `iteration/${iterationId}`);
  if (!item) return null;
  return kbToIteration(item);
}

export async function createIteration(data: {
  service_id: string;
  title: string;
  goal?: string;
  status?: string;
  started_at?: string;
}): Promise<ServiceIteration> {
  const domain = await resolveDomain(data.service_id);
  const iterationId = randomUUID();
  const now = new Date().toISOString();

  const item = await upsertItem(
    domain,
    `iteration/${iterationId}`,
    data.goal ?? '',
    'pm-pipeline',
    {
      iteration_id: iterationId,
      service_id: data.service_id,
      title: data.title,
      status: data.status ?? 'planned',
      started_at: data.started_at ?? null,
      completed_at: null,
      retrospective: null,
      created_at: now,
    },
  );

  return kbToIteration(item);
}

export async function updateIteration(
  projectId: string,
  iterationId: string,
  data: Partial<
    Pick<
      ServiceIteration,
      'title' | 'goal' | 'status' | 'started_at' | 'completed_at' | 'retrospective'
    >
  >,
): Promise<ServiceIteration | null> {
  const domain = await resolveDomain(projectId);
  const key = `iteration/${iterationId}`;

  // goal은 content 필드 → upsertItem 필요, 나머지는 metadata
  if (data.goal !== undefined) {
    const existing = await getItem(domain, key);
    if (!existing) return null;
    const metaPatch: Record<string, unknown> = {};
    if (data.title !== undefined) metaPatch.title = data.title;
    if (data.status !== undefined) metaPatch.status = data.status;
    if (data.started_at !== undefined) metaPatch.started_at = data.started_at;
    if (data.completed_at !== undefined) metaPatch.completed_at = data.completed_at;
    if (data.retrospective !== undefined) metaPatch.retrospective = data.retrospective;

    const item = await upsertItem(domain, key, data.goal ?? '', 'pm-pipeline', metaPatch);
    return kbToIteration(item);
  }

  // metadata만 업데이트 (임베딩 비용 없음)
  const metaPatch: Record<string, unknown> = {};
  if (data.title !== undefined) metaPatch.title = data.title;
  if (data.status !== undefined) metaPatch.status = data.status;
  if (data.started_at !== undefined) metaPatch.started_at = data.started_at;
  if (data.completed_at !== undefined) metaPatch.completed_at = data.completed_at;
  if (data.retrospective !== undefined) metaPatch.retrospective = data.retrospective;

  if (Object.keys(metaPatch).length === 0) return null;
  const item = await updateMetadata(domain, key, metaPatch);
  if (!item) return null;
  return kbToIteration(item);
}

export async function activateIteration(
  projectId: string,
  iterationId: string,
): Promise<ServiceIteration | null> {
  return updateIteration(projectId, iterationId, {
    status: 'active',
    started_at: new Date().toISOString(),
  });
}

export async function completeIteration(
  projectId: string,
  iterationId: string,
  retrospective?: string,
): Promise<ServiceIteration | null> {
  return updateIteration(projectId, iterationId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    ...(retrospective ? { retrospective } : {}),
  });
}

export async function deleteIteration(projectId: string, iterationId: string): Promise<boolean> {
  const domain = await resolveDomain(projectId);
  return deleteItemByKey(domain, `iteration/${iterationId}`);
}
