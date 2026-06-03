import { describe, it, expect } from 'vitest';
import {
  parseBotIdsDisplayMeta,
  buildInternalRoster,
  buildRosterContextBlock,
  isRoutable,
  stripRouteSystemLines,
  loadSemiRoster,
  type ResolvedRoster,
  type CustomerInstallRow,
} from './semi-roster';

describe('stripRouteSystemLines', () => {
  it('첫 ROUTE/REASON/HANDOFF 라인 이전까지만 (시스템 라인 노출 방지)', () => {
    const t = '맡겨볼게요.\nROUTE: ghostbot\nREASON: x\nHANDOFF: do it';
    expect(stripRouteSystemLines(t)).toBe('맡겨볼게요.');
  });
  it('시스템 라인 없으면 원문 trim', () => {
    expect(stripRouteSystemLines('  그냥 답변  ')).toBe('그냥 답변');
  });
});

const KB = `# 봇 ID 매핑 테이블

| 봇 | Slack ID | 역할 | 비고 |
|---|---|---|---|
| SemiClaw | U1 | PM/오케스트레이터 | x |
| WorkClaw | U2 | 개발/구현 | y |
| SemoBot | U3 | 시스템 관리 | persona-only |
`;

describe('parseBotIdsDisplayMeta', () => {
  it('표 행을 botId(소문자)→{displayName,role} 로 파싱, 헤더/구분선 스킵', () => {
    const m = parseBotIdsDisplayMeta(KB);
    expect(m.get('semiclaw')).toEqual({ displayName: 'SemiClaw', role: 'PM/오케스트레이터' });
    expect(m.get('workclaw')?.role).toBe('개발/구현');
    expect(m.has('봇')).toBe(false);
  });
  it('깨진/빈 입력에 graceful', () => {
    expect(parseBotIdsDisplayMeta('').size).toBe(0);
    expect(parseBotIdsDisplayMeta('no table here').size).toBe(0);
  });
});

describe('buildInternalRoster', () => {
  it('OPENCLAW_BOTS → internal 엔트리(dispatchable), 보조메타 결합', () => {
    const roster = buildInternalRoster(
      new Set(['workclaw', 'semiclaw']),
      parseBotIdsDisplayMeta(KB),
    );
    expect(roster.map((e) => e.botId)).toEqual(['semiclaw', 'workclaw']); // 정렬
    expect(roster[0]).toMatchObject({
      audience: 'internal',
      displayName: 'SemiClaw',
      dispatchable: true,
    });
    expect(roster.every((e) => e.dispatchable)).toBe(true);
  });
  it('보조메타 없으면 displayName=botId fallback', () => {
    const roster = buildInternalRoster(new Set(['planclaw']));
    expect(roster[0].displayName).toBe('planclaw');
  });
});

describe('buildRosterContextBlock', () => {
  it('internal 엔트리만 routing 대상으로 노출(customer 제외)', () => {
    const r: ResolvedRoster = {
      audience: 'internal',
      source: 'internal-openclaw',
      entries: [
        {
          audience: 'internal',
          botId: 'workclaw',
          displayName: 'WorkClaw',
          roleLabel: '개발',
          dispatchable: true,
        },
        {
          audience: 'customer',
          agentSlug: 'jumuni',
          displayName: '주문이',
          installId: 'i1',
          dispatchable: false,
        },
      ],
    };
    const block = buildRosterContextBlock(r);
    expect(block).toContain('`workclaw` — 개발');
    expect(block).not.toContain('jumuni');
    expect(block).not.toContain('주문이');
  });
  it('internal 없으면 빈 문자열', () => {
    const r: ResolvedRoster = {
      audience: 'customer',
      source: 'customer-installs',
      entries: [
        {
          audience: 'customer',
          agentSlug: 'jumuni',
          displayName: '주문이',
          installId: 'i1',
          dispatchable: false,
        },
      ],
    };
    expect(buildRosterContextBlock(r)).toBe('');
  });
});

describe('isRoutable', () => {
  const r: ResolvedRoster = {
    audience: 'internal',
    source: 'internal-openclaw',
    entries: [
      { audience: 'internal', botId: 'workclaw', displayName: 'WorkClaw', dispatchable: true },
      {
        audience: 'customer',
        agentSlug: 'jumuni',
        displayName: '주문이',
        installId: 'i1',
        dispatchable: false,
      },
    ],
  };
  it('internal → ok', () => {
    expect(isRoutable(r, 'workclaw').ok).toBe(true);
    expect(isRoutable(r, 'WorkClaw').ok).toBe(true); // 정규화
  });
  it('customer → not-dispatchable', () => {
    expect(isRoutable(r, 'jumuni')).toMatchObject({ ok: false, reason: 'not-dispatchable' });
  });
  it('roster 밖 → not-in-roster', () => {
    expect(isRoutable(r, 'ghostbot')).toMatchObject({ ok: false, reason: 'not-in-roster' });
    expect(isRoutable(r, null).ok).toBe(false);
  });
});

describe('loadSemiRoster', () => {
  const deps = {
    openclawBots: new Set(['workclaw', 'semiclaw']),
    displayMeta: parseBotIdsDisplayMeta(KB),
  };

  it('tenantSlug 없음 → internal(OPENCLAW_BOTS)', async () => {
    const r = await loadSemiRoster({}, deps);
    expect(r.audience).toBe('internal');
    expect(r.source).toBe('internal-openclaw');
    expect(r.entries.every((e) => e.audience === 'internal' && e.dispatchable)).toBe(true);
  });

  it('tenantSlug 있음 → customer(installs, dispatchable=false, install축 식별자)', async () => {
    const rows: CustomerInstallRow[] = [
      {
        agent_slug: 'jumuni',
        display_name: '주문이',
        role_label: '주문 응대',
        install_id: 'inst-1',
        instance_name: '주문이#1',
        persona_slug: 'jumuni',
        pinned_version: 2,
      },
    ];
    const r = await loadSemiRoster(
      { tenantSlug: 'team-semicolon' },
      { ...deps, queryCustomerInstalls: async () => rows },
    );
    expect(r.audience).toBe('customer');
    const e = r.entries[0];
    expect(e).toMatchObject({
      audience: 'customer',
      agentSlug: 'jumuni',
      installId: 'inst-1',
      dispatchable: false,
      personaSlug: 'jumuni',
      pinnedVersion: 2,
    });
    expect('botId' in e).toBe(false); // botId 단일축 아님
  });

  it('customer installs 비면 source=empty', async () => {
    const r = await loadSemiRoster(
      { tenantSlug: 't' },
      { ...deps, queryCustomerInstalls: async () => [] },
    );
    expect(r.source).toBe('empty');
  });
});
