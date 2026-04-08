import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../router';

// Mock pg Pool
function createMockPool(queryResponses: Record<string, any[]> = {}) {
  return {
    query: vi.fn(async (sql: string, params: any[]) => {
      // incubator_sessions 쿼리
      if (sql.includes('incubator_sessions')) {
        return { rows: queryResponses['sessions'] || [] };
      }
      // services 쿼리
      if (sql.includes('semo.services')) {
        return { rows: queryResponses['services'] || [] };
      }
      return { rows: [] };
    }),
  } as any;
}

describe('Router', () => {
  describe('route tag', () => {
    it('should route by [Route: botId] tag', async () => {
      const pool = createMockPool();
      const router = new Router(pool);
      const result = await router.route('C123', '[Route: designclaw] 디자인 확인해줘');
      expect(result.botId).toBe('designclaw');
      expect(result.routeReason).toBe('route-tag');
    });

    it('should fallback to semiclaw for invalid route tag', async () => {
      const pool = createMockPool();
      const router = new Router(pool);
      const result = await router.route('C123', '[Route: invalidbot] 테스트');
      expect(result.botId).toBe('semiclaw');
      expect(result.routeReason).toBe('route-tag');
    });
  });

  describe('keyword routing', () => {
    const pool = createMockPool();

    it.each([
      ['인프라 배포해줘', 'infraclaw'],
      ['디자인 시스템 검토해줘', 'designclaw'],
      ['코드 리뷰 부탁', 'reviewclaw'],
      ['SEO 키워드 분석', 'growthclaw'],
      ['새 기능 feature 구현해줘', 'workclaw'],
      ['PRD 작성해줘', 'planclaw'],
    ])('"%s" → %s', async (text, expectedBot) => {
      const router = new Router(pool);
      const result = await router.route('C_UNKNOWN', text);
      expect(result.botId).toBe(expectedBot);
      expect(result.routeReason).toBe('keyword');
    });
  });

  describe('phase-based routing', () => {
    it('should route Phase 0 to semiclaw', async () => {
      const pool = createMockPool({
        sessions: [{ service_id: 'svc-1', service_name: 'TestSvc' }],
        services: [{ current_phase: 0, infra_phase: 0, service_domain: 'test-svc' }],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '프로젝트 시작하자');
      expect(result.botId).toBe('semiclaw');
      expect(result.routeReason).toBe('phase-based');
      expect(result.phase).toBe(0);
    });

    it('should route Phase 4 to designclaw', async () => {
      const pool = createMockPool({
        sessions: [{ service_id: 'svc-1', service_name: 'SEUM' }],
        services: [{ current_phase: 4, infra_phase: 0, service_domain: 'seum' }],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '어떤 작업이든');
      expect(result.botId).toBe('designclaw');
      expect(result.serviceDomain).toBe('seum');
    });

    it('should route Phase 7 to workclaw', async () => {
      const pool = createMockPool({
        sessions: [{ service_id: 'svc-1', service_name: 'PAT' }],
        services: [{ current_phase: 7, infra_phase: 0, service_domain: 'pat' }],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '기술 설계 검토');
      expect(result.botId).toBe('workclaw');
    });
  });

  describe('all phase mappings', () => {
    const phaseBotMap: [number, string][] = [
      [0, 'semiclaw'],
      [1, 'planclaw'],
      [2, 'planclaw'],
      [3, 'planclaw'],
      [4, 'designclaw'],
      [5, 'planclaw'],
      [6, 'planclaw'],
      [7, 'workclaw'],
      [8, 'workclaw'],
      [9, 'planclaw'],
    ];

    it.each(phaseBotMap)('Phase %i → %s', async (phase, expectedBot) => {
      const pool = createMockPool({
        sessions: [{ service_id: 'svc', service_name: 'Test' }],
        services: [{ current_phase: phase, infra_phase: 0, service_domain: 'test' }],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '일반 메시지');
      expect(result.botId).toBe(expectedBot);
    });
  });

  describe('keyword priority', () => {
    it('should match first keyword in KEYWORD_ROUTES order', async () => {
      const pool = createMockPool();
      const router = new Router(pool);
      // "인프라"(infraclaw) + "리뷰"(reviewclaw) → infraclaw wins (배열 순서)
      const result = await router.route('C_UNKNOWN', '인프라 코드 리뷰해줘');
      expect(result.botId).toBe('infraclaw');
    });
  });

  describe('fallback', () => {
    it('should fallback to semiclaw when no service found', async () => {
      const pool = createMockPool({ sessions: [] });
      const router = new Router(pool);
      const result = await router.route('C_UNKNOWN', '안녕하세요');
      expect(result.botId).toBe('semiclaw');
      expect(result.routeReason).toBe('fallback');
    });

    it('should fallback gracefully on DB error', async () => {
      const pool = { query: vi.fn().mockRejectedValue(new Error('DB down')) } as any;
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '안녕하세요 잘 지내시나요');
      expect(result.botId).toBe('semiclaw');
      expect(result.routeReason).toBe('fallback');
    });
  });

  describe('caching', () => {
    it('should cache service info and not re-query within TTL', async () => {
      const pool = createMockPool({
        sessions: [{ service_id: 'svc-1', service_name: 'TestSvc' }],
        services: [{ current_phase: 1, infra_phase: 0, service_domain: 'test-svc' }],
      });
      const router = new Router(pool);

      await router.route('C_PROJ', 'first');
      await router.route('C_PROJ', 'second');

      // sessions 쿼리는 1번만 호출되어야 함 (캐시 적중)
      const sessionCalls = pool.query.mock.calls.filter((c: any[]) =>
        c[0].includes('incubator_sessions'),
      );
      expect(sessionCalls).toHaveLength(1);
    });
  });
});
