import { describe, it, expect } from 'vitest';
import { CoreContextProvider } from '../core-context';
import type { RouteResult } from '../types';

describe('CoreContextProvider', () => {
  const provider = new CoreContextProvider();

  function makeRoute(overrides: Partial<RouteResult> = {}): RouteResult {
    return {
      botId: 'semiclaw',
      serviceId: '',
      serviceDomain: '',
      phase: -1,
      track: 'plan',
      projectType: 'unknown',
      routeReason: 'domain-matched',
      ...overrides,
    };
  }

  it('should return empty string when serviceDomain is empty', () => {
    const result = provider.buildContext(makeRoute(), 'semiclaw');
    expect(result).toBe('');
  });

  it('should include domain and KB routing guide for non-service domains', () => {
    const route = makeRoute({
      serviceDomain: 'trade-corp',
      projectType: 'organization',
    });
    const result = provider.buildContext(route, 'semiclaw');
    expect(result).toContain('도메인: trade-corp');
    expect(result).toContain('타입: organization');
    expect(result).toContain('semo kb get trade-corp base-information');
    expect(result).toContain('semo kb search "키워드" --domain trade-corp');
    expect(result).toContain('semo action-items list --owner trade-corp');
  });
});
