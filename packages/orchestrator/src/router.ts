import { Pool } from 'pg';
import type { RouteResult, ProjectContext } from './types';
import { loadRoutingConfig, type RoutingConfig } from './kb-routing';

// 채널 → 프로젝트 매핑 캐시
interface ServiceInfo {
  serviceId: string;
  serviceName: string;
  serviceDomain: string;
  currentPhase: number;
  infraPhase: number;
  projectType: string;
}

export class Router {
  private pool: Pool;
  private channelCache = new Map<string, ServiceInfo>();
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

  async route(channelId: string, text: string, threadTs?: string): Promise<RouteResult> {
    const config = await this.getConfig();

    // 1. [Route: botId] 태그 직접 라우팅 (최우선)
    const routeTag = text.match(/\[Route:\s*(\w+)\]/);
    if (routeTag) {
      const candidate = routeTag[1].toLowerCase();
      const botId = config.validBotIds.includes(candidate) ? candidate : 'semiclaw';
      const service = await this.getServiceInfo(channelId);
      return {
        botId,
        serviceId: service?.serviceId || '',
        serviceDomain: service?.serviceDomain || '',
        phase: service?.currentPhase ?? -1,
        track: 'plan',
        projectType: service?.projectType || 'service',
        routeReason: 'route-tag',
      };
    }

    // 2. 스레드 캐시: 같은 스레드 후속 메시지는 이전 봇 유지
    if (threadTs) {
      const cached = this.threadBotCache.get(threadTs);
      if (cached && Date.now() < cached.expiresAt) {
        const service = await this.getServiceInfo(channelId);
        return {
          botId: cached.botId,
          serviceId: service?.serviceId || '',
          serviceDomain: service?.serviceDomain || '',
          phase: service?.currentPhase ?? -1,
          track: 'plan',
          projectType: service?.projectType || 'service',
          routeReason: 'thread-sticky',
        };
      }
    }

    // 3. 채널 → 서비스 조회
    const service = await this.getServiceInfo(channelId);

    // 3.5. 인큐베이터 세션 라우팅: active incubator_sessions 채널 → incubator 에이전트
    if (service && config.validBotIds.includes('incubator')) {
      try {
        const incResult = await this.pool.query(
          `SELECT 1 FROM semo.incubator_sessions WHERE channel = $1 AND status = 'active' LIMIT 1`,
          [channelId],
        );
        if (incResult.rows.length > 0) {
          return {
            botId: 'incubator',
            serviceId: service.serviceId,
            serviceDomain: service.serviceDomain,
            phase: service.currentPhase,
            track: 'plan',
            projectType: service.projectType,
            routeReason: 'keyword',
          };
        }
      } catch {
        // DB 에러 시 fall-through to keyword/phase routing
      }
    }

    // 4. 스킬 디스패치 (키워드 분기보다 우선)
    for (const { pattern, botId, skill } of config.skillRoutes) {
      if (pattern.test(text)) {
        return {
          botId,
          serviceId: service?.serviceId || '',
          serviceDomain: service?.serviceDomain || '',
          phase: service?.currentPhase ?? -1,
          track: 'plan',
          projectType: service?.projectType || 'service',
          routeReason: 'skill-dispatch',
          skillHint: skill,
        };
      }
    }

    // 5. 키워드 분기
    for (const { pattern, botId } of config.keywordRoutes) {
      if (pattern.test(text)) {
        return {
          botId,
          serviceId: service?.serviceId || '',
          serviceDomain: service?.serviceDomain || '',
          phase: service?.currentPhase ?? -1,
          track: 'plan',
          projectType: service?.projectType || 'service',
          routeReason: 'keyword',
        };
      }
    }

    // 6. Phase 기반 라우팅
    if (service) {
      const botId = config.phaseAssignees[service.currentPhase] || 'semiclaw';
      return {
        botId,
        serviceId: service.serviceId,
        serviceDomain: service.serviceDomain,
        phase: service.currentPhase,
        track: 'plan',
        projectType: service.projectType,
        routeReason: 'phase-based',
      };
    }

    // 7. 폴백: semiclaw
    return {
      botId: 'semiclaw',
      serviceId: '',
      serviceDomain: '',
      phase: -1,
      track: 'plan',
      projectType: 'service',
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

  private async getServiceInfo(channelId: string): Promise<ServiceInfo | null> {
    const cached = this.channelCache.get(channelId);
    const expiry = this.cacheExpiry.get(channelId) || 0;
    if (cached && Date.now() < expiry) return cached;

    try {
      const result = await this.pool.query(
        `SELECT s.service_id::text as full_service_id, s.project_name, s.service_domain,
                s.current_phase, COALESCE(s.infra_phase, 0) as infra_phase,
                COALESCE(o.entity_type, 'service') as project_type
         FROM semo.services s
         LEFT JOIN semo.ontology o ON o.domain = s.service_domain
         WHERE position($1 in s.slack_channel) > 0
            OR s.discord_channel = $1

         UNION ALL

         SELECT s.service_id::text, s.project_name, s.service_domain,
                s.current_phase, COALESCE(s.infra_phase, 0),
                COALESCE(o.entity_type, 'service')
         FROM semo.incubator_sessions i
         JOIN semo.services s ON starts_with(s.service_id::text, i.service_id)
         LEFT JOIN semo.ontology o ON o.domain = s.service_domain
         WHERE i.channel = $1 AND i.status = 'active'

         LIMIT 1`,
        [channelId],
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const info: ServiceInfo = {
        serviceId: row.full_service_id,
        serviceName: row.project_name || row.service_domain,
        serviceDomain: row.service_domain || '',
        currentPhase: row.current_phase ?? 0,
        infraPhase: row.infra_phase ?? 0,
        projectType: row.project_type || 'service',
      };

      this.channelCache.set(channelId, info);
      this.cacheExpiry.set(channelId, Date.now() + this.CACHE_TTL);
      return info;
    } catch (err) {
      console.error(`[router] DB query failed for channel ${channelId}:`, err);
      return null;
    }
  }
}
