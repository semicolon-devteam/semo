#!/usr/bin/env node
/**
 * market-scan-poc.mjs
 * 손-안전베팅 "시장가 조사" PoC (Playwright)
 *
 * 목표 (실증 항목):
 *  1) 퍼시스턴트 컨텍스트(userDataDir=./pw-profile) → 세션 영속 증명
 *  2) 공개 웹(무인증) 네이버쇼핑 검색 페이지 스크랩
 *  3) 상품 제목 + 가격 추출
 *  4) 개수 / 평균 / 최저 / 최고 가격 집계
 *  5) JSON 리포트 출력
 *
 * 차단 대비:
 *  - 실 user-agent + ko-KR locale + 뷰포트 설정
 *  - headed/headless 토글 (HEADED=1)
 *  - 네이버가 막히면 정적 fixture(./fixtures/shopping-fixture.html)로
 *    "퍼시스턴트세션 + 스크랩 + 집계" 메커니즘만이라도 실증
 *
 * 사용:
 *   PLAYWRIGHT_BROWSERS_PATH=./pw-browsers node market-scan-poc.mjs
 *   HEADED=1 PLAYWRIGHT_BROWSERS_PATH=./pw-browsers node market-scan-poc.mjs
 *   SOURCE=fixture PLAYWRIGHT_BROWSERS_PATH=./pw-browsers node market-scan-poc.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = join(__dirname, 'pw-profile');
const FIXTURE_PATH = join(__dirname, 'fixtures', 'shopping-fixture.html');

const QUERY = process.env.QUERY || '실버 반지';
const NAVER_URL = 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(QUERY);
const HEADED = process.env.HEADED === '1';
const SOURCE = process.env.SOURCE || 'naver'; // 'naver' | 'fixture'

// 실제 데스크톱 Chrome user-agent (macOS arm64)
const REAL_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// ---------- 유틸 ----------
const won = (s) => {
  // "12,800원", "₩12,800", "12800" → 12800
  const digits = String(s).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
};

function aggregate(items) {
  const prices = items.map((i) => i.price).filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) {
    return { count: items.length, priced: 0, avg: null, min: null, max: null, median: null };
  }
  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return {
    count: items.length,
    priced: prices.length,
    avg: Math.round(sum / prices.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median,
  };
}

// ---------- 세션 영속 증거 ----------
function profileEvidence(label) {
  let fileCount = 0;
  let exists = existsSync(USER_DATA_DIR);
  if (exists) {
    try {
      const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, e.name);
          if (e.isDirectory()) walk(p);
          else fileCount++;
        }
      };
      walk(USER_DATA_DIR);
    } catch {}
  }
  console.error(
    `[session][${label}] userDataDir exists=${exists} fileCount=${fileCount} path=${USER_DATA_DIR}`,
  );
  return { exists, fileCount };
}

// ---------- 네이버 추출 ----------
async function scrapeNaver(page) {
  await page.goto(NAVER_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // 동적 로딩 대기 (상품 카드가 lazy 로 채워짐)
  await page.waitForTimeout(3500);
  // 스크롤로 lazy 로드 트리거
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(800);
  }

  const title = await page.title();
  const url = page.url();
  const bodyText = (await page.evaluate(() => document.body.innerText || '')).slice(0, 400);

  // 봇 차단 감지 (CAPTCHA / 비정상 접근)
  const blocked =
    /보안절차|비정상적인|일시적으로 제한|captcha|자동입력 방지|robot/i.test(bodyText) ||
    /shopping\.naver\.com\/?$/.test(url); // 검색결과 미노출하고 홈으로 리다이렉트

  // 다양한 셀렉터 시도 (네이버 클래스명은 해시되어 자주 바뀜)
  const items = await page.evaluate(() => {
    const out = [];
    // 전략 1: 상품 카드 컨테이너 후보
    const cardSelectors = [
      'div[class*="product_item"]',
      'div[class*="basicList_item"]',
      'li[class*="product"]',
      'div[class*="adProduct_item"]',
    ];
    let cards = [];
    for (const sel of cardSelectors) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length > cards.length) cards = found;
    }
    // 전략 2: 카드가 없으면 제목/가격 링크 기반 휴리스틱
    if (cards.length === 0) {
      const titleEls = Array.from(
        document.querySelectorAll('a[class*="title"], a[class*="product_link"]'),
      );
      for (const t of titleEls) {
        const card = t.closest('div, li') || t.parentElement;
        if (card && !cards.includes(card)) cards.push(card);
      }
    }
    for (const card of cards) {
      const text = card.innerText || '';
      // 제목: title 클래스 우선, 없으면 첫 의미있는 라인
      let titleEl =
        card.querySelector('a[class*="title"], [class*="title"] a, [class*="product_title"]') ||
        card.querySelector('a');
      let title = titleEl ? (titleEl.innerText || '').trim() : '';
      // 가격: price 클래스 우선
      let priceEl =
        card.querySelector('[class*="price_num"], strong[class*="price"], span[class*="price"]') ||
        null;
      let priceText = priceEl ? priceEl.innerText : '';
      if (!priceText) {
        const m = text.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
        if (m) priceText = m[1];
      }
      if (title && title.length > 1) {
        out.push({ title: title.slice(0, 120), priceText });
      }
    }
    return out;
  });

  return { title, url, blocked, bodyTextPreview: bodyText, raw: items };
}

// ---------- fixture 추출 (메커니즘 폴백) ----------
async function scrapeFixture(page) {
  await page.goto('file://' + FIXTURE_PATH, { waitUntil: 'domcontentloaded' });
  const title = await page.title();
  const items = await page.evaluate(() => {
    const out = [];
    for (const card of document.querySelectorAll('.product-item')) {
      const title = (card.querySelector('.product-title')?.innerText || '').trim();
      const priceText = card.querySelector('.product-price')?.innerText || '';
      if (title) out.push({ title, priceText });
    }
    return out;
  });
  return { title, url: 'file://' + FIXTURE_PATH, blocked: false, bodyTextPreview: '', raw: items };
}

// ---------- 메인 ----------
async function main() {
  const startedAt = new Date().toISOString();
  const before = profileEvidence('before-launch');

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: !HEADED,
    userAgent: REAL_UA,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  // 세션 영속 증명: 방문 카운터를 origin storage(쿠키) 에 기록
  const page = context.pages()[0] || (await context.newPage());

  let result;
  let usedSource = SOURCE;
  let fellBack = false;

  if (SOURCE === 'fixture') {
    result = await scrapeFixture(page);
  } else {
    result = await scrapeNaver(page);
    // 네이버 차단/빈 결과 → fixture 폴백
    if (result.blocked || result.raw.length === 0) {
      console.error(
        `[fallback] Naver blocked=${result.blocked} extracted=${result.raw.length} → fixture 로 메커니즘 실증`,
      );
      if (existsSync(FIXTURE_PATH)) {
        const naverDiag = result;
        result = await scrapeFixture(page);
        result._naverDiag = {
          title: naverDiag.title,
          url: naverDiag.url,
          blocked: naverDiag.blocked,
          extracted: naverDiag.raw.length,
          bodyTextPreview: naverDiag.bodyTextPreview,
        };
        usedSource = 'fixture(fallback)';
        fellBack = true;
      }
    }
  }

  // 세션 영속 증명: 쿠키에 카운터 기록 (다음 실행에서 누적되면 영속 입증)
  let visitCount = 1;
  try {
    const cookies = await context.cookies('https://search.shopping.naver.com');
    const prev = cookies.find((c) => c.name === 'poc_visit_count');
    visitCount = prev ? parseInt(prev.value, 10) + 1 : 1;
    await context.addCookies([
      {
        name: 'poc_visit_count',
        value: String(visitCount),
        domain: '.naver.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    ]);
  } catch (e) {
    console.error('[session] cookie write skipped:', e.message);
  }

  // 정규화 + 집계
  const items = result.raw
    .map((r) => ({ title: r.title, priceText: r.priceText, price: won(r.priceText) }))
    .filter((r) => r.title);

  const stats = aggregate(items);

  await context.close();
  const after = profileEvidence('after-close');

  const report = {
    poc: 'market-scan (손-안전베팅 시장가 조사)',
    query: QUERY,
    source: usedSource,
    fellBackToFixture: fellBack,
    startedAt,
    finishedAt: new Date().toISOString(),
    sessionPersistence: {
      userDataDir: USER_DATA_DIR,
      profileFilesBefore: before.fileCount,
      profileFilesAfter: after.fileCount,
      // 동일 userDataDir 재실행 시 누적 → 세션 영속 증거
      visitCookieCount: visitCount,
      note: 'userDataDir 가 재실행 사이 디스크에 보존되고, poc_visit_count 쿠키가 누적되면 세션 영속 입증',
    },
    pageMeta: {
      title: result.title,
      url: result.url,
      blocked: result.blocked || false,
    },
    naverDiag: result._naverDiag || null,
    aggregate: {
      ...stats,
      currency: 'KRW',
    },
    sampleItems: items.slice(0, 10),
    totalExtracted: items.length,
  };

  // 콘솔에 JSON 출력
  console.log(JSON.stringify(report, null, 2));

  // 파일로도 저장
  const outPath = join(__dirname, 'market-scan-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.error('[out] report written to ' + outPath);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
