/**
 * Colony 일일 채널 digest — **Colony 자신의 런타임**에서 독립 실행.
 *
 * semiclaw cron 서브에이전트가 아니라, slack-router 안의 Colony 머신러리(컨텍스트 수집기 옆)가
 * 매일 1회 돌린다. 추출 추론은 **Colony 자신의 hermes 프로파일(semo-colony)** 이 수행하고,
 * 라우터는 열거/수집/KB write(IO)만 담당한다. → Colony 는 semiclaw 에 의존하지 않는다.
 *
 * 흐름: Colony 참여 채널 ∩ channel_domain_map(ingest) → 채널별 어제 메시지 수집
 *       → Colony hermes 가 decision/blocker/action 추출(JSON) → 도메인별 KB/action_items write.
 *
 * 설계: docs/superpowers/specs/2026-06-03-colony-daily-digest-design.md
 */

export interface DigestMessage {
  ts: string;
  user: string;
  text: string;
}

export interface ExtractedDecision {
  slug: string;
  title: string;
  decided_by?: string;
  body: string;
}
export interface ExtractedBlocker {
  slug: string;
  title: string;
  body: string;
}
export interface ExtractedAction {
  description: string;
  owner?: string;
  deadline?: string;
}
export interface DigestExtraction {
  decisions: ExtractedDecision[];
  blockers: ExtractedBlocker[];
  actions: ExtractedAction[];
}

/** Colony hermes 에게 줄 추출 프롬프트. 결과는 DIGEST_JSON 펜스 블록으로 받는다. */
export function buildDigestExtractionPrompt(
  channelName: string,
  domain: string,
  messages: DigestMessage[],
): string {
  const lines = messages.map((m) => `- [${m.ts}] ${m.user}: ${m.text}`).join('\n');
  return [
    `# 채널 일일 정리 작업 (#${channelName} → 도메인 ${domain})`,
    '아래는 이 채널의 어제 사람 메시지다. 팀 지식으로 남길 만한 것만 추출해라.',
    '',
    '## 추출 제외 (우선):',
    '- 봇 운영 지시(멘션/스레드/출력형식/@봇), 팀원 인적정보, 메타("KB에 기록"), 일회성("오늘만/하지마"), 일상/잡담/단순질문.',
    '- 애매하면 넣지 않는다(오탐 > 미탐). 팀 전체 영향 + 모르면 차질 + 일주일 후도 유효 — 중 2개↑일 때만.',
    '',
    '## 추출 대상:',
    '- decision: "~하기로/결정/확정/합의". slug=kebab-case 영문(구체적), title, decided_by(발신자), body(결정/배경).',
    '- blocker: "블로커/blocked/막힘/외부 의존 대기". slug, title, body.',
    '- action: "@이름 ~해줘/TODO/~까지/~담당". description, owner(이름), deadline(YYYY-MM-DD, 있으면).',
    '',
    '## 메시지:',
    lines || '(없음)',
    '',
    '## 출력: 아래 키 이름을 그대로 쓴 JSON 펜스 블록 하나만. 추출 없으면 빈 배열([]).',
    '필드명 변경 금지(text/due 등 금지). decision=slug,title,decided_by,body / blocker=slug,title,body / action=description,owner,deadline.',
    'DIGEST_JSON',
    '```json',
    '{"decisions":[{"slug":"api-v2-migration","title":"API v2 마이그레이션 4월 1주차 시작","decided_by":"가든","body":"4월 1주차 시작 확정"}],"blockers":[],"actions":[{"description":"프론트 리팩토링","owner":"가든","deadline":"2026-03-28"}]}',
    '```',
  ].join('\n');
}

/** Colony hermes 응답에서 DIGEST_JSON 블록을 파싱. 실패 시 빈 추출. */
export function parseDigestResult(text: string): DigestExtraction {
  const empty: DigestExtraction = { decisions: [], blockers: [], actions: [] };
  if (!text) return empty;
  // 첫 ```json ... ``` 블록 추출 (DIGEST_JSON 마커 뒤를 우선)
  const afterMarker = text.includes('DIGEST_JSON') ? text.slice(text.indexOf('DIGEST_JSON')) : text;
  const m = afterMarker.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const raw = m ? m[1] : afterMarker.trim().startsWith('{') ? afterMarker.trim() : null;
  if (!raw) return empty;
  try {
    const obj = JSON.parse(raw) as Partial<DigestExtraction>;
    return {
      decisions: Array.isArray(obj.decisions) ? obj.decisions : [],
      blockers: Array.isArray(obj.blockers) ? obj.blockers : [],
      actions: Array.isArray(obj.actions) ? obj.actions : [],
    };
  } catch {
    return empty;
  }
}

