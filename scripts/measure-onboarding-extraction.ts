#!/usr/bin/env npx tsx
/**
 * P3-E (2026-05-28): 자기소개 자연어 추출 A/B 측정.
 *
 * 3가지 전략별 정확도 비교:
 *   - regex-only: extractProfileFromTextRegex
 *   - llm-only:   extractProfileWithLLM (OpenAI gpt-4o-mini)
 *   - hybrid:     regex 우선 → 부족하면 LLM (현재 default)
 *
 * 사용:
 *   npx tsx scripts/measure-onboarding-extraction.ts
 *   OPENAI_API_KEY=... npx tsx scripts/measure-onboarding-extraction.ts
 *
 * KB: semo decision/semo-p2-complete-2026-05-28 의 P2-E + P3-E
 */

interface Fixture {
  text: string;
  expected: {
    nickname?: string;
    role?: string;
    it_fluency?: 'beginner' | 'intermediate' | 'expert';
  };
}

interface Extracted {
  nickname?: string;
  role?: string;
  itFluency?: 'beginner' | 'intermediate' | 'expert';
}

const FIXTURES: Fixture[] = [
  // 명시적 한국어 자기소개
  {
    text: '재용이라고 불러요, 백엔드 개발자입니다.',
    expected: { nickname: '재용', role: '백엔드 개발자' },
  },
  {
    text: '강민이라고 부르시면 돼요. AI 처음 써봐서 잘 몰라요.',
    expected: { nickname: '강민', it_fluency: 'beginner' },
  },
  {
    text: '저는 디자이너입니다. 윤서로 불러주세요.',
    expected: { nickname: '윤서', role: '디자이너' },
  },
  // 영문
  {
    text: "I'm Joe, frontend dev with 5 years experience.",
    expected: { nickname: 'Joe', role: '프론트엔드 개발자', it_fluency: 'intermediate' },
  },
  { text: 'Call me Alice, I am the CEO.', expected: { nickname: 'Alice', role: '대표' } },
  // 자기소개 없이 일반 요청
  {
    text: '오늘 머지된 PR 검토해줘',
    expected: {},
  },
  {
    text: '서버 헬스 체크',
    expected: {},
  },
  // 우회된 형태
  {
    text: '안녕하세요, 저는 마케터예요',
    expected: { role: '마케터' }, // nickname 추출 어려움
  },
  {
    text: '제 이름은 박지훈이고 시니어 풀스택입니다',
    expected: { nickname: '박지훈', role: '풀스택 개발자', it_fluency: 'expert' },
  },
  {
    text: '데이터 분석가입니다',
    expected: { role: '데이터 엔지니어' }, // role map 의 가까운 매칭
  },
  // 개선3: fixture 확장 (fluency 다양화)
  {
    text: '민수라고 해요. 인프라 10년차 베테랑입니다',
    expected: { nickname: '민수', role: '인프라 엔지니어', it_fluency: 'expert' },
  },
  {
    text: '코딩 처음이라 잘 못해요. 지원이라고 불러주세요',
    expected: { nickname: '지원', it_fluency: 'beginner' },
  },
  {
    text: '저는 PM 이고 AI 는 어느 정도 쓸 줄 알아요',
    expected: { role: '기획자', it_fluency: 'intermediate' },
  },
  {
    text: '풀스택 시니어 개발자입니다. 정현으로 불러요',
    expected: { nickname: '정현', role: '풀스택 개발자', it_fluency: 'expert' },
  },
  {
    text: "Hi, I'm Sarah, a junior frontend developer",
    expected: { nickname: 'Sarah', role: '프론트엔드 개발자', it_fluency: 'intermediate' },
  },
  {
    text: '디자인 왕초보예요 ㅠㅠ',
    expected: { role: '디자이너', it_fluency: 'beginner' },
  },
];

