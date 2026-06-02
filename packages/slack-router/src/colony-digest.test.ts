import { describe, it, expect } from 'vitest';
import {
  parseDigestResult,
  buildDigestExtractionPrompt,
  runColonyDailyDigest,
  type DigestDeps,
  type DigestState,
} from './colony-digest';

describe('parseDigestResult', () => {
  it('DIGEST_JSON 펜스 블록 파싱', () => {
    const text =
      '정리했어요.\nDIGEST_JSON\n```json\n{"decisions":[{"slug":"x","title":"X","body":"b"}],"blockers":[],"actions":[{"description":"do"}]}\n```';
    const r = parseDigestResult(text);
    expect(r.decisions).toHaveLength(1);
    expect(r.decisions[0].slug).toBe('x');
    expect(r.actions[0].description).toBe('do');
  });
  it('블록 없으면 빈 추출', () => {
    expect(parseDigestResult('특이사항 없음')).toEqual({ decisions: [], blockers: [], actions: [] });
  });
  it('깨진 JSON 이면 빈 추출', () => {
    expect(parseDigestResult('```json\n{bad}\n```').decisions).toEqual([]);
  });
});

describe('buildDigestExtractionPrompt', () => {
  it('채널/도메인/메시지/출력형식 포함', () => {
    const p = buildDigestExtractionPrompt('proj-x', 'axoracle', [
      { ts: '1', user: 'U', text: '결정함' },
    ]);
    expect(p).toContain('#proj-x → 도메인 axoracle');
    expect(p).toContain('- [1] U: 결정함');
    expect(p).toContain('DIGEST_JSON');
  });
});

function baseDeps(over: Partial<DigestDeps> = {}): { deps: DigestDeps; calls: any } {
  const calls = { decisions: [] as any[], blockers: [] as any[], actions: [] as any[], saved: null as DigestState | null };
  const state: DigestState = { channels: {} };
  const deps: DigestDeps = {
    listChannels: async () => [
      { id: 'C1', name: 'proj-x' },
      { id: 'C2', name: 'unmapped-ch' },
    ],
    getMappings: async () => new Map([['C1', 'axoracle']]),
    fetchMessages: async () => [{ ts: '100', user: 'U', text: 'msg' }],
    extract: async () => 'DIGEST_JSON\n```json\n{"decisions":[{"slug":"d","title":"D","body":"b"}],"blockers":[],"actions":[]}\n```',
    writeDecision: async (d) => { calls.decisions.push(d); },
    writeBlocker: async (b) => { calls.blockers.push(b); },
    createAction: async (a) => { calls.actions.push(a); },
    loadState: () => state,
    saveState: (s) => { calls.saved = s; },
    log: () => {},
    today: '2026-06-03',
    defaultSinceTs: '0',
    ...over,
  };
  return { deps, calls };
}

describe('runColonyDailyDigest', () => {
  it('매핑된 채널만 처리, 미매핑은 unmapped 로', async () => {
    const { deps, calls } = baseDeps();
    const s = await runColonyDailyDigest(deps);
    expect(s.ran).toHaveLength(1);
    expect(s.ran[0].domain).toBe('axoracle');
    expect(s.ran[0].decisions).toBe(1);
    expect(s.unmapped).toEqual([{ id: 'C2', name: 'unmapped-ch' }]);
    expect(calls.decisions[0].domain).toBe('axoracle');
  });

  it('오늘 이미 처리한 채널은 멱등 skip', async () => {
    const state: DigestState = { channels: { C1: { last_digest_date: '2026-06-03' } } };
    const { deps } = baseDeps({ loadState: () => state });
    const s = await runColonyDailyDigest(deps);
    expect(s.skippedToday).toBe(1);
    expect(s.ran).toHaveLength(0);
  });

  it('메시지 0건이면 추출/write 안 함', async () => {
    const { deps, calls } = baseDeps({ fetchMessages: async () => [] });
    const s = await runColonyDailyDigest(deps);
    expect(s.ran[0].messages).toBe(0);
    expect(calls.decisions).toHaveLength(0);
  });
});
