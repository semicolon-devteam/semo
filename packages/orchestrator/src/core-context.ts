/**
 * CoreContextProvider — 비-서비스 도메인(organization, team, module 등)용 컨텍스트.
 * services 테이블에 없는 ontology 도메인에 대해 KB 조회 가이드를 제공.
 */

import type { RouteResult, ContextProvider } from './types';

export class CoreContextProvider implements ContextProvider {
  buildContext(route: RouteResult, _botId: string): string {
    if (!route.serviceDomain) return '';

    return [
      `[도메인 컨텍스트]`,
      `도메인: ${route.serviceDomain}`,
      `타입: ${route.projectType}`,
      ``,
      `## Data Routing`,
      `- KB 조회: semo kb get ${route.serviceDomain} base-information`,
      `- KB 검색: semo kb search "키워드" --domain ${route.serviceDomain}`,
      `- 액션 아이템: semo action-items list --owner ${route.serviceDomain}`,
    ].join('\n');
  }
}
