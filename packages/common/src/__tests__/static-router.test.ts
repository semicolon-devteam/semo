import { describe, it, expect } from 'vitest';
import { StaticRouter } from '../router/static-router.js';

describe('StaticRouter', () => {
  it('기본 메시지는 defaultBotId 로 폴백', async () => {
    const r = new StaticRouter({ defaultBotId: 'semiclaw' });
    const res = await r.route('ch1', '안녕');
    expect(res.botId).toBe('semiclaw');
    expect(res.routeReason).toBe('fallback');
    expect(res.projectType).toBe('personal');
  });

  it('[Route: botId] 태그는 validBotIds 안이면 라우팅', async () => {
    const r = new StaticRouter({
      defaultBotId: 'semiclaw',
      validBotIds: ['semiclaw', 'planclaw'],
    });
    const res = await r.route('ch1', '[Route: planclaw] 기획 해줘');
    expect(res.botId).toBe('planclaw');
    expect(res.routeReason).toBe('route-tag');
  });

  it('[Route: ?] 태그가 validBotIds 밖이면 default 로 폴백', async () => {
    const r = new StaticRouter({
      defaultBotId: 'semiclaw',
      validBotIds: ['semiclaw'],
    });
    const res = await r.route('ch1', '[Route: unknown] 테스트');
    expect(res.botId).toBe('semiclaw');
    expect(res.routeReason).toBe('route-tag');
  });

  it('aliases 를 통한 nickname 해석', async () => {
    const r = new StaticRouter({
      defaultBotId: 'semiclaw',
      validBotIds: ['semiclaw', 'planclaw'],
      aliases: { pm: 'planclaw' },
    });
    const res = await r.route('ch1', '[Route: pm] 기획');
    expect(res.botId).toBe('planclaw');
    expect(res.routeReason).toBe('route-tag');
  });

  it('thread-sticky: setThreadBot 후 같은 threadTs 메시지는 이전 봇으로', async () => {
    const r = new StaticRouter({
      defaultBotId: 'semiclaw',
      validBotIds: ['semiclaw', 'planclaw'],
    });
    r.setThreadBot('thread-1', 'planclaw');
    const res = await r.route('ch1', '후속 메시지', 'thread-1');
    expect(res.botId).toBe('planclaw');
    expect(res.routeReason).toBe('thread-sticky');
  });

  it('thread-sticky TTL 만료 시 default 로 폴백', async () => {
    const r = new StaticRouter({
      defaultBotId: 'semiclaw',
      validBotIds: ['semiclaw', 'planclaw'],
      threadTtlMs: 1,
    });
    r.setThreadBot('thread-1', 'planclaw');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const res = await r.route('ch1', '늦은 메시지', 'thread-1');
    expect(res.botId).toBe('semiclaw');
    expect(res.routeReason).toBe('fallback');
  });

  it('loadRouting 은 no-op (Personal 에는 DB 없음)', async () => {
    const r = new StaticRouter({ defaultBotId: 'semiclaw' });
    await expect(r.loadRouting()).resolves.toBeUndefined();
  });

  it('validBotIds 미지정 시 defaultBotId 만 허용', async () => {
    const r = new StaticRouter({ defaultBotId: 'semiclaw' });
    const res = await r.route('ch1', '[Route: planclaw] 메시지');
    expect(res.botId).toBe('semiclaw');
  });

  it('getProjectContext 는 항상 null (Personal 은 프로젝트 컨텍스트 없음)', () => {
    const r = new StaticRouter({ defaultBotId: 'semiclaw' });
    const route = { botId: 'semiclaw' } as ReturnType<StaticRouter['getProjectContext']> & {
      botId: string;
    };
    expect(
      r.getProjectContext({
        ...route,
        serviceId: '',
        serviceDomain: '',
        phase: -1,
        track: 'plan',
        projectType: 'personal',
        routeReason: 'fallback',
      }),
    ).toBeNull();
  });
});
