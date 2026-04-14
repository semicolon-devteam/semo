import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../router';

function createMockPool(queryResponses: Record<string, any[]> = {}) {
  return {
    query: vi.fn(async (sql: string, params: any[]) => {
      // KB routing config: bot_status
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
      // KB routing config: phase assignments from knowledge_base role entries
      if (sql.includes('knowledge_base') && sql.includes('role')) {
        return { rows: queryResponses['kbRoles'] || [] };
      }
      // KB routing config: keyword/skill delegation
      if (sql.includes('bot_delegation') && sql.includes('skill-routing')) {
        return { rows: queryResponses['skillDelegation'] || [] };
      }
      if (sql.includes('bot_delegation')) {
        return {
          rows: queryResponses['delegation'] || [
            {
              to_bot_id: 'infraclaw',
              domains: ['인프라', '배포', '서버', 'CI', 'CD', 'DevOps', 'k8s', '쿠버네티스'],
              metadata: { order: 1 },
            },
            {
              to_bot_id: 'designclaw',
              domains: ['디자인', 'UI', 'UX', '피그마', 'Figma', '시각'],
              metadata: { order: 2 },
            },
            {
              to_bot_id: 'reviewclaw',
              domains: ['리뷰', 'review', 'PR 리뷰', '코드리뷰'],
              metadata: { order: 3 },
            },
            {
              to_bot_id: 'growthclaw',
              domains: ['SEO', '마케팅', 'GA4', '그로스', '키워드'],
              metadata: { order: 4 },
            },
            {
              to_bot_id: 'workclaw',
              domains: ['구현', 'feature', '기능', '코딩', '버그'],
              metadata: { order: 5 },
            },
            {
              to_bot_id: 'planclaw',
              domains: ['PRD', '기획', '스펙', '요구사항'],
              metadata: { order: 6 },
            },
          ],
        };
      }
      // Step 3.5: incubator session check (SELECT 1)
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

  describe('sprint workflow routing', () => {
    it.each([
      ['스프린트 시작해줘', 'full'],
      ['sprint start 진행', 'full'],
      ['빠른 구현 부탁', 'quick'],
      ['quick build this', 'quick'],
      ['리뷰해줘 PR #42', 'review-only'],
      ['review PR please', 'review-only'],
    ])('"%s" → sprint preset %s', async (text, expectedPreset) => {
      const pool = createMockPool();
      const router = new Router(pool);
      const result = await router.route('C_UNKNOWN', text);
      expect(result.workflow).toBe('sprint');
      expect(result.workflowPreset).toBe(expectedPreset);
      expect(result.botId).toBe('semiclaw');
    });

    it('should not trigger sprint for unrelated messages', async () => {
      const pool = createMockPool();
      const router = new Router(pool);
      const result = await router.route('C_UNKNOWN', '안녕하세요');
      expect(result.workflow).toBeUndefined();
    });
  });

  describe('phase-based routing', () => {
    it('should route Phase 0 to semiclaw', async () => {
      const pool = createMockPool({
        services: [
          {
            domain: 'test-svc',
            description: 'TestSvc',
            entity_type: 'service',
            service_id: 'svc-1',
            project_name: 'TestSvc',
            current_phase: 0,
            infra_phase: 0,
          },
        ],
        kbRoles: [
          {
            bot_id: 'semiclaw',
            content: '### GFP Phase 담당\n| Phase | Name |\n| 0 | Onboarding |',
          },
          {
            bot_id: 'planclaw',
            content:
              '### GFP Phase 담당\n| Phase | Name |\n| 1 | Discovery |\n| 2 | PRD |\n| 3 | Review |\n| 5 | Planning |\n| 6 | Sprint |\n| 9 | Closing |',
          },
          { bot_id: 'designclaw', content: '### GFP Phase 담당\n| Phase | Name |\n| 4 | Design |' },
          {
            bot_id: 'workclaw',
            content: '### GFP Phase 담당\n| Phase | Name |\n| 7 | Dev |\n| 8 | Test |',
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '프로젝트 시작하자');
      expect(result.botId).toBe('semiclaw');
      expect(result.routeReason).toBe('phase-based');
      expect(result.phase).toBe(0);
    });

    it('should route Phase 4 to designclaw', async () => {
      const pool = createMockPool({
        services: [
          {
            domain: 'seum',
            description: 'SEUM',
            entity_type: 'service',
            service_id: 'svc-1',
            project_name: 'SEUM',
            current_phase: 4,
            infra_phase: 0,
          },
        ],
        kbRoles: [
          { bot_id: 'designclaw', content: '### GFP Phase 담당\n| Phase | Name |\n| 4 | Design |' },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '어떤 작업이든');
      expect(result.botId).toBe('designclaw');
      expect(result.serviceDomain).toBe('seum');
    });

    it('should route Phase 7 to workclaw', async () => {
      const pool = createMockPool({
        services: [
          {
            domain: 'pat',
            description: 'PAT',
            entity_type: 'service',
            service_id: 'svc-1',
            project_name: 'PAT',
            current_phase: 7,
            infra_phase: 0,
          },
        ],
        kbRoles: [
          {
            bot_id: 'workclaw',
            content: '### GFP Phase 담당\n| Phase | Name |\n| 7 | Dev |\n| 8 | Test |',
          },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '기술 설계 검토');
      expect(result.botId).toBe('workclaw');
    });
  });

  describe('all phase mappings', () => {
    const kbRoles = [
      { bot_id: 'semiclaw', content: '### GFP Phase 담당\n| Phase | Name |\n| 0 | Onboarding |' },
      {
        bot_id: 'planclaw',
        content:
          '### GFP Phase 담당\n| Phase | Name |\n| 1 | Discovery |\n| 2 | PRD |\n| 3 | Review |\n| 5 | Planning |\n| 6 | Sprint |\n| 9 | Closing |',
      },
      { bot_id: 'designclaw', content: '### GFP Phase 담당\n| Phase | Name |\n| 4 | Design |' },
      {
        bot_id: 'workclaw',
        content: '### GFP Phase 담당\n| Phase | Name |\n| 7 | Dev |\n| 8 | Test |',
      },
    ];
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
        services: [
          {
            domain: 'test',
            description: 'Test',
            entity_type: 'service',
            service_id: 'svc',
            project_name: 'Test',
            current_phase: phase,
            infra_phase: 0,
          },
        ],
        kbRoles,
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '일반 메시지');
      expect(result.botId).toBe(expectedBot);
    });
  });

  describe('sprint priority', () => {
    it('sprint trigger takes precedence over phase routing', async () => {
      const pool = createMockPool({
        services: [
          {
            domain: 'test',
            description: 'Test',
            entity_type: 'service',
            service_id: 'svc-1',
            project_name: 'Test',
            current_phase: 4,
            infra_phase: 0,
          },
        ],
        kbRoles: [
          { bot_id: 'designclaw', content: '### GFP Phase 담당\n| Phase | Name |\n| 4 | Design |' },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_PROJ', '스프린트 시작해줘');
      expect(result.workflow).toBe('sprint');
      expect(result.botId).toBe('semiclaw');
    });
  });

  describe('fallback', () => {
    it('should fallback to semiclaw when no service found', async () => {
      const pool = createMockPool({ services: [] });
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

  describe('thread stickiness', () => {
    it('should route follow-up messages in same thread to the same bot', async () => {
      const pool = createMockPool();
      const router = new Router(pool);

      // Simulate first dispatch → infraclaw via route-tag
      const first = await router.route(
        'C_UNKNOWN',
        '[Route: infraclaw] 인프라 점검해줘',
        '1234.5678',
      );
      expect(first.botId).toBe('infraclaw');

      // Record the thread→bot mapping (normally done by dispatch layer)
      router.setThreadBot('1234.5678', 'infraclaw');

      // Follow-up in same thread — should stick to infraclaw
      const second = await router.route('C_UNKNOWN', '그거 언제 끝나?', '1234.5678');
      expect(second.botId).toBe('infraclaw');
      expect(second.routeReason).toBe('thread-sticky');
    });

    it('should not apply thread stickiness to a different thread', async () => {
      const pool = createMockPool();
      const router = new Router(pool);

      router.setThreadBot('1111.0000', 'designclaw');

      // Different thread — should NOT be sticky
      const result = await router.route('C_UNKNOWN', '안녕하세요', '9999.0000');
      expect(result.botId).toBe('semiclaw');
      expect(result.routeReason).toBe('fallback');
    });

    it('[Route:] tag should override thread stickiness', async () => {
      const pool = createMockPool();
      const router = new Router(pool);

      router.setThreadBot('1234.5678', 'infraclaw');

      // Explicit route tag overrides sticky
      const result = await router.route(
        'C_UNKNOWN',
        '[Route: workclaw] 이거 구현해줘',
        '1234.5678',
      );
      expect(result.botId).toBe('workclaw');
      expect(result.routeReason).toBe('route-tag');
    });
  });

  describe('incubator session routing', () => {
    it('should route to incubator when active session exists for channel', async () => {
      const pool = createMockPool({
        services: [
          {
            domain: 'new-startup',
            description: 'NewStartup',
            entity_type: 'service',
            service_id: 'svc-inc',
            project_name: 'NewStartup',
            current_phase: 1,
            infra_phase: 0,
          },
        ],
        incubator: [{ '?column?': 1 }], // SELECT 1 returns a row
      });
      const router = new Router(pool);
      const result = await router.route('C_INCUBATOR', '프로젝트 진행상황 알려줘');
      expect(result.botId).toBe('incubator');
      expect(result.serviceDomain).toBe('new-startup');
    });

    it('should NOT route to incubator when no active session', async () => {
      const pool = createMockPool({
        services: [
          {
            domain: 'regular',
            description: 'RegularSvc',
            entity_type: 'service',
            service_id: 'svc-1',
            project_name: 'RegularSvc',
            current_phase: 2,
            infra_phase: 0,
          },
        ],
        incubator: [], // no active session
        kbRoles: [
          { bot_id: 'planclaw', content: '### GFP Phase 담당\n| Phase | Name |\n| 2 | PRD |' },
        ],
      });
      const router = new Router(pool);
      const result = await router.route('C_REGULAR', '일반 메시지');
      expect(result.botId).toBe('planclaw');
      expect(result.routeReason).toBe('phase-based');
    });
  });

  describe('caching', () => {
    it('should cache service info and not re-query within TTL', async () => {
      const pool = createMockPool({
        ontology: [
          {
            domain: 'test-svc',
            description: 'TestSvc',
            entity_type: 'service',
            service_id: 'svc-1',
            project_name: 'TestSvc',
            current_phase: 1,
            infra_phase: 0,
          },
        ],
        kbRoles: [
          {
            bot_id: 'planclaw',
            content: '### GFP Phase 담당\n| Phase | Name |\n| 1 | Discovery |',
          },
        ],
      });
      const router = new Router(pool);

      await router.route('C_PROJ', 'first');
      await router.route('C_PROJ', 'second');

      // ontology 쿼리는 1번만 호출되어야 함 (캐시 적중)
      const ontologyCalls = pool.query.mock.calls.filter(
        (c: any[]) => c[0].includes('semo.ontology') && c[0].includes('o.slack_channel'),
      );
      expect(ontologyCalls).toHaveLength(1);
    });
  });
});
