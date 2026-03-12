#!/usr/bin/env node
const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
      },
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function decode(s) { // decode unicode escapes in HTML
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parse(json) {
  const data = JSON.parse(json);
  const html = data.result;
  const projects = [];
  // split by project-info-box-wrapper
  const cards = html.split('project-info-box-wrapper');
  
  for (let i = 1; i < cards.length; i++) {
    const c = cards[i];
    try {
      const title = (c.match(/subtitle-1-half-medium[^>]*>([^<]+)/) || [])[1]?.trim();
      if (!title) continue;
      
      const url = (c.match(/href="(\/project\/\d+\/)/) || [])[1];
      
      // Budget
      const budgetRaw = (c.match(/body-1-medium">([\d,]+)원/) || [])[1];
      const isMonthly = c.includes('월 금액');
      const budget = budgetRaw ? parseInt(budgetRaw.replace(/,/g, '')) : 0;
      const budgetStr = budgetRaw ? (isMonthly ? `${budgetRaw}원/월` : `${budgetRaw}원`) : '미공개';
      
      // Duration
      const duration = (c.match(/예상 기간<span[^>]*>(\d+일)/) || [])[1] || '';
      
      // Skills
      const skills = [];
      const re = /skill-chip[^>]*>([^·<]+)/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        const s = m[1].trim();
        if (s) skills.push(s);
      }
      
      // Role/Category
      const role = (c.match(/project-category-or-role[^>]*>([^<]+)/) || [])[1]?.trim() || '';
      
      // Work type
      const workType = c.includes('외주') ? '외주(도급)' : (c.includes('기간제') ? '기간제' : '');
      
      // Competition
      const comp = (c.match(/지원자\s*<span[^>]*>(\d+)명/) || [])[1];
      
      // Subcategory
      const subcat = (c.match(/project-field-subcategory[^>]*>([^<]+)/) || [])[1]?.trim() || '';
      const field = (c.match(/project-field body-2[^>]*>([^<]+)/) || [])[1]?.trim() || '';

      projects.push({
        title, url: url ? `https://www.wishket.com${url}` : '',
        budget, budgetStr, isMonthly, duration,
        skills, role, field, subcat, workType,
        competition: comp ? parseInt(comp) : null,
      });
    } catch(e) {}
  }
  return projects;
}

// Scoring
const TECH = {
  'TypeScript':15,'JavaScript':12,'React':12,'React Native':15,
  'Node.js':12,'Next.js':12,'Kotlin':15,'Spring Boot':15,'Java':10,'Spring':10,
  'Supabase':12,'PostgreSQL':10,'MySQL':8,'MongoDB':8,'Redis':8,
  'AWS':10,'Docker':8,'Kubernetes':8,'k8s':8,'Terraform':10,
  'Vue.js':10,'Angular':8,'Tailwind':8,
  'AI':12,'Machine Learning':10,'ChatGPT':10,'LLM':12,'Python':8,
  'Django':8,'Flask':8,'GraphQL':8,'Flutter':8,'Express':10,
  'NestJS':10,'Firebase':8,'WebRTC':10,
};
const DOMAIN = {
  'AI':10,'챗봇':8,'교육':8,'헬스케어':8,'의료':8,'커머스':7,'쇼핑':7,
  '핀테크':9,'금융':8,'게임':6,'SaaS':9,'플랫폼':7,
};

function score(p) {
  let s = 0; const reasons = [];
  const all = [p.title, ...p.skills, p.role, p.field, p.subcat].join(' ').toLowerCase();
  const matched = new Set();

  for (const [t, w] of Object.entries(TECH)) {
    const tl = t.toLowerCase();
    if (p.skills.some(sk => sk.toLowerCase().includes(tl) || tl.includes(sk.toLowerCase()))) {
      s += w; reasons.push(`${t}:+${w}`); matched.add(tl);
    } else if (!matched.has(tl) && all.includes(tl)) {
      const hw = Math.floor(w*0.7);
      s += hw; reasons.push(`${t}(제목):+${hw}`); matched.add(tl);
    }
  }
  for (const [d, w] of Object.entries(DOMAIN)) {
    if (all.includes(d.toLowerCase())) { s += w; reasons.push(`${d}:+${w}`); }
  }
  // Budget bonus (for 외주 total, use raw; for 기간제 monthly, convert)
  const effectiveBudget = p.isMonthly ? 0 : p.budget; // only count lump-sum for budget bonus
  if (effectiveBudget >= 50000000) { s += 10; reasons.push('고예산:+10'); }
  else if (effectiveBudget >= 20000000) { s += 5; reasons.push('중예산:+5'); }
  
  if (p.competition !== null && p.competition < 5) { s += 8; reasons.push('낮은경쟁률:+8'); }
  else if (p.competition !== null && p.competition < 10) { s += 4; reasons.push('보통경쟁률:+4'); }

  return { score: s, reasons };
}

async function main() {
  let all = [];
  for (let pg = 1; pg <= 5; pg++) {
    try {
      const json = await fetch(`https://www.wishket.com/project/?page=${pg}`);
      const projects = parse(json);
      process.stderr.write(`p${pg}:${projects.length} `);
      all.push(...projects);
    } catch(e) { process.stderr.write(`p${pg}:err `); }
  }
  // Dedup
  const seen = new Set();
  all = all.filter(p => { if (seen.has(p.title)) return false; seen.add(p.title); return true; });
  process.stderr.write(`\ntotal:${all.length}\n`);

  const scored = all.map(p => {
    const { score: s, reasons } = score(p);
    return { ...p, score: s, reasons };
  }).filter(p => p.score >= 40).sort((a, b) => b.score - a.score);

  process.stderr.write(`40+:${scored.length}\n`);
  console.log(JSON.stringify(scored, null, 2));
}

main();
