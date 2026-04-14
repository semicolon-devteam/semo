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
      // resolveDomainContext: 1차 ontology 기반 쿼리
      if (sql.includes('semo.ontology') && sql.includes('o.slack_channel')) {
        return { rows: queryResponses['ontology'] || queryResponses['services'] || [] };
      }
      // resolveDomainContext: 2차 incubator_sessions fallback
      if (sql.includes('incubator_sessions') && sql.includes('i.service_id')) {
        return { rows: queryResponses['incubatorFallback'] || [] };
      }
      return { rows: [] };
    }),
  } as any;
}

describe('Router — Phase 5: projectType propagation', () => {
  describe('projectType in RouteResult', () => {
    it('should include projectType from ontology entity_type', async () => {
      const pool = createMockPool({
        ontology: [
          {
            domain: 'test-svc',
            description: 'TestSvc',
            entity_type: 'module',
            service_id: 'svc-1',
            project_name: 'TestSvc',
            current_phase: 3,
            infra_phase: 0,
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '뭔가 확인');
      expect(result.projectType).toBe('module');
    });

    it('should default projectType to "unknown" when ontology has no entity_type', async () => {
      const pool = createMockPool({
        ontology: [
          {
            domain: 'test-svc',
            description: 'TestSvc',
            entity_type: null,
            service_id: 'svc-1',
            project_name: 'TestSvc',
            current_phase: 3,
            infra_phase: 0,
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '안녕하세요');
      expect(result.projectType).toBe('unknown');
    });

    it('should propagate projectType in route-tag result', async () => {
      const pool = createMockPool({
        ontology: [
          {
            domain: 'test-svc',
            description: 'TestSvc',
            entity_type: 'platform',
            service_id: 'svc-1',
            project_name: 'TestSvc',
            current_phase: 0,
            infra_phase: 0,
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
        ontology: [
          {
            domain: 'test-svc',
            description: 'TestSvc',
            entity_type: 'module',
            service_id: 'svc-1',
            project_name: 'TestSvc',
            current_phase: 3,
            infra_phase: 0,
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
      const pool = createMockPool({ ontology: [] });
      const router = new Router(pool);
      const result = await router.route('C_UNKNOWN', '안녕하세요');
      expect(result.routeReason).toBe('fallback');
      expect(result.projectType).toBe('unknown');
    });

    it('should propagate projectType in sprint workflow routing', async () => {
      const pool = createMockPool({
        ontology: [
          {
            domain: 'test-svc',
            description: 'TestSvc',
            entity_type: 'platform',
            service_id: 'svc-1',
            project_name: 'TestSvc',
            current_phase: 3,
            infra_phase: 0,
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '스프린트 시작');
      expect(result.workflow).toBe('sprint');
      expect(result.projectType).toBe('platform');
    });
  });

  describe('domain-matched routing (non-service domains)', () => {
    it('should route to semiclaw with domain-matched when ontology has no phase', async () => {
      const pool = createMockPool({
        ontology: [
          {
            domain: 'trade-corp',
            description: '무역회사',
            entity_type: 'organization',
            service_id: null,
            project_name: null,
            current_phase: null,
            infra_phase: 0,
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_TRADE', '재고 현황 알려줘');
      expect(result.routeReason).toBe('domain-matched');
      expect(result.botId).toBe('semiclaw');
      expect(result.serviceDomain).toBe('trade-corp');
      expect(result.projectType).toBe('organization');
      expect(result.phase).toBe(-1);
      expect(result.serviceId).toBe('');
    });

    it('should use phase-based routing when ontology domain has services phase', async () => {
      const pool = createMockPool({
        ontology: [
          {
            domain: 'axoracle',
            description: 'AXOracle',
            entity_type: 'service',
            service_id: 'svc-ax',
            project_name: 'AXOracle',
            current_phase: 7,
            infra_phase: 1,
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_AX', '빌드 상태 확인');
      expect(result.routeReason).toBe('phase-based');
      expect(result.botId).toBe('workclaw');
      expect(result.serviceDomain).toBe('axoracle');
      expect(result.phase).toBe(7);
      expect(result.serviceId).toBe('svc-ax');
    });

    it('should fallback to incubator_sessions when ontology has no match', async () => {
      const pool = createMockPool({
        ontology: [],
        incubatorFallback: [
          {
            inc_service_id: 'inc-1',
            service_name: 'NewProject',
            service_id: 'svc-new',
            service_domain: 'new-project',
            project_name: 'NewProject',
            current_phase: 0,
            infra_phase: 0,
            entity_type: 'service',
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_INC', '진행 상황');
      expect(result.serviceDomain).toBe('new-project');
      expect(result.serviceId).toBe('svc-new');
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
