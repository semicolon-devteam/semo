'use client';

import { useState, type CSSProperties } from 'react';
import type { Milestone } from '@/types';
import { useRoadmapData } from '@/components/dashboard/useRoadmapData';
import { PageBody, PageHeader, Card, Stat, Badge, Icon, avatarTint } from '@/components/ui/semo';

/* ════════════════════════════════════════════════════════════════════
 * /team — 로드맵 (ScreenRoadmap 이식: 가로 시간축 간트)
 *
 * 핸드오프 internal-screens-a.jsx 의 ScreenRoadmap 비주얼을 그대로 옮기되,
 * mock MILESTONES/SERVICES 대신 실데이터 훅(useRoadmapData → /api/kb?key=milestone)이
 * 주는 ProjectGroup[] / Milestone[] / 실 month 축으로 구동한다.
 * ──────────────────────────────────────────────────────────────────── */

/* 실 status('planned'|'in-progress'|'completed') → 핸드오프 색/라벨 매핑 */
const STATUS_META: Record<
  Milestone['metadata']['status'],
  { label: string; tone: 'success' | 'primary' | 'neutral'; dot: string }
> = {
  completed: { label: '완료', tone: 'success', dot: 'var(--semo-success)' },
  'in-progress': { label: '진행중', tone: 'primary', dot: 'var(--semo-primary)' },
  planned: { label: '예정', tone: 'neutral', dot: 'var(--semo-fg-faint)' },
};

const MONTH_LABELS = [
  '1월',
  '2월',
  '3월',
  '4월',
  '5월',
  '6월',
  '7월',
  '8월',
  '9월',
  '10월',
  '11월',
  '12월',
];

const MONTH_W = 144;
const LEFT_W = 176;
const ROW_H = 56;

const TODAY = new Date('2026-05-29T00:00:00');

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function fmtMonth(d: Date): string {
  const label = MONTH_LABELS[d.getMonth()];
  // 1월이거나 연도가 바뀌면 연도 표기
  return d.getMonth() === 0 ? `${d.getFullYear()}년 ${label}` : label;
}

