import { query } from '../db';
import type { ActionItem } from '@/types';

export interface ActionItemFilters {
  owner_domain?: string;
  target_domain?: string;
  status?: string;
  assignee?: string;
}

export async function listActionItems(filters: ActionItemFilters = {}): Promise<ActionItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.owner_domain) {
    conditions.push(`ai.owner_domain = $${idx++}`);
    params.push(filters.owner_domain);
  }
  if (filters.target_domain) {
    conditions.push(`ai.target_domain = $${idx++}`);
    params.push(filters.target_domain);
  }
  if (filters.status) {
    conditions.push(`ai.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.assignee) {
    conditions.push(`LOWER(ai.assignee) = LOWER($${idx++})`);
    params.push(filters.assignee);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query<ActionItem>(
    `SELECT ai.*,
            COALESCE(nk.content, INITCAP(o_owner.domain)) AS owner_label,
            o_owner.entity_type AS owner_entity_type,
            COALESCE(
              kb_pn.metadata->>'project_name',
              NULLIF(BTRIM(SPLIT_PART(SPLIT_PART(o_target.description, E'\n', 1), ' — ', 1)), ''),
              ai.target_domain
            ) AS target_label
     FROM semo.action_items ai
     JOIN semo.ontology o_owner ON ai.owner_domain = o_owner.domain
     LEFT JOIN semo.knowledge_base nk ON nk.domain = ai.owner_domain AND nk.key = 'nickname'
     LEFT JOIN semo.ontology o_target ON ai.target_domain = o_target.domain
     LEFT JOIN semo.knowledge_base kb_pn ON kb_pn.domain = ai.target_domain AND kb_pn.key = 'pipeline' AND kb_pn.sub_key = 'config'
     ${where}
     ORDER BY CASE ai.status WHEN 'open' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
              ai.sort_order, ai.created_at DESC`,
    params,
  );
  return res.rows;
}

export async function createActionItem(data: {
  owner_domain: string;
  target_domain?: string | null;
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
}): Promise<ActionItem> {
  const res = await query<ActionItem>(
    `INSERT INTO semo.action_items
       (owner_domain, target_domain, iteration_id, description, assignee, deadline, status, priority, category, source, related_url, sort_order, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      data.owner_domain,
      data.target_domain ?? null,
      data.iteration_id ?? null,
      data.description,
      data.assignee ?? null,
      data.deadline ?? null,
      data.status ?? 'open',
      data.priority ?? 'normal',
      data.category ?? null,
      data.source ?? 'manual',
      data.related_url ?? null,
      data.sort_order ?? 0,
      JSON.stringify(data.metadata ?? {}),
    ],
  );
  return res.rows[0];
}

export async function updateActionItem(
  itemId: string,
  data: Partial<
    Pick<
      ActionItem,
      | 'description'
      | 'assignee'
      | 'deadline'
      | 'status'
      | 'priority'
      | 'category'
      | 'related_url'
      | 'sort_order'
      | 'metadata'
    >
  >,
): Promise<ActionItem | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const ALLOWED_COLS = new Set([
    'description',
    'assignee',
    'deadline',
    'status',
    'priority',
    'category',
    'related_url',
    'sort_order',
    'metadata',
  ]);
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || !ALLOWED_COLS.has(key)) continue;
    if (key === 'metadata') {
      sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
      params.push(JSON.stringify(val));
    } else {
      sets.push(`${key} = $${idx++}`);
      params.push(val);
    }
  }
  if (data.status === 'completed') {
    sets.push(`completed_at = NOW()`);
  } else if (data.status === 'open') {
    sets.push(`completed_at = NULL`);
  }

  if (sets.length === 0) return null;
  params.push(itemId);
  const res = await query<ActionItem>(
    `UPDATE semo.action_items SET ${sets.join(', ')} WHERE action_item_id = $${idx} RETURNING *`,
    params,
  );
  return res.rows[0] ?? null;
}

export async function deleteActionItem(itemId: string): Promise<boolean> {
  const res = await query('DELETE FROM semo.action_items WHERE action_item_id = $1', [itemId]);
  return (res.rowCount ?? 0) > 0;
}
