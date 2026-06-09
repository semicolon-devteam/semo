// E8 T8.2 건기식 광고규제(식약처) 가드레일 PoC (외부계정 불요).
// 건강기능식품 표시·광고: 질병의 예방·치료 효능, 의약품 오인, 거짓·과장 표현 금지.
// 흐름: 생성 콘텐츠 → (규칙 denylist 1차) + (LLM 분류 2차) → 위반 문장 플래그 + 컴플라이언트 리라이트.
const KEY = process.env.OPENAI_API_KEY,
  MODEL = 'gpt-4o-mini';
async function llm(sys, usr) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr },
      ],
    }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status);
  return (await r.json()).choices[0].message.content;
}
// 1차 규칙 denylist(명백 위반 키워드 — 빠른 차단)
const DENY = [
  '치료',
  '완치',
  '예방',
  '항암',
  '암을',
  '혈압을 낮',
  '당뇨',
  '면역력 완성',
  '의약품',
  '부작용 없',
  '특효',
  '만병',
];
const SYS = `너는 한국 건강기능식품 표시·광고 규정 검수기다. 다음을 위반으로 본다:
(1) 질병의 예방·치료 효능·효과 표현, (2) 의약품으로 오인·혼동, (3) 거짓·과장(완치/특효/부작용 없음 등), (4) 객관적 근거 없는 단정.
입력 마케팅 문구를 문장 단위로 검사해 JSON 출력:
{"violations":[{"text":"위반 문장","category":"질병치료|의약품오인|거짓과장|근거없음","why":"이유","rewrite":"규정 준수 대체문구"}],"clean":true/false}
허용 표현 예: "건강한 일상에 도움을 줄 수 있습니다", "OO 기능에 도움을 줄 수 있음(인정받은 기능성 범위 내)". 위반 없으면 violations=[] clean=true.`;

const samples = {
  violating:
    '이 홍삼은 면역력을 높여 감기를 예방하고, 꾸준히 드시면 혈압을 낮추고 암을 막아줍니다. 부작용 없는 천연 특효 제품!',
  borderline: '하루 한 포로 활력 충전! 피곤한 현대인의 건강한 일상에 도움을 줄 수 있습니다.',
};

const out = {};
for (const [name, text] of Object.entries(samples)) {
  const hits = DENY.filter((k) => text.includes(k));
  const llmRes = JSON.parse(await llm(SYS, text));
  out[name] = {
    text,
    rule_denylist_hits: hits,
    llm_clean: llmRes.clean,
    llm_violations: llmRes.violations,
  };
}
console.log(JSON.stringify(out, null, 2));
