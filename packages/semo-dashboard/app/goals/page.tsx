'use client';

import { useState, useEffect } from 'react';

interface KBRow {
  key: string;
  sub_key: string;
  content: string;
  metadata?: Record<string, unknown>;
  updated_at: string;
}

interface ServiceGoals {
  domain: string;
  description: string;
  milestones: KBRow[];
  decisions: KBRow[];
  actionItems: KBRow[];
  projects: KBRow[];
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<ServiceGoals[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/goals')
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => setGoals(Array.isArray(data) ? data : []))
      .catch(() => setGoals([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const totalItems = goals.reduce(
    (sum, g) => sum + g.milestones.length + g.decisions.length + g.actionItems.length + g.projects.length, 0
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Goal Alignment
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Service goals, milestones, decisions, and action items — {goals.length} services, {totalItems} items
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          No goal data found in KB
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((svc) => {
            const svcKey = svc.domain;
            const isExpanded = expanded.has(svcKey);

            return (
              <div key={svcKey} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Service Header */}
                <button
                  onClick={() => toggle(svcKey)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {svc.domain}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xl">
                      {svc.description?.slice(0, 100)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-4">
                    {svc.projects.length > 0 && <Badge label="Projects" count={svc.projects.length} color="purple" />}
                    {svc.milestones.length > 0 && <Badge label="Milestones" count={svc.milestones.length} color="blue" />}
                    {svc.decisions.length > 0 && <Badge label="Decisions" count={svc.decisions.length} color="green" />}
                    {svc.actionItems.length > 0 && <Badge label="Actions" count={svc.actionItems.length} color="orange" />}
                    <span className="text-lg">{isExpanded ? '▾' : '▸'}</span>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-6 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-4">
                    {svc.projects.length > 0 && (
                      <Section title="Projects" color="purple" items={svc.projects} />
                    )}
                    {svc.milestones.length > 0 && (
                      <Section title="Milestones" color="blue" items={svc.milestones} />
                    )}
                    {svc.decisions.length > 0 && (
                      <Section title="Decisions" color="green" items={svc.decisions} />
                    )}
                    {svc.actionItems.length > 0 && (
                      <Section title="Action Items" color="orange" items={svc.actionItems} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {label} {count}
    </span>
  );
}

function Section({ title, color, items }: { title: string; color: string; items: KBRow[] }) {
  const dotColors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-gray-50 dark:bg-gray-700/30">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColors[color]}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {item.sub_key || item.key}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                {item.content?.slice(0, 200)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(item.updated_at).toLocaleDateString('ko-KR')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
