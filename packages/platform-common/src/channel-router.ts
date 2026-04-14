import { Pool } from 'pg';
import type { RouteResult, ProjectContext } from './channel-types';
import { loadRoutingConfig, type RoutingConfig } from './kb-routing';

// 채널 → 도메인 매핑 캐시 (ontology 기반, services LEFT JOIN)
interface DomainContext {
  domain: string; // ontology.domain (보편적 식별자)
  displayName: string; // ontology.description || services.project_name
  entityType: string; // ontology.entity_type
  serviceId?: string; // services 있을 때만 (IT서비스 Plugin 전용)
  currentPhase?: number; // services 있을 때만
  infraPhase?: number; // services 있을 때만
}

export class Router {
  private pool: Pool;
  private channelCache = new Map<string, DomainContext>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 60_000; // 1분

  // Thread stickiness: 같은 스레드 내 후속 메시지는 이전 봇으로 라우팅
  private threadBotCache = new Map<string, { botId: string; expiresAt: number }>();
  private readonly THREAD_TTL = 30 * 60_000; // 30분

  // KB-driven routing config (5분 TTL 캐시)
  private routingConfig: RoutingConfig | null = null;
  private readonly ROUTING_TTL = 5 * 60_000;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /** 부트 시 라우팅 설정 프리로드 */
  async loadRouting(): Promise<void> {
    this.routingConfig = await loadRoutingConfig(this.pool);
  }

  /** 캐시된 config 반환, TTL 만료 시 리로드 */
  private async getConfig(): Promise<RoutingConfig> {
    if (this.routingConfig && Date.now() - this.routingConfig.loadedAt < this.ROUTING_TTL) {
      return this.routingConfig;
    }
    try {
      this.routingConfig = await loadRoutingConfig(this.pool);
      return this.routingConfig;
    } catch (err) {
      console.error('[router] Failed to reload routing config:', err);
      if (this.routingConfig) return this.routingConfig; // stale cache fallback
      throw err;
    }
  }

  /** 스레드 → 봇 매핑 저장 (dispatch 후 호출) */
  setThreadBot(threadTs: string, botId: string): void {
    this.threadBotCache.set(threadTs, {
      botId,
      expiresAt: Date.now() + this.THREAD_TTL,
    });
    // TTL 만료된 캐시 정리 (100개 초과 시)
    if (this.threadBotCache.size > 100) {
      const now = Date.now();
      for (const [key, val] of this.threadBotCache) {
        if (now >= val.expiresAt) this.threadBotCache.delete(key);
      }
    }
  }

  async route(
    channelId: string,
    text: string,
    threadTs?: string,
    guildId?: string,
  ): Promise<RouteResult> {
    const config = await this.getConfig();

    // 1. [Route: botId] 태그 직접 라우팅 (최우선)
    const routeTag = text.match(/\[Route:\s*(\w+)\]/);
    if (routeTag) {
      const candidate = routeTag[1].toLowerCase();
      const botId = config.validBotIds.includes(candidate) ? candidate : 'semiclaw';
      const ctx = await this.resolveDomainContext(channelId);
      return {
        botId,
        serviceId: ctx?.serviceId || '',
        serviceDomain: ctx?.domain || '',
        phase: ctx?.currentPhase ?? -1,
        track: 'plan',
        projectType: ctx?.entityType || 'service',
        routeReason: 'route-tag',
      };
    }

    // 2. 스레드 캐시: 같은 스레드 후속 메시지는 이전 봇 유지
    if (threadTs) {
      const cached = this.threadBotCache.get(threadTs);
      if (cached && Date.now() < cached.expiresAt) {
        const ctx = await this.resolveDomainContext(channelId);
        return {
          botId: cached.botId,
          serviceId: ctx?.serviceId || '',
          serviceDomain: ctx?.domain || '',
          phase: ctx?.currentPhase ?? -1,
          track: 'plan',
          projectType: ctx?.entityType || 'service',
          routeReason: 'thread-sticky',
        };
      }
    }

    // 3. 채널 → 도메인 리졸브 (Core: ontology 기반)
    const ctx = await this.resolveDomainContext(channelId);

    // 3.5. 인큐베이터 세션 라우팅: Slack channel 또는 Discord guild → incubator 에이전트
    if (config.validBotIds.includes('incubator')) {
      try {
        const incResult = await this.pool.query(
          `SELECT 1 FROM semo.incubator_sessions
           WHERE (channel = $1 OR discord_guild = $2) AND status = 'active' LIMIT 1`,
          [channelId, guildId || ''],
        );
        if (incResult.rows.length > 0) {
          return {
            botId: 'incubator',
            serviceId: ctx?.serviceId || '',
            serviceDomain: ctx?.domain || '',
            phase: ctx?.currentPhase ?? -1,
            track: 'plan',
            projectType: ctx?.entityType || 'service',
            routeReason: 'incubator-session',
          };
        }
      } catch {
        // DB 에러 시 fall-through to phase routing
      }
    }

    // 4. Sprint 워크플로우 감지
    const sprintFull = /스프린트\s*시작|sprint\s*start/i;
    const sprintQuick = /빠른\s*구현|quick\s*build/i;
    const sprintReview = /리뷰해줘\s*PR|review\s*PR/i;
    const sprintPreset = sprintFull.test(text)
      ? 'full'
      : sprintQuick.test(text)
        ? 'quick'
        : sprintReview.test(text)
          ? 'review-only'
          : null;
    if (sprintPreset) {
      return {
        botId: 'semiclaw',
        serviceId: ctx?.serviceId || '',
        serviceDomain: ctx?.domain || '',
        phase: ctx?.currentPhase ?? -1,
        track: 'plan',
        projectType: ctx?.entityType || 'service',
        routeReason: 'phase-based',
        workflow: 'sprint',
        workflowPreset: sprintPreset,
      };
    }

    // 5. Phase 기반 라우팅 — IT서비스(services 테이블에 phase가 있는 도메인)
    if (ctx?.currentPhase !== undefined && ctx.currentPhase >= 0) {
      const botId = config.phaseAssignees[ctx.currentPhase] || 'semiclaw';
      return {
        botId,
        serviceId: ctx.serviceId || '',
        serviceDomain: ctx.domain,
        phase: ctx.currentPhase,
        track: 'plan',
        projectType: ctx.entityType,
        routeReason: 'phase-based',
      };
    }

    // 5.5. 비-서비스 도메인 — domain은 있지만 phase가 없는 경우
    if (ctx) {
      return {
        botId: 'semiclaw',
        serviceId: ctx.serviceId || '',
        serviceDomain: ctx.domain,
        phase: -1,
        track: 'plan',
        projectType: ctx.entityType,
        routeReason: 'domain-matched',
      };
    }

    // 6. 폴백: 채널에 매핑된 도메인 없음
    return {
      botId: 'semiclaw',
      serviceId: '',
      serviceDomain: '',
      phase: -1,
      track: 'plan',
      projectType: 'unknown',
      routeReason: 'fallback',
    };
  }