export default function TeamRoadmapPage() {
  const [filter, setFilter] = useState<'all' | 'progress' | 'done'>('all');
  const [sel, setSel] = useState<{ milestone: Milestone; tint: string } | null>(null);

  const { projects, timelineStart, timelineEnd, months, loading, error } = useRoadmapData();

  // 핸드오프 visible(): 진행중 탭은 progress(+delayed) / 완료 탭은 done.
  // 실데이터엔 delayed 상태가 없으므로 in-progress / completed 로 매핑.
  const visible = (m: Milestone): boolean =>
    filter === 'all'
      ? true
      : filter === 'progress'
        ? m.metadata.status === 'in-progress'
        : m.metadata.status === 'completed';

  // 필터 적용 후 마일스톤이 남아있는 서비스 행만 노출 (핸드오프 services 필터와 동일)
  const rows = projects
    .map((g) => ({ ...g, bars: g.milestones.filter(visible) }))
    .filter((g) => g.bars.length > 0);

  const allMs = projects.flatMap((g) => g.milestones);
  const counts = {
    progress: allMs.filter((m) => m.metadata.status === 'in-progress').length,
    total: allMs.length,
    done: allMs.filter((m) => m.metadata.status === 'completed').length,
  };

  // 시간축: useRoadmapData 가 계산한 실 min/max 기반 timelineStart~End 일수 폭으로 환산.
  const totalDays = daysBetween(timelineStart, timelineEnd);
  const axisWidth = months.length * MONTH_W;
  const pxPerDay = totalDays > 0 ? axisWidth / totalDays : 0;

  const todayX = daysBetween(timelineStart, TODAY) * pxPerDay;
  const showToday = todayX >= 0 && todayX <= axisWidth;

  const selStart = sel ? new Date(sel.milestone.metadata.start_date) : null;
  const selEnd = sel ? new Date(sel.milestone.metadata.end_date) : null;

  return (
    <PageBody max={1280} style={{ paddingBottom: 40 }}>
      <PageHeader
        title="로드맵"
        sub="오늘 · 2026년 5월 29일"
        action={
          <SegTab
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: 'all', label: '전체' },
              { value: 'progress', label: '진행중' },
              { value: 'done', label: '완료' },
            ]}
          />
        }
      />

      {/* 요약 Stat 3-up */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Stat label="진행 중 마일스톤" value={counts.progress} tone="primary" />
        <Stat label="전체 마일스톤" value={counts.total} tone="neutral" />
        <Stat label="완료" value={counts.done} tone="success" />
      </div>

      {/* 타임라인 카드 */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              padding: 80,
              color: 'var(--semo-fg-3)',
            }}
          >
            로드맵 불러오는 중…
          </div>
        ) : error ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              padding: 80,
              color: 'var(--semo-danger)',
            }}
          >
            마일스톤 로드 실패: {error}
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              gap: 6,
              padding: 64,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, color: 'var(--semo-fg-3)', fontSize: 14 }}>
              마일스톤이 없습니다
            </p>
            <p style={{ margin: 0, color: 'var(--semo-fg-muted)', fontSize: 12.5 }}>
              서비스 도메인에 key=&quot;milestone&quot;로 마일스톤을 추가하세요.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
            <div style={{ minWidth: LEFT_W + axisWidth, position: 'relative' }}>
              {/* month 헤더 */}
              <div
                style={{
                  display: 'flex',
                  position: 'sticky',
                  top: 0,
                  zIndex: 3,
                  background: 'var(--semo-surface-2)',
                  borderBottom: '1px solid var(--semo-line)',
                }}
              >
                <div
                  style={{
                    width: LEFT_W,
                    flexShrink: 0,
                    padding: '12px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--semo-fg-3)',
                    borderRight: '1px solid var(--semo-line)',
                  }}
                >
                  서비스
                </div>
                {months.map((mo, i) => (
                  <div
                    key={i}
                    style={{
                      width: MONTH_W,
                      flexShrink: 0,
                      padding: '12px 0',
                      textAlign: 'center',
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: i === 0 ? 'var(--semo-fg-1)' : 'var(--semo-fg-3)',
                      borderRight: '1px solid var(--semo-line-soft)',
                    }}
                  >
                    {fmtMonth(mo)}
                  </div>
                ))}
              </div>

              {/* 본문 행 */}
              <div style={{ position: 'relative' }}>
                {/* 세로 month gridline */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    left: LEFT_W,
                    display: 'flex',
                    pointerEvents: 'none',
                  }}
                  aria-hidden
                >
                  {months.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: MONTH_W,
                        flexShrink: 0,
                        borderRight: '1px solid var(--semo-line-soft)',
                      }}
                    />
                  ))}
                </div>

                {/* 오늘 라인 */}
                {showToday && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: LEFT_W + todayX,
                      width: 2,
                      background: 'var(--semo-primary)',
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--semo-primary)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 'var(--r-full)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      오늘
                    </div>
                  </div>
                )}

                {rows.map((g) => {
                  const tint = avatarTint(g.project);
                  return (
                    <div
                      key={g.project}
                      style={{
                        display: 'flex',
                        height: ROW_H,
                        borderBottom: '1px solid var(--semo-line-soft)',
                      }}
                    >
                      {/* 서비스 라벨 (sticky 좌측) */}
                      <div
                        style={{
                          width: LEFT_W,
                          flexShrink: 0,
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: 'var(--semo-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '0 16px',
                          borderRight: '1px solid var(--semo-line)',
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 3,
                            background: tint,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: 'var(--semo-fg-1)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {g.project}
                        </span>
                      </div>

                      {/* 바 컨테이너 */}
                      <div style={{ position: 'relative', flex: 1 }}>
                        {g.bars.map((m) => {
                          const start = new Date(m.metadata.start_date);
                          const end = new Date(m.metadata.end_date);
                          const left = daysBetween(timelineStart, start) * pxPerDay + 4;
                          const rawW = daysBetween(start, end) * pxPerDay - 8;
                          const width = Math.max(rawW, 36); // 최소 폭 보장
                          const sm = STATUS_META[m.metadata.status];
                          const done = m.metadata.status === 'completed';
                          const isSel = sel?.milestone.key === m.key;

                          return (
                            <button
                              key={m.key}
                              onClick={() => setSel({ milestone: m, tint })}
                              title={m.metadata.title}
                              style={{
                                position: 'absolute',
                                top: 11,
                                height: ROW_H - 22,
                                left,
                                width,
                                background: done ? 'var(--semo-surface-2)' : tint,
                                opacity: done ? 1 : m.metadata.status === 'planned' ? 0.7 : 0.92,
                                border: `1px solid ${done ? 'var(--semo-line)' : 'rgba(29,36,43,0.08)'}`,
                                borderRadius: 'var(--r-full)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '0 12px',
                                cursor: 'pointer',
                                boxShadow: isSel
                                  ? 'var(--semo-glow-primary)'
                                  : 'var(--semo-shadow-1)',
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: sm.dot,
                                  flexShrink: 0,
                                  animation:
                                    m.metadata.status === 'in-progress'
                                      ? 'semo-pulse 1.8s ease-in-out infinite'
                                      : 'none',
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: done ? 'var(--semo-fg-3)' : 'var(--semo-fg-1)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textDecoration: done ? 'line-through' : 'none',
                                }}
                              >
                                {m.metadata.title}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 마일스톤 상세 슬라이드 패널 (핸드오프 SlidePanel 이식) */}
      <SlidePanel open={!!sel} onClose={() => setSel(null)}>
        {sel && selStart && selEnd && (
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  color: 'var(--semo-fg-3)',
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 3, background: sel.tint }} />
                {sel.milestone.metadata.project}
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--semo-fg-1)',
                }}
              >
                {sel.milestone.metadata.title}
              </h2>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Badge tone={STATUS_META[sel.milestone.metadata.status].tone}>
                {sel.milestone.metadata.status === 'completed' && <Icon name="check" size={12} />}
                {STATUS_META[sel.milestone.metadata.status].label}
              </Badge>
            </div>

            <Field label="기간">
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {sel.milestone.metadata.start_date} → {sel.milestone.metadata.end_date}
              </span>
            </Field>

            <Field label="서비스">{sel.milestone.metadata.project}</Field>

            {sel.milestone.content && (
              <Field label="설명">
                <span style={{ whiteSpace: 'pre-wrap' }}>{sel.milestone.content}</span>
              </Field>
            )}

            <Field label="KB">
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--semo-fg-muted)' }}>
                {sel.milestone.key}
                {sel.milestone.updated_at ? ` · 수정 ${sel.milestone.updated_at.slice(0, 10)}` : ''}
              </span>
            </Field>
          </div>
        )}
      </SlidePanel>
    </PageBody>
  );
}

/* ── SegTab — 핸드오프 세그먼트 토글 (PageHeader 우측 액션) ──────────── */
function SegTab({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--semo-surface-2)',
        border: '1px solid var(--semo-line)',
        borderRadius: 'var(--r-10)',
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--r-8)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: active ? 'var(--semo-surface)' : 'transparent',
              color: active ? 'var(--semo-fg-1)' : 'var(--semo-fg-3)',
              boxShadow: active ? 'var(--semo-shadow-1)' : 'none',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Field — 상세 패널 라벨/값 (핸드오프 Field 이식) ─────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--semo-fg-muted)',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--semo-fg-2)', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/* ── SlidePanel — 우측 슬라이드 오버 (핸드오프 SlidePanel 이식) ──────── */
function SlidePanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    background: 'rgba(29,36,43,0.28)',
    opacity: open ? 1 : 0,
    pointerEvents: open ? 'auto' : 'none',
    transition: 'opacity 0.2s ease',
  };
  const panel: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(420px, 92vw)',
    zIndex: 61,
    background: 'var(--semo-surface)',
    borderLeft: '1px solid var(--semo-line)',
    boxShadow: 'var(--semo-shadow-1)',
    transform: open ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.24s cubic-bezier(0.4,0,0.2,1)',
    display: 'flex',
    flexDirection: 'column',
  };
  return (
    <>
      <div style={overlay} onClick={onClose} aria-hidden />
      <aside style={panel} role="dialog" aria-modal="true">
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '14px 16px 0',
          }}
        >
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 'var(--r-8)',
              border: '1px solid var(--semo-line)',
              background: 'var(--semo-surface-2)',
              color: 'var(--semo-fg-3)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '8px 24px 28px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </aside>
    </>
  );
}
