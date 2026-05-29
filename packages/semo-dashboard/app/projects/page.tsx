'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/provider';
import { LeaderboardTrack } from '@/components/service/LeaderboardTrack';
import type { SubPhaseProgress } from '@/components/service/LeaderboardTrack';
import type { ServiceProject, ServiceLifecycle, ServiceType } from '@/types';
import {
  PageBody,
  PageHeader,
  Card,
  Badge,
  Stat,
  Icon,
  avatarTint,
  btnStyle,
} from '@/components/ui/semo';
import type { SemoTone } from '@/components/ui/semo';

type FilterTab = 'all' | ServiceLifecycle;
type PrimaryView = 'general' | 'incubator' | 'platforms';

interface ProjectCost {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

/* ── 라이프사이클 / 타입 메타 (handoff ScreenServices 매핑) ───────────── */
const LIFECYCLE: Record<ServiceLifecycle, { label: string; tone: SemoTone }> = {
  build: { label: '구축', tone: 'primary' },
  ops: { label: '운영', tone: 'success' },
  sunset: { label: '종료', tone: 'neutral' },
};
const SVC_TYPE: Partial<Record<ServiceType, { label: string; color: string; bg: string }>> = {
  external: { label: '외부', color: 'var(--semo-warning)', bg: 'var(--semo-warning-bg)' },
  platform: { label: '플랫폼', color: 'var(--semo-ai)', bg: 'var(--semo-ai-08)' },
  incubator: { label: '인큐베이터', color: 'var(--semo-ai)', bg: 'var(--semo-ai-08)' },
};

/* 9-phase 파이프라인 라벨 (current_phase 1..9) */
const PHASE_LABELS = ['온보딩', '기획', '리서치', '정의', '디자인', '검토', '구축', '검증', '출시'];

/* 숫자 포맷 — 토큰 합계 → 38.2M 형태 */
function fmtTokens(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtCost(n: number): string {
  return n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2);
}

/* ── SegTab (handoff components.jsx 이식) ────────────────────────────── */
function SegTab<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 3,
        background: 'var(--semo-surface-3)',
        borderRadius: 'var(--r-10)',
        border: '1px solid var(--semo-line)',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--r-8)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: sel ? 'var(--semo-surface)' : 'transparent',
              color: sel ? 'var(--semo-fg-1)' : 'var(--semo-fg-3)',
              boxShadow: sel ? 'var(--semo-shadow-1)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── EmptyState (handoff internal-shell.jsx 이식) ────────────────────── */
function EmptyState({
  icon = 'rocket',
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: 12,
        padding: '64px 24px',
        textAlign: 'center',
        border: '1px dashed var(--semo-line-strong)',
        borderRadius: 'var(--r-16)',
        background: 'var(--semo-surface-2)',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--r-14)',
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon name={icon} size={24} color="var(--semo-fg-faint)" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--semo-fg-2)' }}>{title}</div>
      {hint && (
        <div style={{ fontSize: 13, color: 'var(--semo-fg-muted)', maxWidth: 320 }}>{hint}</div>
      )}
    </div>
  );
}

