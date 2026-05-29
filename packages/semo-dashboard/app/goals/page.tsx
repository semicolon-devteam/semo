'use client';

import { useState, useEffect } from 'react';
import { PageBody, PageHeader, Card } from '@/components/ui/semo';

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

type SectionKey = 'milestones' | 'decisions' | 'actionItems' | 'projects';
const SECTIONS: { key: SectionKey; label: string; tint: string }[] = [
  { key: 'milestones', label: '마일스톤', tint: 'var(--semo-primary)' },
  { key: 'decisions', label: '결정', tint: 'var(--semo-ai)' },
  { key: 'actionItems', label: '액션', tint: 'var(--semo-success)' },
  { key: 'projects', label: '프로젝트', tint: 'var(--semo-warning)' },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<ServiceGoals[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/goals')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list: ServiceGoals[] = Array.isArray(data) ? data : [];
        setGoals(list);
        if (list[0]) setOpen(new Set([list[0].domain]));
      })
      .catch(() => setGoals([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const totalItems = goals.reduce(
    (sum, g) =>
      sum + g.milestones.length + g.decisions.length + g.actionItems.length + g.projects.length,
    0,
  );

  return (
    <PageBody>
      <PageHeader title="목표 정렬" sub={`${goals.length}개 서비스 · 총 ${totalItems}개 항목`} />

      {loading ? (
        <div
          style={{ display: 'grid', placeItems: 'center', padding: 64, color: 'var(--semo-fg-3)' }}
        >
          불러오는 중…
        </div>
      ) : goals.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48, color: 'var(--semo-fg-3)' }}>
          KB에 목표 데이터가 없습니다.
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: 14,
            alignItems: 'start',
          }}
        >
          {goals.map((g) => {
            const isOpen = open.has(g.domain);
            return (
              <Card key={g.domain} padding={0} style={{ overflow: 'hidden' }}>
                <button
                  onClick={() => toggle(g.domain)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 18,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--r-10)',
                      background: 'var(--semo-primary-08)',
                      color: 'var(--semo-primary)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {g.domain[0]?.toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--semo-fg-1)' }}>
                      {g.domain}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--semo-fg-3)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {g.description}
                    </div>
                  </div>
                  <span style={{ color: 'var(--semo-fg-3)', fontSize: 16 }}>
                    {isOpen ? '▾' : '▸'}
                  </span>
                </button>

                <div style={{ display: 'flex', gap: 8, padding: '0 18px 16px', flexWrap: 'wrap' }}>
                  {SECTIONS.map((s) => (
                    <span
                      key={s.key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 'var(--r-full)',
                        fontSize: 12,
                        fontWeight: 600,
                        background: 'var(--semo-surface-2)',
                        border: '1px solid var(--semo-line)',
                        color: 'var(--semo-fg-2)',
                      }}
                    >
                      <span
                        style={{ width: 7, height: 7, borderRadius: '50%', background: s.tint }}
                      />
                      {s.label}{' '}
                      <span
                        style={{ color: 'var(--semo-fg-3)', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {g[s.key].length}
                      </span>
                    </span>
                  ))}
                </div>

                {isOpen && (
                  <div
                    style={{
                      borderTop: '1px solid var(--semo-line-soft)',
                      padding: 18,
                      display: 'grid',
                      gap: 16,
                    }}
                  >
                    {SECTIONS.filter((s) => g[s.key].length > 0).map((s) => (
                      <div key={s.key}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}
                        >
                          <span
                            style={{ width: 8, height: 8, borderRadius: '50%', background: s.tint }}
                          />
                          <span
                            style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--semo-fg-2)' }}
                          >
                            {s.label}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gap: 4 }}>
                          {g[s.key].map((it, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '7px 10px',
                                background: 'var(--semo-surface-2)',
                                borderRadius: 'var(--r-8)',
                              }}
                            >
                              <span style={{ flex: 1, fontSize: 13.5, color: 'var(--semo-fg-1)' }}>
                                {it.sub_key || it.key}
                              </span>
                              {it.updated_at && (
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: 'var(--semo-fg-muted)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {fmtDate(it.updated_at)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageBody>
  );
}
