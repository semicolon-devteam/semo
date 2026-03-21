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

function isValidMilestone(item: any): item is { kb_id: string; key: string; content: string; metadata: MilestoneMetadata; updated_at: string } {
  const m = item?.metadata;
  return m && typeof m.project === 'string' && typeof m.title === 'string'
    && typeof m.start_date === 'string' && typeof m.end_date === 'string';
}

export function useRoadmapData(statusFilter?: string): RoadmapData {
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/kb?domain=milestone')
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

    // Parse and validate
    let milestones: Milestone[] = rawItems
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
