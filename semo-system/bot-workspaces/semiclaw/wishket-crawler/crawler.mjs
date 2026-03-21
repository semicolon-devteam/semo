#!/usr/bin/env node
/**
 * Wishket 외주(도급) 프로젝트 크롤러 + AI 스코어링 v2
 * - 프로젝트 상세 분석
 * - 도메인 경험 매핑
 * - 스킬 심층 매핑
 */

import https from 'https';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LZString = require('lz-string');

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEAM = JSON.parse(readFileSync(join(__dirname, 'team-profile.json'), 'utf8'));

const AUTH = { email: 'reus@semi-colon.space', password: 'team-semicolon' };
const MAX_PAGES = 10;

// ── HTTP ──
let cookies = {};
function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, {
      method: opts.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        ...(Object.keys(cookies).length ? { Cookie: Object.entries(cookies).map(([k,v])=>`${k}=${v}`).join('; ') } : {}),
        ...opts.headers,
      },
    }, res => {
      if (res.headers['set-cookie']) {
        for (const c of res.headers['set-cookie']) {
          const [kv] = c.split(';');
          const eq = kv.indexOf('=');
          if (eq > 0) cookies[kv.slice(0,eq).trim()] = kv.slice(eq+1).trim();
        }
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ── Login ──
async function login() {
  console.log('🔐 로그인 중...');
  const res = await request('https://auth.wishket.com/api/loginApi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://auth.wishket.com' },
    body: JSON.stringify({ id: AUTH.email, password: AUTH.password, remember: true }),
  });
  const data = JSON.parse(res.body);
  if (!data.ok) throw new Error('로그인 실패');
  console.log('  ✅ 로그인 성공');
}

