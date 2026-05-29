/**
 * dev 매직키 기반 Playwright 스모크 — 로그인 없이 게이트 라우트 시각 검증.
 *
 * 사전: dev 서버를 SEMO_DEV_AUTH_KEY 와 함께 기동
 *   SEMO_DEV_AUTH_KEY=<key> npx next dev -p 3991
 * 실행:
 *   SEMO_BASE=http://localhost:3991 SEMO_DEV_AUTH_KEY=<key> \
 *     node packages/semo-dashboard/scripts/e2e-smoke.mjs
 *
 * 스크린샷은 /tmp/semo-e2e-*.png, 결과 JSON 은 stdout.
 * (Playwright 브라우저 버전 스큐 시 SEMO_PW_CHROMIUM 으로 executablePath 지정 가능.)
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.SEMO_BASE || 'http://localhost:3991';
const KEY = process.env.SEMO_DEV_AUTH_KEY || 'devsemo123';
const EXEC = process.env.SEMO_PW_CHROMIUM || undefined;
const dir = path.dirname(fileURLToPath(import.meta.url));

const ROUTES = [
  { path: `/api/dev-auth?key=${KEY}&next=/team`, file: 'team', wait: '로드맵' },
  { path: '/bots', file: 'bots', wait: '봇 팀' },
  { path: '/kb', file: 'kb', wait: '지식' },
  { path: '/action-items', file: 'actions', wait: '액션' },
  { path: '/meetings', file: 'meetings', wait: '회의' },
  { path: '/goals', file: 'goals', wait: '목표' },
  { path: '/projects', file: 'projects', wait: '서비스' },
  { path: '/org', file: 'org', wait: '조직도' },
  { path: '/orchestrator-flow', file: 'flow', wait: '위임' },
  { path: '/demo', file: 'demo', wait: null },
  { path: '/', file: 'landing', wait: 'AI' },
];

const browser = await chromium.launch({ headless: true, executablePath: EXEC });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 160)));

const out = [];
for (const r of ROUTES) {
  await p.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(2500);
  let found = null;
  if (r.wait)
    found =
      (await p
        .getByText(r.wait, { exact: false })
        .count()
        .catch(() => 0)) > 0;
  await p.screenshot({ path: `/tmp/semo-e2e-${r.file}.png` }).catch(() => {});
  out.push({ route: r.path, finalUrl: p.url(), wait: r.wait, found });
}

console.log(JSON.stringify({ out, errors: errors.slice(0, 12) }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