// ── 정규식 추출 (slack-router 의 함수와 동일 로직, 복제) ─────────────────
function extractRegex(text: string): Extracted {
  const out: Extracted = {};
  const lower = text.toLowerCase();
  const koName = text.match(
    /([가-힣A-Za-z][가-힣A-Za-z0-9_]{1,15})\s*(?:이?라고|로)\s*(?:불러|부르)/,
  );
  if (koName) out.nickname = koName[1];
  if (!out.nickname) {
    const enName = text.match(/(?:i'?m|call me|i am)\s+([A-Za-z][A-Za-z0-9_]{1,15})/i);
    if (enName) out.nickname = enName[1];
  }
  const roleMap: Array<[RegExp, string]> = [
    [/(백엔드|backend|서버)/i, '백엔드 개발자'],
    [/(프론트엔드|frontend|fe)/i, '프론트엔드 개발자'],
    [/(풀스택|full[\s-]?stack)/i, '풀스택 개발자'],
    [/(디자이너|designer|ui|ux)/i, '디자이너'],
    [/(기획|pm|po|product\s*manager|product\s*owner)/i, '기획자'],
    [/(마케터|marketer|growth)/i, '마케터'],
    [/(대표|ceo|founder|cofounder)/i, '대표'],
    [/(데이터|data\s*(scientist|analyst|engineer))/i, '데이터 엔지니어'],
    [/(인프라|devops|sre|infra)/i, '인프라 엔지니어'],
    [/(개발자|developer|engineer)/i, '개발자'],
  ];
  for (const [re, role] of roleMap) {
    if (re.test(lower)) {
      out.role = role;
      break;
    }
  }
  if (
    /(잘\s*모르|잘\s*못|처음|초보|입문|왕초보|문외한|어려워|beginner|newbie|new\s*to|first\s*time|not\s*(very\s*)?(good|familiar))/i.test(
      lower,
    )
  ) {
    out.itFluency = 'beginner';
  } else if (
    /(전문가|숙련|능숙|베테랑|expert|advanced|시니어|senior|principal|아키텍트|architect|lead|리드|10년|수년)/i.test(
      lower,
    )
  ) {
    out.itFluency = 'expert';
  } else if (
    /(개발자|엔지니어|engineer|developer|중급|intermediate|junior|주니어|midlevel|어느\s*정도|보통|쓸\s*줄)/i.test(
      lower,
    )
  ) {
    out.itFluency = 'intermediate';
  }
  return out;
}

// ── LLM 추출 (slack-router 의 함수와 동일) ──────────────────────────────
async function extractLLM(text: string): Promise<Extracted> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return {};
  const model = process.env.SEMO_ONBOARDING_LLM_MODEL || 'gpt-4o-mini';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7_000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '사용자가 자기소개로 한 문장 보냈을 때 핵심 정보 추출. JSON: {"nickname": string|null, "role": string|null, "it_fluency": "beginner"|"intermediate"|"expert"|null}. 확실히 추론 가능할 때만 채우고 없으면 null. 추측 금지.',
          },
          { role: 'user', content: text.slice(0, 500) },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return {};
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      nickname?: string | null;
      role?: string | null;
      it_fluency?: 'beginner' | 'intermediate' | 'expert' | null;
    };
    const out: Extracted = {};
    if (parsed.nickname && parsed.nickname.length >= 1 && parsed.nickname.length <= 30) {
      out.nickname = parsed.nickname;
    }
    if (parsed.role && parsed.role.length >= 1 && parsed.role.length <= 50) {
      out.role = parsed.role;
    }
    if (parsed.it_fluency && ['beginner', 'intermediate', 'expert'].includes(parsed.it_fluency)) {
      out.itFluency = parsed.it_fluency;
    }
    return out;
  } catch {
    return {};
  }
}

async function extractHybrid(text: string): Promise<Extracted> {
  const regex = extractRegex(text);
  const hasAny = Boolean(regex.nickname || regex.role || regex.itFluency);
  const isComplete = Boolean(regex.nickname && regex.role && regex.itFluency);
  if (!hasAny) return regex;
  if (isComplete) return regex;
  const llm = await extractLLM(text);
  return {
    nickname: regex.nickname || llm.nickname,
    role: regex.role || llm.role,
    itFluency: regex.itFluency || llm.itFluency,
  };
}

// ── 정확도 계산 ──────────────────────────────────────────────────────
interface FieldScore {
  precision: number;
  recall: number;
}

