/**
 * Semi 오케스트레이터 응답의 ROUTE 지시 파싱 (순수 함수).
 * 한 응답에 여러 ROUTE/REASON/HANDOFF 블록이 있으면 **모두** 추출 → 다중 fan-out 위임 지원.
 */
export interface RouteTarget {
  bot: string;
  reason: string | null;
  handoff: string | null;
}

export interface ParsedRoute {
  kind: 'route';
  bot: string | null; // routes[0] (하위호환)
  reason: string | null;
  handoff: string | null;
  routes: RouteTarget[]; // 다중 ROUTE fan-out
}

export function parseRouteResponse(text: string): ParsedRoute {
  const lines = text.split(/\r?\n/);
  const routes: RouteTarget[] = [];
  let cur: { bot: string | null; reason: string | null; handoffLines: string[] } | null = null;
  let handoffStarted = false;
  const flush = (): void => {
    if (cur?.bot) {
      routes.push({
        bot: cur.bot,
        reason: cur.reason,
        handoff: cur.handoffLines.length > 0 ? cur.handoffLines.join('\n').trim() : null,
      });
    }
  };
  for (const line of lines) {
    const m = line.match(/^\s*(ROUTE|REASON|HANDOFF)\s*:\s*(.*)$/i);
    if (!m) {
      if (handoffStarted && cur) cur.handoffLines.push(line);
      continue;
    }
    const tag = m[1].toUpperCase();
    const value = m[2].trim();
    if (tag === 'ROUTE') {
      flush(); // 이전 블록 확정 → 다음 ROUTE 부터 새 블록
      cur = {
        bot:
          value
            .replace(/[`@*<>]/g, '')
            .split(/\s+/)[0]
            ?.toLowerCase() || null,
        reason: null,
        handoffLines: [],
      };
      handoffStarted = false;
    } else if (tag === 'REASON') {
      if (cur) cur.reason = value;
    } else if (tag === 'HANDOFF') {
      handoffStarted = true;
      if (cur && value) cur.handoffLines.push(value);
    }
  }
  flush();
  const first = routes[0];
  return {
    kind: 'route',
    bot: first?.bot ?? null,
    reason: first?.reason ?? null,
    handoff: first?.handoff ?? null,
    routes,
  };
}
