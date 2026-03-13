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

function parse(json) {
  const data = JSON.parse(json);
  const html = data.result;
  const projects = [];
  const cards = html.split('project-info-box-wrapper');
  
  for (let i = 1; i < cards.length; i++) {
    const c = cards[i];
    try {
      const title = (c.match(/subtitle-1-half-medium[^>]*>([^<]+)/) || [])[1]?.trim();
      if (!title) continue;
      
      const url = (c.match(/href="(\/project\/\d+\/)/) || [])[1];
      const budgetRaw = (c.match(/body-1-medium">([\d,]+)원/) || [])[1];
      const isMonthly = c.includes('월 금액');
      const budget = budgetRaw ? parseInt(budgetRaw.replace(/,/g, '')) : 0;
      const budgetStr = budgetRaw ? (isMonthly ? `${budgetRaw}원/월` : `${budgetRaw}원`) : '미공개';
      const duration = (c.match(/예상 기간<span[^>]*>(\d+일)/) || [])[1] || '';
      
      const skills = [];
      const re = /skill-chip[^>]*>([^·<]+)/g;
      let m;
      while ((m = re.exec(c)) !== null) { const s = m[1].trim(); if (s) skills.push(s); }
      
      const role = (c.match(/project-category-or-role[^>]*>([^<]+)/) || [])[1]?.trim() || '';
      const workType = c.includes('외주') ? '외주' : (c.includes('기간제') ? '기간제' : '');
      const comp = (c.match(/지원자\s*<span[^>]*>(\d+)명/) || [])[1];
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

// Exact match scoring to avoid Java/JavaScript, React/React Native confusion
function exactMatch(skill, tech) {
  const sl = skill.toLowerCase().trim();
  const tl = tech.toLowerCase();
  // exact or with version suffix
  return sl === tl || sl.startsWith(tl + ' ') || sl === tl.replace(/\./g, '');
}

const TECH = [
  ['TypeScript',15],['React Native',15],['Kotlin',15],['Spring Boot',15],
  ['Next.js',12],['Node.js',12],['React',12],['JavaScript',12],['Supabase',12],
  ['NestJS',10],['Express',10],['WebRTC',10],['AWS',10],['Terraform',10],
  ['PostgreSQL',10],['Vue.js',10],['Spring',10],['Java',10],
  ['Python',8],['MySQL',8],['MongoDB',8],['Redis',8],
  ['Docker',8],['Kubernetes',8],['k8s',8],['Flutter',8],['Firebase',8],
  ['Django',8],['Flask',8],['GraphQL',8],['Tailwind',8],['Angular',8],
];

const DOMAIN = {
  'ai':10,'챗봇':8,'교육':8,'헬스케어':8,'의료':8,'커머스':7,'쇼핑':7,
  '핀테크':9,'금융':8,'saas':9,'플랫폼':7,
};

function scoreProject(p) {
  let s = 0; const reasons = [];
  const matchedTechs = new Set();

  // skill-based matching (strict)
  for (const [tech, w] of TECH) {
    if (matchedTechs.has(tech)) continue;
    for (const skill of p.skills) {
      if (exactMatch(skill, tech)) {
        s += w; reasons.push(`${tech}:+${w}`);
        matchedTechs.add(tech);
        // Also mark related to avoid double: React/React Native, Java/JavaScript, Spring/Spring Boot
        if (tech === 'React Native') matchedTechs.add('React');
        if (tech === 'React') matchedTechs.add('React Native');
        if (tech === 'Spring Boot') matchedTechs.add('Spring');
        if (tech === 'Kubernetes') matchedTechs.add('k8s');
        if (tech === 'k8s') matchedTechs.add('Kubernetes');
        break;
      }
    }
  }

  // Title-based matching (weaker, only if not already matched via skills)
  const titleLower = p.title.toLowerCase();
  for (const [tech, w] of TECH) {
    if (matchedTechs.has(tech)) continue;
    if (titleLower.includes(tech.toLowerCase())) {
      const hw = Math.floor(w * 0.6);
      s += hw; reasons.push(`${tech}(제목):+${hw}`);
      matchedTechs.add(tech);
      if (tech === 'React Native') matchedTechs.add('React');
      if (tech === 'Spring Boot') matchedTechs.add('Spring');
      if (tech === 'Kubernetes') matchedTechs.add('k8s');
      if (tech === 'k8s') matchedTechs.add('Kubernetes');
    }
  }

  // Domain matching (from title + role + subcat)
  const domainText = [p.title, p.role, p.field, p.subcat].join(' ').toLowerCase();
  for (const [d, w] of Object.entries(DOMAIN)) {
    // avoid "ai" matching "Airflow" etc - require word boundary
    const dLower = d.toLowerCase();
    const regex = new RegExp(`(?:^|[^a-zA-Z가-힣])${dLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-zA-Z가-힣])`, 'i');
    if (regex.test(domainText)) {
      s += w; reasons.push(`${d}:+${w}`);
    }
  }

  // Budget bonus (lump-sum only)
  if (!p.isMonthly && p.budget >= 50000000) { s += 10; reasons.push('고예산:+10'); }
  else if (!p.isMonthly && p.budget >= 20000000) { s += 5; reasons.push('중예산:+5'); }
  
  if (p.competition !== null && p.competition < 5) { s += 8; reasons.push('낮은경쟁률:+8'); }
  else if (p.competition !== null && p.competition < 10) { s += 4; reasons.push('보통경쟁률:+4'); }

  return { score: s, reasons };
}

async function main() {
  let all = [];
  // Fetch multiple pages. Also try 외주 filter
  const urls = [
    // 외주(도급) = task-based
    ...Array.from({length:5}, (_, i) => `https://www.wishket.com/project/?page=${i+1}`),
  ];
  
  for (const url of urls) {
    try {
      const json = await fetch(url);
      const projects = parse(json);
      process.stderr.write(`${projects.length} `);
      all.push(...projects);
    } catch(e) { process.stderr.write(`err `); }
  }

  const seen = new Set();
  all = all.filter(p => { if (seen.has(p.title)) return false; seen.add(p.title); return true; });
  process.stderr.write(`\ntotal:${all.length}\n`);

  const scored = all.map(p => {
    const si = scoreProject(p);
    return { ...p, ...si };
  }).filter(p => p.score >= 40).sort((a, b) => b.score - a.score);

  process.stderr.write(`40+:${scored.length}\n`);
  console.log(JSON.stringify(scored, null, 2));
}

main();
