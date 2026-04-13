import { Pool } from 'pg';
import type { RouteResult } from './types';
import { loadRoutingConfig, type RoutingConfig } from './kb-routing';

// 채널 → 서비스 매핑 캐시
interface ServiceInfo {
  serviceId: string;
  serviceName: string;
  serviceDomain: string;
  currentPhase: number;
  infraPhase: number;
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
          routeReason: 'thread-sticky',
        };
      }
    }

    // 3. 채널 → 서비스 조회
    const service = await this.getServiceInfo(channelId);

    // 4. 스킬 디스패치 (키워드 분기보다 우선)
    for (const { pattern, botId, skill } of config.skillRoutes) {
      if (pattern.test(text)) {
        return {
          botId,
          serviceId: service?.serviceId || '',
          serviceDomain: service?.serviceDomain || '',
          phase: service?.currentPhase ?? -1,
          track: 'plan',
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
      routeReason: 'fallback',
    };
  }

  private async getServiceInfo(channelId: string): Promise<ServiceInfo | null> {
    // 캐시 확인
    const cached = this.channelCache.get(channelId);
    const expiry = this.cacheExpiry.get(channelId) || 0;
    if (cached && Date.now() < expiry) return cached;

    try {
      // incubator_sessions에서 채널 → 서비스 매핑
      const sessionResult = await this.pool.query(
        `SELECT service_id, service_name FROM semo.incubator_sessions WHERE channel = $1 AND status = 'active' LIMIT 1`,
        [channelId],
      );
      if (sessionResult.rows.length === 0) return null;

      const { service_id, service_name } = sessionResult.rows[0];

      // services에서 현재 Phase 조회 (incubator_sessions의 service_id가 short hash일 수 있으므로 LIKE 매칭)
      const serviceResult = await this.pool.query(
        `SELECT service_id::text as full_service_id, current_phase, COALESCE(infra_phase, 0) as infra_phase, COALESCE(service_domain, $2) as service_domain FROM semo.services WHERE service_id::text LIKE $1 || '%'`,
        [service_id, service_name.toLowerCase().replace(/\s+/g, '-')],
      );

      const row = serviceResult.rows[0];
      const info: ServiceInfo = {
        serviceId: row?.full_service_id || service_id,
        serviceName: service_name,
        serviceDomain: row?.service_domain || service_name.toLowerCase(),
        currentPhase: row?.current_phase ?? 0,
        infraPhase: row?.infra_phase ?? 0,
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
