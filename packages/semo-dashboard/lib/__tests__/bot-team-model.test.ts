import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  classifyBotRow,
  openClawBotsFromRuntimeSourceMap,
  splitBotRowsForTeamDashboard,
} from '../bot-team-model';

describe('bot team dashboard model', () => {
  it('treats every agent_install projection as an installed agent, including internal installs', () => {
    const row = {
      id: 'ag-team-semicolon-operator',
      name: 'Operator',
      status: 'online',
      config: {
        audience: 'internal',
        install_id: 'install-1',
        tenant_slug: 'team-semicolon',
      },
    };

    expect(classifyBotRow(row)).toBe('installed-agent');
  });

  it('separates runtime service identities from legacy bot rows', () => {
    expect(classifyBotRow({ id: 'semobot', name: 'SemoBot', status: 'online', config: {} })).toBe(
      'runtime-service',
    );
    expect(
      classifyBotRow({ id: 'slack-router', name: 'slack-router', status: 'online', config: {} }),
    ).toBe('runtime-service');
    expect(
      classifyBotRow({ id: 'openclaw', name: 'openclaw', status: 'offline', config: {} }),
    ).toBe('runtime-service');
    expect(
      classifyBotRow({
        id: 'reviewclaw',
        name: 'ReviewClaw',
        status: 'offline',
        config: { audience: 'internal', host_kind: 'openclaw' },
      }),
    ).toBe('legacy-agent');
  });

  it('splits bot rows into runtime services, installed agents, and legacy agents', () => {
    const split = splitBotRowsForTeamDashboard([
      { id: 'semobot', name: 'SemoBot', status: 'online', config: {} },
      {
        id: 'ag-team-semicolon-operator',
        name: 'Operator',
        status: 'online',
        config: { audience: 'internal', install_id: 'install-1' },
      },
      {
        id: 'workclaw',
        name: 'WorkClaw',
        status: 'offline',
        config: { audience: 'internal', host_kind: 'openclaw' },
      },
    ]);

    expect(split.runtimeServices.map((b) => b.id)).toEqual(['semobot']);
    expect(split.installedAgents.map((b) => b.id)).toEqual(['ag-team-semicolon-operator']);
    expect(split.legacyAgents.map((b) => b.id)).toEqual(['workclaw']);
  });

  it('does not resurrect legacy OpenClaw defaults when runtime_source map is present but empty', () => {
    expect(openClawBotsFromRuntimeSourceMap({ semiclaw: 'serve-worker' })).toEqual([]);
    expect(openClawBotsFromRuntimeSourceMap(undefined)).toContain('semiclaw');
  });

  it('ships a migration that seeds internal agents through the same install model', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../migrations/017_internal_agent_installs.sql'),
      'utf8',
    );

    expect(sql).toContain("slug = 'team-semicolon'");
    expect(sql).toContain("'semi'");
    expect(sql).toContain("'colony'");
    expect(sql).toContain("'operator'");
    expect(sql).toContain("'internal'");
    expect(sql).toContain('public.agent_installs');
  });
});