  getProjectContext(route: RouteResult): ProjectContext | null {
    if (!route.serviceDomain) return null;
    return {
      domain: route.serviceDomain,
      projectType: route.projectType,
      metadata: {
        serviceId: route.serviceId,
        phase: route.phase,
        track: route.track,
      },
    };
  }

  private async resolveDomainContext(channelId: string): Promise<DomainContext | null> {
    const cached = this.channelCache.get(channelId);
    const expiry = this.cacheExpiry.get(channelId) || 0;
    if (cached && Date.now() < expiry) return cached;

    try {
      // 1차: ontology 기반 채널 매핑 (Core — 모든 도메인 타입)
      const result = await this.pool.query(
        `SELECT o.domain, o.description, o.entity_type,
                s.service_id::text AS service_id,
                s.project_name,
                s.current_phase, COALESCE(s.infra_phase, 0) AS infra_phase
         FROM semo.ontology o
         LEFT JOIN semo.services s ON s.service_domain = o.domain
         WHERE position($1 in o.slack_channel) > 0
            OR o.discord_channel = $1
         LIMIT 1`,
        [channelId],
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const ctx: DomainContext = {
          domain: row.domain,
          displayName: row.project_name || row.description || row.domain,
          entityType: row.entity_type || 'unknown',
          serviceId: row.service_id || undefined,
          currentPhase: row.current_phase ?? undefined,
          infraPhase: row.infra_phase ?? undefined,
        };
        this.channelCache.set(channelId, ctx);
        this.cacheExpiry.set(channelId, Date.now() + this.CACHE_TTL);
        return ctx;
      }

      // 2차: incubator_sessions fallback (아직 ontology 미등록 세션)
      const incResult = await this.pool.query(
        `SELECT i.service_id AS inc_service_id, i.service_name,
                s.service_id::text AS service_id, s.service_domain,
                s.project_name, s.current_phase,
                COALESCE(s.infra_phase, 0) AS infra_phase,
                COALESCE(o.entity_type, 'service') AS entity_type
         FROM semo.incubator_sessions i
         LEFT JOIN semo.services s ON starts_with(s.service_id::text, i.service_id)
         LEFT JOIN semo.ontology o ON o.domain = s.service_domain
         WHERE i.channel = $1 AND i.status = 'active'
         LIMIT 1`,
        [channelId],
      );

      if (incResult.rows.length > 0) {
        const row = incResult.rows[0];
        const ctx: DomainContext = {
          domain: row.service_domain || row.inc_service_id,
          displayName:
            row.project_name || row.service_name || row.service_domain || row.inc_service_id,
          entityType: row.entity_type || 'service',
          serviceId: row.service_id || undefined,
          currentPhase: row.current_phase ?? undefined,
          infraPhase: row.infra_phase ?? undefined,
        };
        this.channelCache.set(channelId, ctx);
        this.cacheExpiry.set(channelId, Date.now() + this.CACHE_TTL);
        return ctx;
      }

      return null;
    } catch (err) {
      console.error(`[router] resolveDomainContext failed for channel ${channelId}:`, err);
      return null;
    }
  }
}
