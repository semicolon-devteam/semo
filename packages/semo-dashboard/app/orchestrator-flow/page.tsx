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

function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-amber-600 dark:text-amber-400';
    case 'done':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'failed':
      return 'text-rose-600 dark:text-rose-400';
    default:
      return 'text-zinc-500';
  }
}

function statusBadge(status: string): string {
  switch (status) {
    case 'active':
      return '⏳';
    case 'done':
      return '✅';
    case 'failed':
      return '⚠️';
    default:
      return '·';
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Orchestrator Flow</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Semi 가 전문 에이전트에게 위임한 작업의 진행 상태 (위임 → 처리 → 완료) + 최근 새 사용자
          온보딩 현황
        </p>
      </header>

      <LiveCommitmentBanner />

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">최근 위임 작업 (최근 50건)</h2>
        {commitments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            아직 hermes-orchestrator 가 만든 commitment 가 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {commitments.map((c) => {
              const ctx = parsePipelineContext(c.pipeline_context);
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${statusColor(c.status)}`}>
                      {statusBadge(c.status)} {c.status}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(c.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="mt-1.5 text-zinc-800 dark:text-zinc-200">
                    {ctx.routed_from && (
                      <span className="font-mono text-xs text-zinc-500">@{ctx.routed_from} → </span>
                    )}
                    <span className="font-mono text-xs font-medium">@{c.bot_id}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-zinc-600 dark:text-zinc-400">{c.title}</p>
                  {ctx.sender_name && (
                    <p className="mt-1 text-xs text-zinc-400">
                      from {ctx.sender_name} · {c.source_ref}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">최근 신규 사용자 (최근 7일)</h2>
        {newUsers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            최근 새로 온보딩된 사용자가 없습니다.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {newUsers.map((u) => (
              <li
                key={u.domain}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="font-medium text-zinc-800 dark:text-zinc-200">
                  {u.nickname || u.domain}
                </div>
                <div className="mt-0.5 font-mono text-xs text-zinc-500">{u.domain}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  {u.role && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {u.role}
                    </span>
                  )}
                  {u.it_fluency && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      AI {u.it_fluency}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  등록 {new Date(u.created_at).toLocaleString('ko-KR')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 text-xs text-zinc-400">
        실시간 push 활성 — SSE /api/bots/stream (LISTEN 가능 환경) 또는 5초 폴링 폴백.
      </footer>
    </div>
  );
}