// ── Fetch list ──
async function fetchProjectList(page) {
  const filterStr = `pt=task_based&page=${page}&ecd=True`;
  const compressed = encodeURIComponent(LZString.compressToBase64(filterStr));
  const res = await request(`https://www.wishket.com/project/?d=${compressed}`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  let html;
  try { html = JSON.parse(res.body).result || ''; } catch { html = res.body; }
  const ids = new Set();
  const re = /href="\/project\/(\d+)\/"/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

// ── Parse detail ──
function parseDetail(html) {
  const d = {};
  const txt = (re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
  const num = (re) => { const m = html.match(re); return m ? parseInt(m[1].replace(/,/g, '')) : 0; };

  d.title = txt(/<h1[^>]*>([^<]+)<\/h1>/);
  d.budget = num(/예상 금액[\s\S]*?(\d[\d,]+)원/);
  d.monthlyBudget = num(/월 금액[\s\S]*?(\d[\d,]+)원/);
  d.durationDays = num(/예상 기간[\s\S]*?(\d+)일/);
  d.isRecruiting = /모집 중/.test(html);
  d.isOutsourcing = /외주/.test(html);
  d.deadline = (() => {
    const m = html.match(/모집 마감일[\s\S]*?(\d{4})년\s*(\d{2})월\s*(\d{2})일/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  })();
  d.applicants = num(/지원자 수[\s\S]*?(\d+)명/);

  // Skills
  d.skills = [];
  const skillRe = /skill-chip[^"]*">([^<]+)/g;
  let sm;
  while ((sm = skillRe.exec(html)) !== null) {
    const v = sm[1].trim();
    if (v && !d.skills.includes(v)) d.skills.push(v);
  }

  // Full description (로그인 후 전체 내용)
  const descBlocks = [];
  const descRe = /<div class="body-2 text900"[^>]*>([\s\S]*?)<\/div>/g;
  while ((sm = descRe.exec(html)) !== null) {
    const clean = sm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 20) descBlocks.push(clean);
  }
  d.description = descBlocks.join('\n').slice(0, 5000);

  d.role = txt(/project-target-role[^>]*>([^<]+)/);
  d.level = txt(/project-target-detail-row-info[^>]*level">([^<]+)/);
  d.location = txt(/근무 위치[\s\S]*?condition-row-data[^>]*>([^<]+)/);
  d.registeredAt = txt(/등록 일자\s*(\d{4}\.\d{2}\.\d{2})/);
  d.industry = txt(/프로젝트 산업 분야[\s\S]*?condition-data[^>]*>([^<]+)/);
  d.recruitBackground = txt(/구인 배경[\s\S]*?condition-data[^>]*>([^<]+)/);
  d.recruitType = txt(/구인 유형[\s\S]*?condition-data[^>]*>([^<]+)/);

  // Requirements section
  const reqSection = html.match(/모집 요건[\s\S]*?(?=<a id=|<div class="layer-divider)/);
  d.requirements = reqSection
    ? reqSection[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
    : '';

  // Work condition
  const workSection = html.match(/근무 환경[\s\S]*?(?=<a id=|<div class="layer-divider)/);
  d.workCondition = workSection
    ? workSection[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000)
    : '';

  return d;
}

// ── Enhanced Scoring v2 ──
function scoreProject(detail) {
  const scores = {};
  const reasons = [];
  const fullText = `${detail.title} ${detail.description} ${detail.requirements}`.toLowerCase();

  // ═══ 1. SKILL MATCH (0-30) ═══
  const allTeamSkills = Object.values(TEAM.coreStacks).flat().map(s => s.toLowerCase());
  const projectSkills = [...new Set(detail.skills.map(s => s.split('·')[0].trim().toLowerCase()))];

  let skillMatches = 0;
  const matchedSkills = [];
  for (const ps of projectSkills) {
    if (allTeamSkills.some(ts => ps.includes(ts) || ts.includes(ps))) {
      skillMatches++;
      matchedSkills.push(ps);
    }
  }

  // Also check description for implicit skill requirements
  const implicitSkills = [];
  for (const ts of allTeamSkills) {
    if (ts.length >= 3 && fullText.includes(ts) && !matchedSkills.includes(ts)) {
      implicitSkills.push(ts);
    }
  }

  const totalRequired = projectSkills.length || 1;
  const directMatch = projectSkills.length > 0 ? (skillMatches / totalRequired) : 0.3;
  const implicitBonus = Math.min(0.3, implicitSkills.length * 0.05);
  scores.skill = Math.round(Math.min(1, directMatch + implicitBonus) * 30);

  if (matchedSkills.length) reasons.push(`직접스킬: ${matchedSkills.join(', ')}`);
  if (implicitSkills.length) reasons.push(`암묵스킬: ${implicitSkills.slice(0, 5).join(', ')}`);

  // ═══ 2. DOMAIN EXPERIENCE (0-25) ═══
  let bestDomainScore = 0;
  let bestDomain = null;
  const matchedDomains = [];

  for (const domain of TEAM.domainExperience) {
    const kwMatches = domain.keywords.filter(kw => fullText.includes(kw.toLowerCase())).length;
    if (kwMatches === 0) continue;

    const levelMultiplier = { expert: 1.0, advanced: 0.75, intermediate: 0.5 }[domain.level] || 0.3;
    const coverage = Math.min(1, kwMatches / 3); // 3개 이상 매치하면 만점
    const domainScore = coverage * levelMultiplier;

    matchedDomains.push({
      name: domain.domain,
      level: domain.level,
      kwMatches,
      score: domainScore,
      relatedProjects: domain.projects.slice(0, 2),
    });

    if (domainScore > bestDomainScore) {
      bestDomainScore = domainScore;
      bestDomain = domain;
    }
  }

  // Sort by score, take top 3
  matchedDomains.sort((a, b) => b.score - a.score);
  const topDomains = matchedDomains.slice(0, 3);

  // Domain score = best domain * 0.6 + second * 0.3 + third * 0.1
  const domainWeights = [0.6, 0.3, 0.1];
  let domainTotal = 0;
  for (let i = 0; i < Math.min(topDomains.length, 3); i++) {
    domainTotal += topDomains[i].score * domainWeights[i];
  }
  scores.domain = Math.round(domainTotal * 25);

  if (topDomains.length > 0) {
    const domainStr = topDomains.map(d => {
      const lvl = { expert: '🟢', advanced: '🟡', intermediate: '🟠' }[d.level] || '⚪';
      return `${lvl}${d.name}(${d.kwMatches}hit)`;
    }).join(' ');
    reasons.push(`도메인: ${domainStr}`);
  }

  // ═══ 3. BUDGET (0-15) ═══
  const totalBudget = detail.budget || (detail.monthlyBudget ? detail.monthlyBudget * Math.max(1, detail.durationDays / 30) : 0);
  const monthlyRate = detail.durationDays > 0 ? (totalBudget / (detail.durationDays / 30)) : totalBudget;

  if (totalBudget >= 50000000) { scores.budget = 15; reasons.push(`💰${(totalBudget/10000).toFixed(0)}만(월${(monthlyRate/10000).toFixed(0)}만)`); }
  else if (totalBudget >= 30000000) { scores.budget = 13; reasons.push(`💰${(totalBudget/10000).toFixed(0)}만(월${(monthlyRate/10000).toFixed(0)}만)`); }
  else if (totalBudget >= 10000000) { scores.budget = 10; reasons.push(`💰${(totalBudget/10000).toFixed(0)}만`); }
  else if (totalBudget >= 5000000) { scores.budget = 5; reasons.push(`💰${(totalBudget/10000).toFixed(0)}만`); }
  else { scores.budget = 0; reasons.push(`💰부족 ${(totalBudget/10000).toFixed(0)}만`); }

  // ═══ 4. COMPETITION (0-12) ═══
  if (detail.applicants <= 2) { scores.competition = 12; reasons.push(`🎯경쟁↓↓ ${detail.applicants}명`); }
  else if (detail.applicants <= 5) { scores.competition = 10; reasons.push(`🎯경쟁↓ ${detail.applicants}명`); }
  else if (detail.applicants <= 10) { scores.competition = 6; reasons.push(`경쟁중 ${detail.applicants}명`); }
  else if (detail.applicants <= 20) { scores.competition = 3; reasons.push(`경쟁↑ ${detail.applicants}명`); }
  else { scores.competition = 0; reasons.push(`경쟁↑↑ ${detail.applicants}명`); }

  // ═══ 5. DURATION FIT (0-8) ═══
  if (detail.durationDays >= 60 && detail.durationDays <= 180) { scores.duration = 8; }
  else if (detail.durationDays >= 30 && detail.durationDays < 60) { scores.duration = 6; }
  else if (detail.durationDays > 180 && detail.durationDays <= 365) { scores.duration = 5; reasons.push('장기'); }
  else if (detail.durationDays > 0 && detail.durationDays < 30) { scores.duration = 2; reasons.push('초단기'); }
  else { scores.duration = 3; }

  // ═══ 6. FRESHNESS & URGENCY (0-5) ═══
  let freshScore = 0;
  if (detail.registeredAt) {
    const reg = new Date(detail.registeredAt.replace(/\./g, '-').replace(/-$/, ''));
    const daysAgo = (Date.now() - reg.getTime()) / 86400000;
    if (daysAgo <= 2) { freshScore += 3; reasons.push('🆕신규'); }
    else if (daysAgo <= 5) { freshScore += 2; }
  }
  if (detail.deadline) {
    const dl = new Date(detail.deadline);
    const daysLeft = (dl.getTime() - Date.now()) / 86400000;
    if (daysLeft > 3 && daysLeft <= 7) { freshScore += 2; reasons.push('⏰마감임박'); }
    else if (daysLeft > 7) { freshScore += 1; }
  }
  scores.freshness = Math.min(5, freshScore);

  // ═══ 7. PROJECT QUALITY SIGNALS (0-5) ═══
  let qualityScore = 0;
  if (detail.description.length > 200) qualityScore += 1; // 상세한 설명
  if (detail.requirements.length > 100) qualityScore += 1; // 요구사항 명확
  if (detail.industry) qualityScore += 1; // 산업분야 명시
  if (detail.recruitType) qualityScore += 1; // 구인유형 명시
  if (detail.skills.length >= 2) qualityScore += 1; // 스킬 명시
  scores.quality = Math.min(5, qualityScore);

  // ═══ TOTAL ═══
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  return {
    score: total,
    maxScore: 100,
    scoreBreakdown: scores,
    reasons,
    matchedDomains: topDomains,
    matchedSkills,
    implicitSkills: implicitSkills.slice(0, 10),
  };
}

// ── Main ──
async function main() {
  await login();

  console.log('\n📋 외주(도급) 프로젝트 목록 크롤링 중...');
  const allIds = new Set();
  const projectList = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const ids = await fetchProjectList(page);
    if (ids.length === 0) { console.log(`  페이지 ${page}: 없음, 중단`); break; }
    let newCount = 0;
    for (const id of ids) {
      if (!allIds.has(id)) { allIds.add(id); projectList.push(id); newCount++; }
    }
    console.log(`  페이지 ${page}: ${ids.length}개 (신규 ${newCount}, 누적 ${projectList.length})`);
    if (newCount === 0) break;
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n🔍 상세 페이지 파싱 + 스코어링 (${projectList.length}개)...`);
  const results = [];

  for (let i = 0; i < projectList.length; i++) {
    const id = projectList[i];
    try {
      const res = await request(`https://www.wishket.com/project/${id}/`);
      const detail = parseDetail(res.body);
      detail.id = id;
      detail.url = `https://www.wishket.com/project/${id}/`;
      if (!detail.isRecruiting) continue;
      const scoring = scoreProject(detail);
      results.push({ ...detail, ...scoring });
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${projectList.length} 완료`);
    } catch (e) {
      console.error(`  ⚠️ ${id}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  results.sort((a, b) => b.score - a.score);

  // Save full results
  const output = {
    crawledAt: new Date().toISOString(),
    totalCrawled: projectList.length,
    totalScored: results.length,
    scoringVersion: 'v2',
    scoreWeights: {
      skill: '0-30 (직접 + 암묵적 스킬 매칭)',
      domain: '0-25 (도메인 경험 매핑)',
      budget: '0-15 (예산 규모)',
      competition: '0-12 (경쟁도)',
      duration: '0-8 (기간 적합성)',
      freshness: '0-5 (신선도 + 마감 긴급도)',
      quality: '0-5 (프로젝트 정보 품질)',
    },
    projects: results.map(r => ({
      id: r.id, title: r.title, url: r.url,
      score: r.score, scoreBreakdown: r.scoreBreakdown,
      reasons: r.reasons,
      matchedDomains: r.matchedDomains,
      matchedSkills: r.matchedSkills,
      implicitSkills: r.implicitSkills,
      budget: r.budget, monthlyBudget: r.monthlyBudget,
      durationDays: r.durationDays, skills: r.skills,
      role: r.role, level: r.level, applicants: r.applicants,
      deadline: r.deadline, location: r.location,
      industry: r.industry, description: r.description.slice(0, 800),
      requirements: r.requirements.slice(0, 500),
      registeredAt: r.registeredAt,
    })),
  };

  writeFileSync(join(__dirname, 'results.json'), JSON.stringify(output, null, 2));
  console.log(`\n✅ 결과 저장 완료`);

  // Print top 15 with detailed breakdown
  console.log('\n🏆 추천 프로젝트 TOP 15:');
  console.log('═'.repeat(90));
  for (const p of results.slice(0, 15)) {
    const budgetStr = p.budget ? `${(p.budget/10000).toFixed(0)}만` : p.monthlyBudget ? `${(p.monthlyBudget/10000).toFixed(0)}만/월` : '미정';
    const bd = p.scoreBreakdown;
    console.log(`\n[${p.score}점] ${p.title}`);
    console.log(`  스킬:${bd.skill}/30 | 도메인:${bd.domain}/25 | 예산:${bd.budget}/15 | 경쟁:${bd.competition}/12 | 기간:${bd.duration}/8 | 신선:${bd.freshness}/5 | 품질:${bd.quality}/5`);
    console.log(`  💰 ${budgetStr} | ⏱ ${p.durationDays}일 | 👥 ${p.applicants}명 | 📅 ${p.deadline}`);
    if (p.skills.length) console.log(`  🔧 ${p.skills.slice(0, 6).join(' | ')}`);
    console.log(`  📌 ${p.reasons.join(' | ')}`);
    if (p.matchedDomains.length) {
      for (const d of p.matchedDomains) {
        console.log(`     ↳ ${d.name} [${d.level}] — ${d.relatedProjects.join(', ')}`);
      }
    }
    console.log(`  🔗 ${p.url}`);
  }

  // Summary stats
  console.log('\n📊 점수 분포:');
  const ranges = [[70,100,'🟢 강추'], [55,69,'🟡 추천'], [40,54,'🟠 검토'], [0,39,'⚪ 패스']];
  for (const [min, max, label] of ranges) {
    const count = results.filter(r => r.score >= min && r.score <= max).length;
    console.log(`  ${label}: ${count}개`);
  }
}

main().catch(e => { console.error('❌', e); process.exit(1); });
