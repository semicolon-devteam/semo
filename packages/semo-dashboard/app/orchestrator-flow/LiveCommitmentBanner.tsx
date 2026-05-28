'use client';

/**
 * Live commitment banner — EventSource 통해 /api/bots/stream 실시간 update.
 * P2-C (2026-05-28).
 */
import { useEffect, useState } from 'react';

interface CommitmentEvent {
  op: string;
  id: string;
  bot_id: string;
  status: string;
  runtime_source: string | null;
}

interface State {
  mode: 'connecting' | 'listen' | 'poll' | 'error';
  recent: CommitmentEvent[];
  lastSeenAt: string | null;
}

const MAX_RECENT = 5;

export function LiveCommitmentBanner() {
  const [state, setState] = useState<State>({
    mode: 'connecting',
    recent: [],
    lastSeenAt: null,
  });

  useEffect(() => {
    const es = new EventSource('/api/bots/stream');

    es.addEventListener('mode', (e) => {
      try {
        const m = JSON.parse((e as MessageEvent).data) as { mode: 'listen' | 'poll' };
        setState((s) => ({ ...s, mode: m.mode }));
      } catch {
        /* ignore */
      }
    });

    es.addEventListener('commitment', (e) => {
      try {
        const evt = JSON.parse((e as MessageEvent).data) as CommitmentEvent;
        setState((s) => ({
          ...s,
          recent: [evt, ...s.recent.filter((x) => x.id !== evt.id)].slice(0, MAX_RECENT),
          lastSeenAt: new Date().toISOString(),
        }));
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => {
      setState((s) => ({ ...s, mode: 'error' }));
    };

    return () => es.close();
  }, []);

  const dotColor = {
    connecting: 'bg-zinc-400',
    listen: 'bg-emerald-500',
    poll: 'bg-amber-500',
    error: 'bg-rose-500',
  }[state.mode];

  return (
    <div className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
        <span className="font-medium">실시간 commitment</span>
        <span className="text-xs text-zinc-400">
          mode: {state.mode}
          {state.lastSeenAt
            ? ` · 마지막 ${new Date(state.lastSeenAt).toLocaleTimeString('ko-KR')}`
            : ''}
        </span>
      </div>
      {state.recent.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs">
          {state.recent.map((c) => (
            <li key={c.id} className="font-mono text-zinc-600 dark:text-zinc-400">
              [{c.status}] @{c.bot_id} · {c.id.slice(-10)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-zinc-400">아직 실시간 이벤트 없음 (대기 중)</p>
      )}
    </div>
  );
}
