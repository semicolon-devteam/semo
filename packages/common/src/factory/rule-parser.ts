/**
 * Rule-based Factory Intent Parser (MVP, deterministic)
 *
 * 한국어 + 영문 혼용 자연어를 구조화된 FactoryAction 으로 매핑.
 * LLM 없이도 동작하므로 Personal 프로파일 + offline 환경에서 첫 온보딩이 가능하다.
 * LLM 파서는 향후 `OllamaIntentParser` / `AnthropicIntentParser` 로 별도 제공.
 *
 * 커버하는 표현 (MVP):
 *   - "XX 봇 만들어줘 / 생성 / 추가"                    → bot.create
 *   - "봇 목록 / 봇 리스트 / list bots"                  → bot.list
 *   - "KB에 X 추가해줘 / 등록 / 저장"                    → kb.upsert
 *   - "X 검색해 / 찾아줘 / 뭐라고 되어 있어"             → kb.search
 *   - "온톨로지 목록 / 타입 리스트 / ontology list"       → ontology.list
 *
 * 모호하면 `needs-clarification` 반환하여 봇이 follow-up 질문을 한다.
 */
import type {
  FactoryAction,
  FactoryIntentParser,
  BotCreateAction,
  KbUpsertAction,
} from './intent-types.js';

const BOT_CREATE_PATTERNS = [
  /(?:([a-zA-Z가-힣][a-zA-Z0-9가-힣\s-]{0,30}?)\s*)?(?:봇|bot)\s*(?:을|를|이|가)?\s*(?:하나\s*)?(?:만들|생성|추가|create|make|add)/i,
  /(?:new|create|add)\s+(?:a\s+)?(?:new\s+)?([a-zA-Z][a-zA-Z0-9-]{0,30})\s+bot/i,
];

const BOT_LIST_PATTERNS = [
  /봇\s*(?:목록|리스트|들)/,
  /(?:list|show)\s+(?:all\s+)?bots?/i,
  /어떤\s*봇\s*있/,
];

const KB_UPSERT_PATTERNS = [
  /(?:kb|지식|노트)(?:에|를|을)?\s*(?:.{1,80}?)\s*(?:추가|저장|등록|기록|upsert|save|add|store)/i,
];

const KB_SEARCH_PATTERNS = [
  /(?:검색|찾아|search|find|look\s*up)/i,
  /(?:뭐라|무엇|어떻게)\s*(?:되어|적혀)/,
];

const ONTOLOGY_LIST_PATTERNS = [
  /온톨로지\s*(?:목록|리스트|타입|종류)/,
  /(?:list|show)\s+ontolog(?:y|ies)/i,
  /(?:어떤|무슨)\s*(?:타입|종류|도메인)/,
];

const ROLE_KEYWORDS: Array<{ rx: RegExp; role: string; botIdHint: string }> = [
  { rx: /기획|planner|기획자|PRD/i, role: '기획/PRD 전문', botIdHint: 'planclaw' },
  { rx: /개발|코딩|구현|engineer|worker/i, role: '풀스택 엔지니어링', botIdHint: 'workclaw' },
  { rx: /리뷰|review|QA|검토/i, role: '코드 리뷰/QA', botIdHint: 'reviewclaw' },
  { rx: /디자인|design|UI|UX/i, role: '디자인/퍼블리싱', botIdHint: 'designclaw' },
  { rx: /마케팅|growth|SEO|그로스/i, role: 'SEO/마케팅/그로스', botIdHint: 'growthclaw' },
  { rx: /인프라|devops|배포|infra/i, role: '인프라/DevOps/배포', botIdHint: 'infraclaw' },
  { rx: /PM|오케스트레이터|총괄|semi/i, role: 'PM/오케스트레이터', botIdHint: 'semiclaw' },
];

function canonicalBotId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function inferRole(text: string): { role: string; template: string } | null {
  for (const k of ROLE_KEYWORDS) {
    if (k.rx.test(text)) {
      return { role: k.role, template: k.botIdHint };
    }
  }
  return null;
}

