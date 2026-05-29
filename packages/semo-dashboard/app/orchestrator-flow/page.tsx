/**
 * Orchestrator Flow — Semi/Colony → routed_bot → outbox 의 trace 시각화.
 *
 * P1-C (2026-05-28): One Agent Experience 의 dashboard 측 첫 화면.
 * - hermes-orchestrator 가 만든 bot_commitments 를 최근 50건 표시.
 * - 미등록 사용자 도메인 (team-*) 최근 7일 카드.
 *
 * 데이터 소스:
 * - semo.bot_commitments (runtime_source = 'hermes-orchestrator')
 * - semo.knowledge_base (domain LIKE 'team-%' AND key='slack-id')
 *
 * 실시간성: SSR (force-dynamic) + 향후 SWR polling 또는 SSE 로 진화 가능 (P2-C).
 *
 * KB: semo decision/one-agent-experience-implementation-2026-05-27 의 P1-C
 */
import { query } from '@/lib/db';
import { LiveCommitmentBanner } from './LiveCommitmentBanner';
import { PageBody, PageHeader, Card, Section, Avatar, Badge, Icon } from '@/components/ui/semo';

const FLOW_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  active: {
    label: '진행',
    emoji: '⏳',
    color: 'var(--semo-primary)',
    bg: 'var(--semo-primary-08)',
  },
  done: { label: '완료', emoji: '✅', color: 'var(--semo-success)', bg: 'var(--semo-success-bg)' },
  failed: { label: '실패', emoji: '⚠️', color: 'var(--semo-danger)', bg: 'var(--semo-danger-bg)' },
};

export const dynamic = 'force-dynamic';

interface OrchCommitmentRow {
  id: string;
  bot_id: string;
  status: string;
  title: string;
  source_ref: string;
  pipeline_context: string | null;
  created_at: string;
  completed_at: string | null;
}

interface NewUserDomainRow {
  domain: string;
  nickname: string | null;
  role: string | null;
  it_fluency: string | null;
  created_at: string;
}

async function loadOrchestratorCommitments(): Promise<OrchCommitmentRow[]> {
  try {
    const res = await query<OrchCommitmentRow>(
      `SELECT id, bot_id, status, title, source_ref,
              pipeline_context::text AS pipeline_context,
              created_at::text AS created_at,
              completed_at::text AS completed_at
         FROM semo.bot_commitments
        WHERE runtime_source = 'hermes-orchestrator'
        ORDER BY created_at DESC
        LIMIT 50`,
    );
    return res.rows;
  } catch (err) {
    console.error('[orchestrator-flow] commitments query failed:', err);
    return [];
  }
}

async function loadOnboardingUsers(): Promise<NewUserDomainRow[]> {
  try {
    // 최근 7일 안에 새로 만들어진 team-* 도메인. nickname/role/it-fluency 함께.
    const res = await query<NewUserDomainRow>(
      `WITH new_domains AS (
         SELECT domain, MIN(created_at) AS created_at
           FROM semo.knowledge_base
          WHERE domain LIKE 'team-%'
            AND created_at > NOW() - INTERVAL '7 days'
          GROUP BY domain
       )
       SELECT
         nd.domain,
         (SELECT content FROM semo.knowledge_base WHERE domain = nd.domain AND key = 'nickname' LIMIT 1) AS nickname,
         (SELECT content FROM semo.knowledge_base WHERE domain = nd.domain AND key = 'role' LIMIT 1) AS role,
         (SELECT content FROM semo.knowledge_base WHERE domain = nd.domain AND key = 'it-fluency' LIMIT 1) AS it_fluency,
         nd.created_at::text AS created_at
       FROM new_domains nd
       ORDER BY nd.created_at DESC
       LIMIT 20`,
    );
    return res.rows;
  } catch (err) {
    console.error('[orchestrator-flow] onboarding users query failed:', err);
    return [];
  }
}

function parsePipelineContext(raw: string | null): {
  routed_from?: string;
  orchestrator_reason?: string;
  sender_name?: string;
} {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function OrchestratorFlowPage() {
  const [commitments, newUsers] = await Promise.all([
    loadOrchestratorCommitments(),
    loadOnboardingUsers(),
  ]);

  const fresh = commitments.filter((c) => c.status === 'active').length;

  return (
    <PageBody max={1100}>
      <PageHeader
        title="위임 현황"
        sub="Semi 가 전문 봇에 위임한 작업의 위임 → 처리 → 완료 실시간 현황"
      />

      {/* live banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          marginBottom: 14,
          background: 'var(--semo-success-bg)',
          borderRadius: 'var(--r-12)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--semo-success)',
          }}
        >
          <span
            style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--semo-success)' }}
          />
          실시간 연결됨
        </span>
        <span style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>hermes-orchestrator</span>
        {fresh > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--semo-ai)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="sparkles" size={14} color="var(--semo-ai)" />
            진행 중 {fresh}건
          </span>
        )}
      </div>
      <LiveCommitmentBanner />

      <Section
        title="최근 위임 작업"
        hint={`최근 ${commitments.length}건`}
        style={{ marginTop: 18, marginBottom: 28 }}
      >
        {commitments.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40, color: 'var(--semo-fg-3)' }}>
            아직 위임된 작업이 없습니다.
          </Card>
        ) : (
          <Card padding={0}>
            {commitments.map((c, i) => {
              const ctx = parsePipelineContext(c.pipeline_context);
              const st = FLOW_META[c.status] || FLOW_META.active;
              const from = ctx.routed_from || 'semi';
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 18px',
                    borderBottom:
                      i < commitments.length - 1 ? '1px solid var(--semo-line-soft)' : 'none',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      flexShrink: 0,
                      borderRadius: 'var(--r-full)',
                      fontSize: 12,
                      fontWeight: 600,
                      background: st.bg,
                      color: st.color,
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{st.emoji}</span>
                    {st.label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Avatar seed={from} square size={24} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--semo-fg-3)' }}>
                      @{from}
                    </span>
                    <Icon name="arrow-right" size={14} color="var(--semo-ai)" />
                    <Avatar seed={c.bot_id} square size={24} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--semo-fg-2)' }}>
                      @{c.bot_id}
                    </span>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--semo-fg-1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {ctx.sender_name && (
                      <Avatar seed={ctx.sender_name} label={ctx.sender_name} size={22} />
                    )}
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--semo-fg-muted)',
                        minWidth: 92,
                        textAlign: 'right',
                      }}
                    >
                      {new Date(c.created_at).toLocaleString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </Section>

      <Section title="최근 신규 사용자" hint="지난 7일">
        {newUsers.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 32, color: 'var(--semo-fg-3)' }}>
            최근 새로 온보딩된 사용자가 없습니다.
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {newUsers.map((u) => (
              <Card key={u.domain} padding={16} style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar seed={u.nickname || u.domain} label={u.nickname || u.domain} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--semo-fg-1)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {u.nickname || u.domain}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>{u.domain}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {u.role && <Badge tone="cream">{u.role}</Badge>}
                  {u.it_fluency && (
                    <Badge
                      tone={
                        u.it_fluency === '고급'
                          ? 'success'
                          : u.it_fluency === '중급'
                            ? 'primary'
                            : 'neutral'
                      }
                    >
                      AI {u.it_fluency}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </PageBody>
  );
}
