import { describe, it, expect } from 'vitest';
import { ITServiceContextProvider } from '../plugins/it-service-context';
import type { RouteResult, ContextProvider } from '../types';

describe('ITServiceContextProvider', () => {
  const provider = new ITServiceContextProvider();

  it('should implement ContextProvider interface', () => {
    expect(typeof provider.buildContext).toBe('function');
  });

  it('should include phase context for plan track', () => {
    const route: RouteResult = {
      botId: 'planclaw',
      serviceId: 'svc-1',
      serviceDomain: 'test-svc',
      phase: 3,
      track: 'plan',
      projectType: 'service',
      routeReason: 'phase-based',
    };
    const ctx = provider.buildContext(route, 'planclaw');
    expect(ctx).toContain('Phase 3');
    expect(ctx.length).toBeGreaterThan(0);
  });

  it('should include infra context for infra track', () => {
    const route: RouteResult = {
      botId: 'infraclaw',
      serviceId: 'svc-1',
      serviceDomain: 'test-svc',
      phase: 2,
      track: 'infra',
      projectType: 'service',
      routeReason: 'phase-based',
    };
    const ctx = provider.buildContext(route, 'infraclaw');
    expect(ctx.length).toBeGreaterThan(0);
  });

  it('should return empty for unresolvable route', () => {
    const route: RouteResult = {
      botId: 'semiclaw',
      serviceId: '',
      serviceDomain: '',
      phase: -1,
      track: 'plan',
      projectType: 'service',
      routeReason: 'fallback',
    };
    const ctx = provider.buildContext(route, 'semiclaw');
    expect(ctx).toBe('');
  });

  it.each([
    [0, 'semiclaw'],
    [1, 'planclaw'],
    [4, 'designclaw'],
    [7, 'workclaw'],
    [9, 'planclaw'],
  ])('should generate context for Phase %i (bot: %s)', (phase, botId) => {
    const route: RouteResult = {
      botId,
      serviceId: 'svc-1',
      serviceDomain: 'test-svc',
      phase,
      track: 'plan',
      projectType: 'service',
      routeReason: 'phase-based',
    };
    const ctx = provider.buildContext(route, botId);
    expect(ctx).toContain(`Phase ${phase}`);
  });
});

describe('ContextProvider pattern — extensibility', () => {
  it('should allow custom ContextProvider registration', () => {
    const customProvider: ContextProvider = {
      buildContext(route, botId) {
        return `[Custom: ${route.projectType}] domain=${route.serviceDomain}`;
      },
    };

    const providers = new Map<string, ContextProvider>([
      ['service', new ITServiceContextProvider()],
      ['cafe', customProvider],
    ]);

    const cafeRoute: RouteResult = {
      botId: 'semiclaw',
      serviceId: 'cafe-1',
      serviceDomain: 'my-cafe',
      phase: 0,
      track: 'plan',
      projectType: 'cafe',
      routeReason: 'phase-based',
    };

    const provider = providers.get(cafeRoute.projectType);
    expect(provider).toBe(customProvider);
    const ctx = provider!.buildContext(cafeRoute, 'semiclaw');
    expect(ctx).toContain('Custom: cafe');
  });

  it('should gracefully handle missing provider', () => {
    const providers = new Map<string, ContextProvider>([
      ['service', new ITServiceContextProvider()],
    ]);

    const unknownRoute: RouteResult = {
      botId: 'semiclaw',
      serviceId: '',
      serviceDomain: 'unknown',
      phase: 0,
      track: 'plan',
      projectType: 'unknown-type',
      routeReason: 'fallback',
    };

    const provider = providers.get(unknownRoute.projectType);
    const ctx = provider?.buildContext(unknownRoute, 'semiclaw') ?? '';
    expect(ctx).toBe('');
  });
});