function compareField(
  expected: string | undefined,
  actual: string | undefined,
  fuzzy: boolean = false,
): { tp: number; fp: number; fn: number } {
  if (!expected && !actual) return { tp: 0, fp: 0, fn: 0 };
  if (expected && actual) {
    if (fuzzy) {
      const match =
        actual.toLowerCase().includes(expected.toLowerCase()) ||
        expected.toLowerCase().includes(actual.toLowerCase());
      return match ? { tp: 1, fp: 0, fn: 0 } : { tp: 0, fp: 1, fn: 1 };
    }
    return actual === expected ? { tp: 1, fp: 0, fn: 0 } : { tp: 0, fp: 1, fn: 1 };
  }
  if (expected && !actual) return { tp: 0, fp: 0, fn: 1 };
  return { tp: 0, fp: 1, fn: 0 };
}

interface AggScore {
  field: string;
  tp: number;
  fp: number;
  fn: number;
}

function precRec(s: AggScore): FieldScore {
  const precision = s.tp + s.fp === 0 ? 1 : s.tp / (s.tp + s.fp);
  const recall = s.tp + s.fn === 0 ? 1 : s.tp / (s.tp + s.fn);
  return { precision, recall };
}

async function evaluate(
  name: string,
  extract: (text: string) => Promise<Extracted> | Extracted,
): Promise<void> {
  const scores: Record<'nickname' | 'role' | 'it_fluency', AggScore> = {
    nickname: { field: 'nickname', tp: 0, fp: 0, fn: 0 },
    role: { field: 'role', tp: 0, fp: 0, fn: 0 },
    it_fluency: { field: 'it_fluency', tp: 0, fp: 0, fn: 0 },
  };
  let perCase: string[] = [];

  for (const fx of FIXTURES) {
    const act = await extract(fx.text);
    const nName = compareField(fx.expected.nickname, act.nickname, true);
    const nRole = compareField(fx.expected.role, act.role, true);
    const nFluency = compareField(fx.expected.it_fluency, act.itFluency);
    scores.nickname.tp += nName.tp;
    scores.nickname.fp += nName.fp;
    scores.nickname.fn += nName.fn;
    scores.role.tp += nRole.tp;
    scores.role.fp += nRole.fp;
    scores.role.fn += nRole.fn;
    scores.it_fluency.tp += nFluency.tp;
    scores.it_fluency.fp += nFluency.fp;
    scores.it_fluency.fn += nFluency.fn;
    perCase.push(
      `  "${fx.text.slice(0, 40)}..." → nick=${act.nickname || '-'} role=${act.role || '-'} fluency=${act.itFluency || '-'}`,
    );
  }

  console.log(`\n── ${name} ──`);
  for (const k of ['nickname', 'role', 'it_fluency'] as const) {
    const pr = precRec(scores[k]);
    const f1 =
      pr.precision + pr.recall === 0
        ? 0
        : (2 * pr.precision * pr.recall) / (pr.precision + pr.recall);
    console.log(
      `  ${k.padEnd(12)} precision=${(pr.precision * 100).toFixed(1)}%  recall=${(pr.recall * 100).toFixed(1)}%  F1=${(f1 * 100).toFixed(1)}%  (tp=${scores[k].tp} fp=${scores[k].fp} fn=${scores[k].fn})`,
    );
  }
  if (process.env.VERBOSE) {
    console.log('\n  cases:');
    perCase.forEach((l) => console.log(l));
  }
}

async function main(): Promise<void> {
  console.log(`fixtures: ${FIXTURES.length}건`);
  await evaluate('regex-only', extractRegex);

  if (process.env.OPENAI_API_KEY) {
    await evaluate('llm-only', extractLLM);
    await evaluate('hybrid (production)', extractHybrid);
  } else {
    console.log('\n⚠ OPENAI_API_KEY 미설정 — llm-only / hybrid 평가 skip');
    console.log(
      '   설정 후 재실행: OPENAI_API_KEY=... npx tsx scripts/measure-onboarding-extraction.ts',
    );
  }
}

main().catch((err) => {
  console.error('error:', err);
  process.exit(1);
});
