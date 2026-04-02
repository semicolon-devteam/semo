'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Milestone, MilestoneMetadata } from '@/types';

const PROJECT_COLORS = [
  '#F9A8A8', // pink
  '#A8E6CF', // mint
  '#FFE0A3', // yellow
  '#A8D8B9', // green
  '#A8C8F0', // blue
  '#D4A8F0', // purple
  '#F0C8A8', // peach
  '#A8F0E6', // teal
  '#F0A8D4', // rose
  '#C8D4A8', // olive
  '#E6D4A8', // sand
  '#A8C8C8', // slate
];

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export interface ProjectGroup {
  project: string;
  color: string;
  milestones: Milestone[];
}

export interface RoadmapData {
  projects: ProjectGroup[];
  timelineStart: Date;
  timelineEnd: Date;
  months: Date[];
  loading: boolean;
  error: string | null;
}

/**
 * content 텍스트에서 마일스톤 메타데이터를 파싱한다.
 * metadata가 비어있는 엔트리를 enrichment하기 위해 사용.
 */
function parseContentMetadata(content: string, domain: string): Partial<MilestoneMetadata> {
  const result: Partial<MilestoneMetadata> = {};

  // title: 첫 번째 # 헤딩
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) result.title = titleMatch[1].trim();

  // 기간: "기간: YYYY-MM-DD ~ YYYY-MM-DD"
  const rangeMatch = content.match(/기간\s*[:：]\s*(\d{4}-\d{2}-\d{2})\s*[~～]\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    result.start_date = rangeMatch[1];
    result.end_date = rangeMatch[2];
  }

  // 기한: "기한: YYYY-MM-DD" (end_date만)
  if (!result.end_date) {
    const deadlineMatch = content.match(/기한\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
    if (deadlineMatch) result.end_date = deadlineMatch[1];
  }

  // 상태: "상태: ..."
  const statusMatch = content.match(/상태\s*[:：]\s*(.+)$/m);
  if (statusMatch) {
    const raw = statusMatch[1].trim().toLowerCase();
    if (raw.includes('progress') || raw.includes('진행')) result.status = 'in-progress';
    else if (raw.includes('done') || raw.includes('complete') || raw.includes('완료')) result.status = 'completed';
    else result.status = 'planned';
  }

  // project: domain을 사용
  result.project = domain;

  return result;
}

interface RawKBItem {
  kb_id: string;
  domain?: string;
  key?: string;
  sub_key?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  updated_at?: string;
}

function enrichMetadata(item: RawKBItem): RawKBItem {
  const m = item.metadata;
  const isEmpty = !m || Object.keys(m).length === 0;
  if (!isEmpty && m.project && m.title && m.start_date && m.end_date) return item;

  const parsed = parseContentMetadata(item.content || '', item.domain || '');
  const merged = { ...parsed, ...(isEmpty ? {} : m) };

  // start_date fallback: end_date - 30일
  if (!merged.start_date && merged.end_date) {
    const end = new Date(merged.end_date);
    end.setDate(end.getDate() - 30);
    merged.start_date = end.toISOString().slice(0, 10);
  }

  // title fallback: sub_key 부분
  if (!merged.title) {
    const keyParts = (item.key || '').split('/');
    merged.title = keyParts.length > 1 ? keyParts.slice(1).join('/') : keyParts[0];
  }

  return { ...item, metadata: merged };
}

function isValidMilestone(item: RawKBItem): item is RawKBItem & { key: string; content: string; metadata: MilestoneMetadata; updated_at: string } {
  const m = item?.metadata;
  return !!m && typeof m.project === 'string' && typeof m.title === 'string'
    && typeof m.start_date === 'string' && typeof m.end_date === 'string';
}

export function useRoadmapData(statusFilter?: string): RoadmapData {
  const [rawItems, setRawItems] = useState<RawKBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/kb?key=milestone')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setRawItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return useMemo(() => {
    if (loading || error) {
      return { projects: [], timelineStart: new Date(), timelineEnd: new Date(), months: [], loading, error };
    }

    // Enrich metadata from content, then validate
    const enriched = rawItems.map(enrichMetadata);
    let milestones: Milestone[] = enriched
      .filter(isValidMilestone)
      .map(item => ({
        kb_id: item.kb_id,
        key: item.key,
        content: item.content,
        metadata: {
          ...item.metadata,
          status: item.metadata.status || 'planned',
        },
        updated_at: item.updated_at,
      }));

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      milestones = milestones.filter(m => m.metadata.status === statusFilter);
    }

    if (milestones.length === 0) {
      return { projects: [], timelineStart: new Date(), timelineEnd: new Date(), months: [], loading, error };
    }

    // Compute timeline bounds
    const allDates = milestones.flatMap(m => [new Date(m.metadata.start_date), new Date(m.metadata.end_date)]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const timelineStart = addMonths(startOfMonth(minDate), -1);
    const timelineEnd = addMonths(startOfMonth(maxDate), 2);

    // Generate month markers
    const months: Date[] = [];
    let cursor = new Date(timelineStart);
    while (cursor < timelineEnd) {
      months.push(new Date(cursor));
      cursor = addMonths(cursor, 1);
    }

    // Group by project, sort alphabetically
    const projectMap = new Map<string, Milestone[]>();
    for (const m of milestones) {
      const p = m.metadata.project;
      if (!projectMap.has(p)) projectMap.set(p, []);
      projectMap.get(p)!.push(m);
    }

    const sortedProjects = Array.from(projectMap.keys()).sort();
    const projects: ProjectGroup[] = sortedProjects.map((project, i) => ({
      project,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      milestones: projectMap.get(project)!.sort((a, b) =>
        (a.metadata.order ?? 0) - (b.metadata.order ?? 0)
        || a.metadata.start_date.localeCompare(b.metadata.start_date)
      ),
    }));

    return { projects, timelineStart, timelineEnd, months, loading, error };
  }, [rawItems, loading, error, statusFilter]);
}
