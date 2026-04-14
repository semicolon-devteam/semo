import { query } from '../../db';
import type { ServiceIteration } from '@/types';

export async function listIterations(
  projectId: string,
  status?: string,
): Promise<ServiceIteration[]> {
  if (status) {
    const res = await query<ServiceIteration>(
      `SELECT * FROM semo.service_iterations
       WHERE service_id = $1 AND status = $2
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, created_at DESC`,
      [projectId, status],
    );
    return res.rows;
  }
  const res = await query<ServiceIteration>(
    `SELECT * FROM semo.service_iterations
     WHERE service_id = $1
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, created_at DESC`,
    [projectId],
  );
  return res.rows;
}

export async function getIteration(iterationId: string): Promise<ServiceIteration | null> {
  const res = await query<ServiceIteration>(
    'SELECT * FROM semo.service_iterations WHERE iteration_id = $1',
    [iterationId],
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
    ],
  );
  return res.rows[0];
}

export async function updateIteration(
  iterationId: string,
  data: Partial<
    Pick<
      ServiceIteration,
      'title' | 'goal' | 'status' | 'started_at' | 'completed_at' | 'retrospective'
    >
  >,
): Promise<ServiceIteration | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.title !== undefined) {
    sets.push(`title = $${idx++}`);
    params.push(data.title);
  }
  if (data.goal !== undefined) {
    sets.push(`goal = $${idx++}`);
    params.push(data.goal);
  }
  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(data.status);
  }
  if (data.started_at !== undefined) {
    sets.push(`started_at = $${idx++}`);
    params.push(data.started_at);
  }
  if (data.completed_at !== undefined) {
    sets.push(`completed_at = $${idx++}`);
    params.push(data.completed_at);
  }
  if (data.retrospective !== undefined) {
    sets.push(`retrospective = $${idx++}`);
    params.push(data.retrospective);
  }

  if (sets.length === 0) return null;
  params.push(iterationId);
  const res = await query<ServiceIteration>(
    `UPDATE semo.service_iterations SET ${sets.join(', ')} WHERE iteration_id = $${idx} RETURNING *`,
    params,
  );
  return res.rows[0] ?? null;
}

export async function activateIteration(iterationId: string): Promise<ServiceIteration | null> {
  const res = await query<ServiceIteration>(
    `UPDATE semo.service_iterations SET status = 'active', started_at = NOW() WHERE iteration_id = $1 RETURNING *`,
    [iterationId],
  );
  return res.rows[0] ?? null;
}

export async function completeIteration(
  iterationId: string,
  retrospective?: string,
): Promise<ServiceIteration | null> {
  const res = await query<ServiceIteration>(
    `UPDATE semo.service_iterations SET status = 'completed', completed_at = NOW(), retrospective = COALESCE($2, retrospective)
     WHERE iteration_id = $1 RETURNING *`,
    [iterationId, retrospective ?? null],
  );
  return res.rows[0] ?? null;
}

export async function deleteIteration(iterationId: string): Promise<boolean> {
  const res = await query('DELETE FROM semo.service_iterations WHERE iteration_id = $1', [
    iterationId,
  ]);
  return (res.rowCount ?? 0) > 0;
}