export interface ChannelState {
  last_ts?: string;
  last_digest_date?: string;
}
export interface DigestState {
  channels: Record<string, ChannelState>;
}

export interface DigestDeps {
  /** Colony 참여 채널 (id,name) 동적 열거. */
  listChannels: () => Promise<Array<{ id: string; name: string }>>;
  /** channel_id → domain (ingest_enabled 매핑만). */
  getMappings: () => Promise<Map<string, string>>;
  /** 채널 메시지 수집 (sinceTs 이후, 봇/시스템 제외, 시간순). */
  fetchMessages: (channelId: string, sinceTs: string) => Promise<DigestMessage[]>;
  /** Colony hermes 추출 (프롬프트 → 응답 텍스트). */
  extract: (prompt: string) => Promise<string>;
  /** KB write. */
  writeDecision: (d: { domain: string; ex: ExtractedDecision; date: string; channelName: string }) => Promise<void>;
  writeBlocker: (b: { domain: string; ex: ExtractedBlocker; date: string; channelName: string }) => Promise<void>;
  createAction: (a: { domain: string; ex: ExtractedAction }) => Promise<void>;
  loadState: () => DigestState;
  saveState: (s: DigestState) => void;
  log: (msg: string) => void;
  today: string; // YYYY-MM-DD (KST)
  defaultSinceTs: string; // 어제 00:00 KST epoch (state 없을 때)
}

export interface DigestChannelSummary {
  channel_id: string;
  name: string;
  domain: string;
  messages: number;
  decisions: number;
  blockers: number;
  actions: number;
}
export interface DigestSummary {
  ran: DigestChannelSummary[];
  unmapped: Array<{ id: string; name: string }>;
  skippedToday: number;
}

/** Colony 일일 digest 본체. deps 주입으로 테스트 가능. */
export async function runColonyDailyDigest(deps: DigestDeps): Promise<DigestSummary> {
  const channels = await deps.listChannels();
  const mappings = await deps.getMappings();
  const state = deps.loadState();
  state.channels = state.channels || {};

  const ran: DigestChannelSummary[] = [];
  const unmapped: Array<{ id: string; name: string }> = [];
  let skippedToday = 0;

  for (const ch of channels) {
    const domain = mappings.get(ch.id);
    if (!domain) {
      unmapped.push(ch);
      continue;
    }
    const st = state.channels[ch.id] || {};
    if (st.last_digest_date === deps.today) {
      skippedToday++;
      continue; // 멱등 — 오늘 이미 처리
    }
    const since = st.last_ts || deps.defaultSinceTs;
    const messages = await deps.fetchMessages(ch.id, since);
    let dec = 0,
      blk = 0,
      act = 0;
    if (messages.length > 0) {
      const prompt = buildDigestExtractionPrompt(ch.name, domain, messages);
      const result = parseDigestResult(await deps.extract(prompt));
      for (const ex of result.decisions) {
        await deps.writeDecision({ domain, ex, date: deps.today, channelName: ch.name });
        dec++;
      }
      for (const ex of result.blockers) {
        await deps.writeBlocker({ domain, ex, date: deps.today, channelName: ch.name });
        blk++;
      }
      for (const ex of result.actions) {
        await deps.createAction({ domain, ex });
        act++;
      }
      const newest = messages[messages.length - 1].ts;
      state.channels[ch.id] = { last_ts: newest, last_digest_date: deps.today };
    } else {
      state.channels[ch.id] = { last_ts: st.last_ts, last_digest_date: deps.today };
    }
    ran.push({
      channel_id: ch.id,
      name: ch.name,
      domain,
      messages: messages.length,
      decisions: dec,
      blockers: blk,
      actions: act,
    });
    deps.log(`[colony-digest] #${ch.name}→${domain}: msgs=${messages.length} dec=${dec} blk=${blk} act=${act}`);
  }
  deps.saveState(state);
  return { ran, unmapped, skippedToday };
}