/* ── PhaseTrack — 러너가 달리는 리더보드 트랙 (handoff 이식, 9-phase) ──── */
function PhaseTrack({ phase, progress }: { phase: number; progress?: SubPhaseProgress[] }) {
  const total = PHASE_LABELS.length; // 9
  // current_phase 는 1..9 → 0-index 진행도
  const clamped = Math.max(0, Math.min(total - 1, phase - 1));
  // sub-phase 정밀도(LeaderboardTrack 과 동일 규칙): 현재 phase 의 승인율로 비율 보정
  const current = progress?.find((p) => p.phase === phase);
  const subRatio = current && current.total > 0 ? current.approved / current.total : 0;
  const fillPct = progress?.length
    ? Math.round(((clamped + subRatio) / (total - 1)) * 100)
    : Math.round((clamped / (total - 1)) * 100);
  const runnerPct = ((clamped + 0.5) / total) * 100;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          position: 'relative',
          height: 10,
          background: 'var(--semo-surface-3)',
          borderRadius: 'var(--r-full)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fillPct}%`,
            background: 'linear-gradient(90deg, var(--semo-primary), var(--semo-ai))',
            borderRadius: 'var(--r-full)',
          }}
        />
        {PHASE_LABELS.map((_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: `${(i / (total - 1)) * 100}%`,
              transform: 'translate(-50%,-50%)',
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: i <= clamped ? '#fff' : 'var(--semo-fg-faint)',
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${runnerPct}%`,
            transform: 'translate(-50%,-50%)',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--semo-surface)',
            border: '2px solid var(--semo-ai)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: 'var(--semo-shadow-2)',
            fontSize: 11,
          }}
        >
          🏃
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        {PHASE_LABELS.map((p, i) => (
          <span
            key={p}
            style={{
              fontSize: 10.5,
              fontWeight: i === clamped ? 700 : 500,
              color:
                i === clamped
                  ? 'var(--semo-ai)'
                  : i < clamped
                    ? 'var(--semo-fg-3)'
                    : 'var(--semo-fg-faint)',
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── ServiceCard — handoff ScreenServices 카드 이식 (실데이터) ───────── */
function ServiceCard({
  project,
  cost,
  progress,
}: {
  project: ServiceProject;
  cost?: ProjectCost;
  progress?: SubPhaseProgress[];
}) {
  const lc = LIFECYCLE[project.lifecycle] ?? LIFECYCLE.build;
  const tp = SVC_TYPE[project.service_type];
  const desc =
    project.service_domain || project.tech_stack || project.bm || `오너 · ${project.owner_name}`;
  const tokenTotal = (cost?.total_input_tokens ?? 0) + (cost?.total_output_tokens ?? 0);

  return (
    <Link href={`/projects/${project.service_id}`} style={{ textDecoration: 'none' }}>
      <Card padding={20} style={{ cursor: 'pointer', display: 'grid', gap: 16, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--r-12)',
              background: avatarTint(project.service_id),
              opacity: 0.92,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              fontWeight: 800,
              fontSize: 16,
              color: 'var(--semo-fg-1)',
            }}
          >
            {project.project_name[0]}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--semo-fg-1)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {project.project_name}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--semo-fg-3)',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {desc}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              alignItems: 'flex-end',
              flexShrink: 0,
            }}
          >
            <Badge tone={lc.tone}>{lc.label}</Badge>
            {tp && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--r-full)',
                  background: tp.bg,
                  color: tp.color,
                }}
              >
                {tp.label}
              </span>
            )}
          </div>
        </div>

        {/* leaderboard track */}
        <PhaseTrack phase={project.current_phase} progress={progress} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            paddingTop: 4,
            borderTop: '1px solid var(--semo-line-soft)',
          }}
        >
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 10.5, color: 'var(--semo-fg-muted)', fontWeight: 600 }}>
              누적 비용
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--semo-fg-1)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ${fmtCost(cost?.total_cost_usd ?? 0)}
            </div>
          </div>
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 10.5, color: 'var(--semo-fg-muted)', fontWeight: 600 }}>
              토큰
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--semo-fg-1)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtTokens(tokenTotal)}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', paddingTop: 12 }}>
            <Icon name="chevron-right" size={18} color="var(--semo-fg-faint)" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* 2열 카드 그리드 래퍼 */
function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 14,
        alignItems: 'stretch',
      }}
    >
      {children}
    </div>
  );
}

export default function ServiceListPage() {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [costMap, setCostMap] = useState<Record<string, ProjectCost>>({});
  const [phaseProgress, setPhaseProgress] = useState<Record<string, SubPhaseProgress[]>>({});
  const { isAdmin, projectAccess, profile } = useAuth();

  const isTeamMember = profile?.onboarding_role === 'team-member';
  const isIncubatorPO = profile?.onboarding_role === 'incubator-participant';
  const showBothTabs = isAdmin || isTeamMember;

  // activeView 는 effect 동기화 대신 렌더 중 파생 — 인큐베이터 전용 유저는 기본 incubator,
  // 사용자가 탭을 누르면 override 가 우선한다. (setState-in-effect 회피)
  const [viewOverride, setViewOverride] = useState<PrimaryView | null>(null);
  const activeView: PrimaryView =
    viewOverride ?? (isIncubatorPO && !showBothTabs ? 'incubator' : 'general');
  const setActiveView = setViewOverride;

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        if (isAdmin) {
          setProjects(all);
        } else if (isIncubatorPO) {
          // 인큐베이터 유저: 리더보드용 전체 인큐베이터 프로젝트 + 본인 접근 프로젝트
          setProjects(
            all.filter(
              (p: ServiceProject) =>
                p.service_type === 'incubator' || projectAccess.includes(p.service_id),
            ),
          );
        } else {
          setProjects(all.filter((p: ServiceProject) => projectAccess.includes(p.service_id)));
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));

    // 프로젝트별 비용 데이터 (리더보드용)
    fetch('/api/cost?groupBy=project')
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((data) => {
        const map: Record<string, ProjectCost> = {};
        for (const row of data.projects || []) {
          map[row.service_id] = {
            total_cost_usd: parseFloat(row.total_cost_usd) || 0,
            total_input_tokens: parseInt(row.total_input_tokens) || 0,
            total_output_tokens: parseInt(row.total_output_tokens) || 0,
          };
        }
        setCostMap(map);
      })
      .catch(() => {});

    // Sub-phase 정밀도 데이터 (리더보드용)
    fetch('/api/projects/phase-progress?lifecycle=build')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, SubPhaseProgress[]>) => setPhaseProgress(data))
      .catch(() => {});
  }, [isAdmin, isIncubatorPO, projectAccess]);

  // 1차 뷰 기반 필터링: service_type 컬럼 기반
  const incubatorProjects = projects.filter((p) => p.service_type === 'incubator');
  const platformProjects = projects.filter((p) => p.service_type === 'platform');
  const generalProjects = projects.filter(
    (p) => p.service_type === 'general' || p.service_type === 'external',
  );

  // 2차 필터 (일반 탭 내부)
  const filteredGeneral =
    filter === 'all' ? generalProjects : generalProjects.filter((p) => p.lifecycle === filter);

  // 운영 중 카운트 (요약 Stat)
  const opsCount = projects.filter((p) => p.lifecycle === 'ops').length;
  const buildCount = projects.filter((p) => p.lifecycle === 'build').length;

  const primaryTabs: { value: PrimaryView; label: string }[] = [
    { value: 'general', label: `일반 ${generalProjects.length}` },
    { value: 'incubator', label: `인큐베이터 ${incubatorProjects.length}` },
    { value: 'platforms', label: `플랫폼 ${platformProjects.length}` },
  ];

  const lifecycleTabs: { value: FilterTab; label: string }[] = [
    { value: 'all', label: `전체 ${generalProjects.length}` },
    { value: 'ops', label: `운영 ${generalProjects.filter((p) => p.lifecycle === 'ops').length}` },
    {
      value: 'build',
      label: `구축 ${generalProjects.filter((p) => p.lifecycle === 'build').length}`,
    },
    {
      value: 'sunset',
      label: `종료 ${generalProjects.filter((p) => p.lifecycle === 'sunset').length}`,
    },
  ];

  // 플랫폼별 하위 서비스 매핑
  const childrenByPlatform: Record<string, ServiceProject[]> = {};
  for (const platform of platformProjects) {
    childrenByPlatform[platform.service_id] = projects.filter(
      (p) => p.parent_service_id === platform.service_id,
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="서비스"
        sub={`서비스 라이프사이클 관리 — ${projects.length}개 프로젝트`}
        action={
          (isAdmin || isTeamMember) && (
            <Link href="/projects/new" style={btnStyle('primary')}>
              <Icon name="rocket" size={15} color="#fff" />새 프로젝트
            </Link>
          )
        }
      />

      {/* 요약 Stat 행 (실데이터 집계) */}
      {!loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Stat
            label="전체 서비스"
            value={projects.length}
            tone="primary"
            hint={`${generalProjects.length} 일반`}
          />
          <Stat label="운영 중" value={opsCount} tone="success" hint="live" />
          <Stat label="구축 중" value={buildCount} tone="ai" hint="build" />
          <Stat
            label="플랫폼"
            value={platformProjects.length}
            tone="neutral"
            hint={`${incubatorProjects.length} 인큐베이터`}
          />
        </div>
      )}

      {/* 필터 행: 1차 트랙(SegTab) + 2차 라이프사이클(SegTab) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        {showBothTabs ? (
          <SegTab value={activeView} onChange={setActiveView} options={primaryTabs} />
        ) : (
          <span />
        )}
        {activeView === 'general' && (
          <SegTab value={filter} onChange={setFilter} options={lifecycleTabs} />
        )}
      </div>

      {loading ? (
        <div
          style={{ display: 'grid', placeItems: 'center', padding: 64, color: 'var(--semo-fg-3)' }}
        >
          불러오는 중…
        </div>
      ) : activeView === 'incubator' ? (
        /* 인큐베이터 탭: 리더보드 + 프로젝트 카드 */
        <div style={{ display: 'grid', gap: 32 }}>
          <LeaderboardTrack
            projects={incubatorProjects}
            costMap={costMap}
            phaseProgress={phaseProgress}
          />

          {incubatorProjects.length > 0 && (
            <div>
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: 'var(--semo-fg-1)',
                  letterSpacing: '-0.01em',
                  margin: '0 0 14px',
                }}
              >
                프로젝트 목록
              </h2>
              <CardGrid>
                {incubatorProjects.map((project) => (
                  <ServiceCard
                    key={project.service_id}
                    project={project}
                    cost={costMap[project.service_id]}
                    progress={phaseProgress[project.service_id]}
                  />
                ))}
              </CardGrid>
            </div>
          )}
        </div>
      ) : activeView === 'platforms' ? (
        /* 플랫폼 탭: 플랫폼별 그룹 카드 */
        platformProjects.length === 0 ? (
          <EmptyState
            icon="rocket"
            title="등록된 플랫폼이 없어요"
            hint="플랫폼 타입 서비스를 추가하면 여기에 표시됩니다."
          />
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            {platformProjects.map((platform) => {
              const children = childrenByPlatform[platform.service_id] ?? [];
              const lc = LIFECYCLE[platform.lifecycle] ?? LIFECYCLE.build;
              return (
                <Card key={platform.service_id} padding={0} style={{ overflow: 'hidden' }}>
                  {/* 플랫폼 헤더 */}
                  <Link
                    href={`/projects/${platform.service_id}`}
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      padding: 20,
                      borderBottom: '1px solid var(--semo-line-soft)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <span
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--r-12)',
                            background: avatarTint(platform.service_id),
                            opacity: 0.92,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            fontWeight: 800,
                            fontSize: 16,
                            color: 'var(--semo-fg-1)',
                          }}
                        >
                          {platform.project_name[0]}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{ fontSize: 17, fontWeight: 700, color: 'var(--semo-fg-1)' }}
                            >
                              {platform.project_name}
                            </span>
                            <Badge tone={lc.tone}>{lc.label}</Badge>
                            <Badge tone="ai">플랫폼</Badge>
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--semo-fg-3)', marginTop: 2 }}>
                            오너 · {platform.owner_name}
                            {platform.bm && <span> · BM {platform.bm}</span>}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{ fontSize: 13, color: 'var(--semo-fg-muted)', fontWeight: 600 }}
                      >
                        {children.length}개 서비스
                      </span>
                    </div>
                  </Link>

                  {/* 하위 서비스 그리드 */}
                  {children.length > 0 && (
                    <div style={{ padding: 16 }}>
                      <CardGrid>
                        {children.map((child) => (
                          <ServiceCard
                            key={child.service_id}
                            project={child}
                            cost={costMap[child.service_id]}
                            progress={phaseProgress[child.service_id]}
                          />
                        ))}
                      </CardGrid>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : filteredGeneral.length === 0 ? (
        /* 일반 탭: 빈 상태 */
        <EmptyState
          icon="rocket"
          title="해당하는 서비스가 없어요"
          hint="필터를 바꾸거나 새 프로젝트를 추가하세요."
        />
      ) : (
        /* 일반 탭: 카드 그리드 */
        <CardGrid>
          {filteredGeneral.map((project) => (
            <ServiceCard
              key={project.service_id}
              project={project}
              cost={costMap[project.service_id]}
              progress={phaseProgress[project.service_id]}
            />
          ))}
        </CardGrid>
      )}
    </PageBody>
  );
}
