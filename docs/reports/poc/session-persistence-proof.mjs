#!/usr/bin/env node
/**
 * session-persistence-proof.mjs
 * 별도 프로세스 2회 실행에서 localStorage 카운터가 누적되는지로
 * userDataDir 퍼시스턴트 세션을 명확히 입증한다.
 *
 * 같은 userDataDir(./pw-profile) 를 재사용하므로,
 * 1회차에 쓴 localStorage 값이 2회차에서 읽혀 +1 누적되어야 한다.
 *
 * 사용: PLAYWRIGHT_BROWSERS_PATH=./pw-browsers node session-persistence-proof.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = join(__dirname, 'pw-profile');

// example.com 은 공개·무인증·안정적인 origin → localStorage 테스트에 적합
const URL = 'https://example.com/';

const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: true,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

const count = await page.evaluate(() => {
  const prev = parseInt(localStorage.getItem('poc_persist_count') || '0', 10);
  const next = prev + 1;
  localStorage.setItem('poc_persist_count', String(next));
  localStorage.setItem('poc_last_visit', new Date().toISOString());
  return { prev, next, lastBefore: localStorage.getItem('poc_last_visit') };
});

console.log(
  JSON.stringify(
    {
      proof: 'persistent-context-localStorage',
      origin: URL,
      previousCount: count.prev,
      newCount: count.next,
      persisted: count.prev > 0, // prev>0 이면 이전 프로세스의 값이 보존되었다는 증거
    },
    null,
    2,
  ),
);

await ctx.close();
