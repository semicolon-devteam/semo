import { describe, it, expect } from 'vitest';

describe('Core barrel exports (lib/core/index.ts)', () => {
  it('should export KB functions', async () => {
    const core = await import('../core/index');
    expect(core.list).toBeDefined();
    expect(core.getItem).toBeDefined();
    expect(core.upsertItem).toBeDefined();
    expect(typeof core.list).toBe('function');
  });

  it('should export action-items functions', async () => {
    const core = await import('../core/index');
    expect(core.listActionItems).toBeDefined();
    expect(core.createActionItem).toBeDefined();
    expect(typeof core.listActionItems).toBe('function');
  });

  it('should export meeting functions', async () => {
    const core = await import('../core/index');
    expect(core.createMeeting).toBeDefined();
    expect(core.getMeeting).toBeDefined();
    expect(core.listMeetings).toBeDefined();
    expect(core.updateMeeting).toBeDefined();
    expect(core.deleteMeeting).toBeDefined();
    expect(typeof core.createMeeting).toBe('function');
  });
});

describe('Plugin barrel exports (lib/plugins/service/index.ts)', () => {
  it('should export service functions', async () => {
    const plugin = await import('../plugins/service/index');
    expect(plugin.listProjects).toBeDefined();
    expect(plugin.getProject).toBeDefined();
    expect(typeof plugin.listProjects).toBe('function');
  });

  it('should export KPI functions', async () => {
    const plugin = await import('../plugins/service/index');
    expect(plugin.listKPIMetrics).toBeDefined();
    expect(plugin.listKPIPeriods).toBeDefined();
    expect(plugin.batchCreateKPIMetrics).toBeDefined();
    expect(plugin.parseKPIMarkdown).toBeDefined();
    expect(typeof plugin.listKPIMetrics).toBe('function');
  });

  it('should export iterations functions', async () => {
    const plugin = await import('../plugins/service/index');
    expect(plugin.listIterations).toBeDefined();
    expect(typeof plugin.listIterations).toBe('function');
  });
});

describe('Re-export shims (backward compatibility)', () => {
  it('lib/kb.ts should re-export from core/kb.ts', async () => {
    const shimKB = await import('../kb');
    const coreKB = await import('../core/kb');
    expect(shimKB.list).toBe(coreKB.list);
    expect(shimKB.getItem).toBe(coreKB.getItem);
    expect(shimKB.upsertItem).toBe(coreKB.upsertItem);
  });

  it('lib/meeting.ts should re-export from core/meeting.ts', async () => {
    const shimMeeting = await import('../meeting');
    const coreMeeting = await import('../core/meeting');
    expect(shimMeeting.createMeeting).toBe(coreMeeting.createMeeting);
    expect(shimMeeting.getMeeting).toBe(coreMeeting.getMeeting);
    expect(shimMeeting.listMeetings).toBe(coreMeeting.listMeetings);
  });

  it('lib/service.ts should re-export from plugins/service/service.ts', async () => {
    const shimService = await import('../service');
    const pluginService = await import('../plugins/service/service');
    expect(shimService.listProjects).toBe(pluginService.listProjects);
    expect(shimService.getProject).toBe(pluginService.getProject);
  });

  it('lib/kpi.ts should re-export from plugins/service/kpi.ts', async () => {
    const shimKpi = await import('../kpi');
    const pluginKpi = await import('../plugins/service/kpi');
    expect(shimKpi.listKPIMetrics).toBe(pluginKpi.listKPIMetrics);
    expect(shimKpi.listKPIPeriods).toBe(pluginKpi.listKPIPeriods);
  });

  it('lib/iterations.ts should re-export from plugins/service/iterations.ts', async () => {
    const shimIter = await import('../iterations');
    const pluginIter = await import('../plugins/service/iterations');
    expect(shimIter.listIterations).toBe(pluginIter.listIterations);
  });
});
