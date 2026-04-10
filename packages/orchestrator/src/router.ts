import { Pool } from 'pg';
import type { RouteResult } from './types';
import { BOT_IDS } from './bot-config';
import type { BotId } from './bot-config';

// Phase → Bot 매핑 (packages/semo-dashboard/lib/gfp-phases.ts 기반)
const PHASE_ASSIGNEES: Record<number, BotId> = {
  0: 'semiclaw', // Onboarding
  1: 'planclaw', // Discovery
  2: 'planclaw', // PRD
  3: 'planclaw', // Clarification
  4: 'designclaw', // Design System
  5: 'planclaw', // Epic
  6: 'planclaw', // Functional Spec
  7: 'workclaw', // Technical Plan
  8: 'workclaw', // Task Breakdown
  9: 'planclaw', // Handoff
};

const INFRA_PHASE_ASSIGNEES: Record<number, BotId> = {
  0: 'infraclaw',
  1: 'infraclaw',
  2: 'infraclaw',
};

// 키워드 → 봇 매핑 (구체적 패턴이 일반 패턴보다 우선)
const KEYWORD_ROUTES: Array<{ keywords: RegExp; botId: BotId }> = [
  {
    keywords: /stitch.*리뷰.*완료|스티치.*리뷰.*완료|스티치.*완료|디자인.*승인/i,
    botId: 'designclaw',
  },
  { keywords: /인프라|배포|cicd|deploy|서버|쿠버|k8s|docker|argocd/i, botId: 'infraclaw' },
  { keywords: /디자인|ui|ux|컬러|폰트|레이아웃|tailwind|css|퍼블리싱/i, botId: 'designclaw' },
  { keywords: /리뷰|review|qa|테스트|test|버그|bug|품질/i, botId: 'reviewclaw' },
  {
    keywords:
      /마케팅|seo|그로스|트래픽|전환율|키워드|콘텐츠|광고|트래킹|커뮤니티.*게시|백링크|조회수/i,
    botId: 'growthclaw',
  },
  { keywords: /코딩|구현|개발|코드|fix|feature|pr\b|풀리퀘/i, botId: 'workclaw' },
  { keywords: /기획|스펙|prd|요구사항|epic|유저스토리|플로우/i, botId: 'planclaw' },
];

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
  private threadBotCache = new Map<string, { botId: BotId; expiresAt: number }>();
  private readonly THREAD_TTL = 30 * 60_000; // 30분

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /** 스레드 → 봇 매핑 저장 (dispatch 후 호출) */
  setThreadBot(threadTs: string, botId: BotId): void {
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
    // 1. [Route: botId] 태그 직접 라우팅 (최우선)
    const routeTag = text.match(/\[Route:\s*(\w+)\]/);
    if (routeTag) {
      const candidate = routeTag[1].toLowerCase();
      const botId: BotId = (BOT_IDS as readonly string[]).includes(candidate)
        ? (candidate as BotId)
        : 'semiclaw';
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

    // 4. 키워드 분기
    for (const { keywords, botId } of KEYWORD_ROUTES) {
      if (keywords.test(text)) {
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

    // 4. Phase 기반 라우팅
    if (service) {
      // 인프라 관련 키워드 없으면 Track A(plan) 기반
      const botId = PHASE_ASSIGNEES[service.currentPhase] || 'semiclaw';
      return {
        botId,
        serviceId: service.serviceId,
        serviceDomain: service.serviceDomain,
        phase: service.currentPhase,
        track: 'plan',
        routeReason: 'phase-based',
      };
    }

    // 5. 폴백: semiclaw
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