function tryBotCreate(text: string): BotCreateAction | null {
  const hitsCreate = BOT_CREATE_PATTERNS.some((rx) => rx.test(text));
  if (!hitsCreate) return null;

  const inferred = inferRole(text);
  if (!inferred) {
    return null;
  }

  // botId 추출 시도:
  //   1) 명시적으로 영문 토큰이 "my-bot" / "mybot" 형태로 들어오면 그걸 사용
  //   2) 없으면 role 키워드에서 추출한 hint 사용 (e.g. planclaw)
  const explicitId = text.match(/([a-z][a-z0-9]{2,}(?:-[a-z0-9]+)*)\b/);
  const botId = explicitId ? canonicalBotId(explicitId[1]) : inferred.template;

  return {
    kind: 'bot.create',
    botId,
    role: inferred.role,
    template: inferred.template,
    sourceText: text,
  };
}

function tryKbUpsert(text: string): KbUpsertAction | null {
  const matched = KB_UPSERT_PATTERNS.some((rx) => rx.test(text));
  if (!matched) return null;

  // "<domain> <key> [sub_key] --content "..." 유형을 추출하기엔 부족.
  // MVP 는 인용된 content 만 추출하고 domain/key 는 UX 에서 확정하도록 needs-clarification.
  const contentMatch = text.match(/["“'‘]([^"”'’]+)["”'’]/);
  if (!contentMatch) return null;

  // domain / key 추정: "reus 노트에 ..." 같은 문장은 MVP 밖. 기본값 경고를 달고 unknown 처리.
  // 대신 명시적 "domain=X key=Y" 표기는 존중.
  const kv = Object.fromEntries(
    [...text.matchAll(/(domain|key|sub_key|subkey)\s*=\s*([^\s,]+)/gi)].map((m) => [
      m[1].toLowerCase(),
      m[2],
    ]),
  );

  const domain = kv.domain ?? 'inbox';
  const key = kv.key ?? 'note';
  const subKey = kv.sub_key ?? kv.subkey;

  return {
    kind: 'kb.upsert',
    domain,
    key,
    subKey,
    content: contentMatch[1],
    sourceText: text,
  };
}

export class RuleFactoryIntentParser implements FactoryIntentParser {
  public readonly id = 'rule-v1';

  parse(text: string): FactoryAction {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return {
        kind: 'unknown',
        reason: '빈 메시지',
        sourceText: text,
      };
    }

    // bot.list 는 가장 구체적이므로 우선 검사
    if (BOT_LIST_PATTERNS.some((rx) => rx.test(trimmed))) {
      return { kind: 'bot.list', sourceText: text };
    }

    if (ONTOLOGY_LIST_PATTERNS.some((rx) => rx.test(trimmed))) {
      return { kind: 'ontology.list', sourceText: text };
    }

    const botCreate = tryBotCreate(trimmed);
    if (botCreate) return botCreate;

    // "봇" 단어는 있지만 역할 추론 불가 → 명확화 요청
    if (/(?:봇|bot)/i.test(trimmed) && BOT_CREATE_PATTERNS.some((rx) => rx.test(trimmed))) {
      return {
        kind: 'needs-clarification',
        reason: 'role-unknown',
        prompt: '어떤 역할의 봇인가요? (예: 기획, 개발, 디자인, 마케팅, 인프라, 리뷰)',
        sourceText: text,
      };
    }

    const kbUpsert = tryKbUpsert(trimmed);
    if (kbUpsert) return kbUpsert;

    if (KB_SEARCH_PATTERNS.some((rx) => rx.test(trimmed))) {
      // 검색 쿼리는 패턴 토큰을 제거한 나머지.
      const query = trimmed
        .replace(/[\.\?!。]+$/u, '')
        .replace(/검색해(?:줘|주세요)?|찾아(?:줘|주세요)?|search|find|look\s*up/gi, '')
        .trim();
      return {
        kind: 'kb.search',
        query: query || trimmed,
        sourceText: text,
      };
    }

    return {
      kind: 'unknown',
      reason: 'no-pattern-match',
      sourceText: text,
    };
  }
}

export const ruleFactoryIntentParser = new RuleFactoryIntentParser();
