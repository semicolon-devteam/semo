/**
 * StaticRouter — Personal 프로파일용 DB 비의존 라우터
 *
 * Postgres 기반 `Router` 와 달리:
 *   - knowledge_base / bot_status / bot_delegation / ontology 쿼리 없음
 *   - 단일 default bot 으로 폴백
 *   - `[Route: botId]` 태그는 여전히 존중 (validBotIds 내에 있으면)
 *   - thread-sticky 캐시 (in-memory) 는 유지
 *
 * Personal(solo-offline/solo-connected) 프로파일에서 `loadRoutingConfig()` 는
 * PG 가 없으면 실패하므로, 대신 이 클래스를 쓰면 SQLite 환경에서도 Discord 라우터가 기동된다.
 */
import type { RouteResult, ProjectContext } from '../slack/channel-types.js';

export interface StaticRouterOptions {
  /** 폴백 대상 봇 — 모든 메시지가 기본적으로 여기로 간다. */
  defaultBotId: string;
  /** 허용 봇 목록. `[Route: botId]` 태그 검증용. 생략 시 defaultBotId 만 허용. */
  validBotIds?: string[];
  /** 별칭 맵 (nickname → canonical). 생략 시 빈 맵. */
  aliases?: Record<string, string>;
  /** 스레드 sticky TTL(ms). default 30분. */
  threadTtlMs?: number;
}

export class StaticRouter {
  private readonly defaultBotId: string;
  private readonly validBotIds: string[];
  private readonly aliases: Record<string, string>;
  private readonly threadTtl: number;

  private threadBotCache = new Map<string, { botId: string; expiresAt: number }>();

  constructor(opts: StaticRouterOptions) {
    this.defaultBotId = opts.defaultBotId;
    this.validBotIds =
      opts.validBotIds && opts.validBotIds.length > 0 ? opts.validBotIds : [opts.defaultBotId];
    this.aliases = opts.aliases ?? {};
    this.threadTtl = opts.threadTtlMs ?? 30 * 60_000;
  }

  /** no-op: 정적 라우터는 프리로드할 DB 상태가 없음. */
  async loadRouting(): Promise<void> {
    return;
  }

  setThreadBot(threadKey: string, botId: string): void {
    this.threadBotCache.set(threadKey, {
      botId,
      expiresAt: Date.now() + this.threadTtl,
    });
    if (this.threadBotCache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.threadBotCache) {
        if (now >= v.expiresAt) this.threadBotCache.delete(k);
      }
    }
  }

  private resolveAlias(id: string): string {
    return this.aliases[id] ?? id;
  }

  async route(
    _channelId: string,
    text: string,
    threadTs?: string,
    _guildId?: string,
  ): Promise<RouteResult> {
    // 1. [Route: botId] 명시 라우팅
    const routeTag = text.match(/\[Route:\s*(\w+)\]/);
    if (routeTag) {
      const candidate = this.resolveAlias(routeTag[1].toLowerCase());
      const botId = this.validBotIds.includes(candidate) ? candidate : this.defaultBotId;
      return this.buildResult(botId, 'route-tag');
    }

    // 2. thread-sticky
    if (threadTs) {
      const cached = this.threadBotCache.get(threadTs);
      if (cached && Date.now() < cached.expiresAt) {
        return this.buildResult(cached.botId, 'thread-sticky');
      }
    }

    // 3. default fallback
    return this.buildResult(this.defaultBotId, 'fallback');
  }

  getProjectContext(_route: RouteResult): ProjectContext | null {
    return null;
  }

  private buildResult(botId: string, reason: RouteResult['routeReason']): RouteResult {
    return {
      botId,
      serviceId: '',
      serviceDomain: '',
      phase: -1,
      track: 'plan',
      projectType: 'personal',
      routeReason: reason,
    };
  }
}
