import { describe, it, expect, vi } from 'vitest';
import { Router } from '../router';

function createMockPool(queryResponses: Record<string, any[]> = {}) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('bot_status')) {
        return {
          rows: queryResponses['bots'] || [
            { bot_id: 'semiclaw' },
            { bot_id: 'planclaw' },
            { bot_id: 'designclaw' },
            { bot_id: 'workclaw' },
            { bot_id: 'reviewclaw' },
            { bot_id: 'infraclaw' },
            { bot_id: 'growthclaw' },
            { bot_id: 'incubator' },
          ],
        };
      }
      if (sql.includes('knowledge_base') && sql.includes('role')) {
        return {
          rows: queryResponses['kbRoles'] || [
            {
              bot_id: 'semiclaw',
              content: '### GFP Phase 담당\n| Phase | Name |\n| 0 | Onboarding |',
            },
            {
              bot_id: 'planclaw',
              content:
                '### GFP Phase 담당\n| Phase | Name |\n| 1 | Discovery |\n| 2 | PRD |\n| 3 | Review |\n| 5 | Planning |\n| 6 | Sprint |\n| 9 | Closing |',
            },
            {
              bot_id: 'designclaw',
              content: '### GFP Phase 담당\n| Phase | Name |\n| 4 | Design |',
            },
            {
              bot_id: 'workclaw',
              content: '### GFP Phase 담당\n| Phase | Name |\n| 7 | Dev |\n| 8 | Test |',
            },
          ],
        };
      }
      if (sql.includes('bot_delegation') && sql.includes('skill-routing')) {
        return { rows: queryResponses['skillDelegation'] || [] };
      }
      if (sql.includes('bot_delegation')) {
        return { rows: queryResponses['delegation'] || [] };
      }
      if (sql.includes('incubator_sessions') && sql.includes('SELECT 1')) {
        return { rows: queryResponses['incubator'] || [] };
      }
      if (sql.includes('semo.services')) {
        return { rows: queryResponses['services'] || [] };
      }
      return { rows: [] };
    }),
  } as any;
}

describe('Router — Phase 5: projectType propagation', () => {
  describe('projectType in RouteResult', () => {
    it('should include projectType from ontology entity_type', async () => {
      const pool = createMockPool({
        services: [
          {
            full_service_id: 'svc-1',
            project_name: 'TestSvc',
            service_domain: 'test-svc',
            current_phase: 3,
            infra_phase: 0,
            project_type: 'module',
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '뭔가 확인');
      expect(result.projectType).toBe('module');
    });

    it('should default projectType to "service" when ontology has no entity_type', async () => {
      const pool = createMockPool({
        services: [
          {
            full_service_id: 'svc-1',
            project_name: 'TestSvc',
            service_domain: 'test-svc',
            current_phase: 3,
            infra_phase: 0,
            project_type: null,
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '안녕하세요');
      expect(result.projectType).toBe('service');
    });

    it('should propagate projectType in route-tag result', async () => {
      const pool = createMockPool({
        services: [
          {
            full_service_id: 'svc-1',
            project_name: 'TestSvc',
            service_domain: 'test-svc',
            current_phase: 0,
            infra_phase: 0,
            project_type: 'platform',
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '[Route: planclaw] 기획해줘');
      expect(result.routeReason).toBe('route-tag');
      expect(result.projectType).toBe('platform');
    });

    it('should propagate projectType in thread-sticky result', async () => {
      const pool = createMockPool({
        services: [
          {
            full_service_id: 'svc-1',
            project_name: 'TestSvc',
            service_domain: 'test-svc',
            current_phase: 3,
            infra_phase: 0,
            project_type: 'module',
          },
        ],
      });
      const router = new Router(pool);
      router.setThreadBot('t123', 'planclaw');
      const result = await router.route('C_PROJ', '이어서 진행', 't123');
      expect(result.routeReason).toBe('thread-sticky');
      expect(result.projectType).toBe('module');
    });

    it('should default projectType in fallback result', async () => {
      const pool = createMockPool({ services: [] });
      const router = new Router(pool);
      const result = await router.route('C_UNKNOWN', '안녕하세요');
      expect(result.routeReason).toBe('fallback');
      expect(result.projectType).toBe('service');
    });

    it('should propagate projectType in sprint workflow routing', async () => {
      const pool = createMockPool({
        services: [
          {
            full_service_id: 'svc-1',
            project_name: 'TestSvc',
            service_domain: 'test-svc',
            current_phase: 3,
            infra_phase: 0,
            project_type: 'platform',
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '스프린트 시작');
      expect(result.workflow).toBe('sprint');
      expect(result.projectType).toBe('platform');
    });
  });

  describe('getProjectContext', () => {
    it('should map RouteResult to ProjectContext with correct projectType', () => {
      const pool = createMockPool();
      const router = new Router(pool);
      const route = {
        botId: 'planclaw',
        serviceId: 'svc-1',
        serviceDomain: 'test-svc',
        phase: 3,
        track: 'plan' as const,
        projectType: 'module',
        routeReason: 'phase-based' as const,
      };
      const ctx = router.getProjectContext(route);
      expect(ctx).not.toBeNull();
      expect(ctx!.domain).toBe('test-svc');
      expect(ctx!.projectType).toBe('module');
      expect(ctx!.metadata).toEqual({
        serviceId: 'svc-1',
        phase: 3,
        track: 'plan',
      });
    });

    it('should return null when serviceDomain is empty', () => {
      const pool = createMockPool();
      const router = new Router(pool);
      const route = {
        botId: 'semiclaw',
        serviceId: '',
        serviceDomain: '',
        phase: -1,
        track: 'plan' as const,
        projectType: 'service',
        routeReason: 'fallback' as const,
      };
      expect(router.getProjectContext(route)).toBeNull();
    });
  });
});
