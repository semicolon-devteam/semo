#!/usr/bin/env node
/**
 * Wishket 외주(도급) 프로젝트 크롤러 v3
 * XHR로 프로젝트 목록 가져오기 + Semicolon 팀 스택 스코어링
 */

const https = require('https');

function fetchHTML(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'X-Requested-With': 'XMLHttpRequest',
        ...headers,
      },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseProjects(html) {
  const projects = [];
  // Split by project-info-box
  const cards = html.split('project-info-box');
  
  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];
    try {
      // Title
      const titleMatch = card.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)/i) ||
                         card.match(/<a[^>]*class="[^"]*project-title[^"]*"[^>]*>([^<]+)/i);
      
      // URL
      const urlMatch = card.match(/href="(\/project\/\d+[^"]*)"/) ||
                       card.match(/href="([^"]*project[^"]*detail[^"]*)"/);
      
      // Budget/Price
      const budgetMatch = card.match(/(?:예산|금액|가격)[^<]*<[^>]*>([^<]*만원[^<]*)/i) ||
                          card.match(/(\d[\d,]*만원)/i) ||
                          card.match(/(\d[\d,]*원)/i);
      
      // Duration
      const durationMatch = card.match(/(\d+개월|\d+일|\d+주)/i);
      
      // Competition/proposals
      const competitionMatch = card.match(/지원자?\s*(?:<[^>]*>)*\s*(\d+)/i) ||
                               card.match(/(\d+)명?\s*지원/i);
      
      // Skills/tags
      const skills = [];
      const skillRegex = /class="[^"]*(?:skill|stack|tag)[^"]*"[^>]*>([^<]+)</gi;
      let skillMatch;
      while ((skillMatch = skillRegex.exec(card)) !== null) {
        const s = skillMatch[1].trim();
        if (s && s.length < 30 && !s.includes('등록') && !s.includes('전체')) {
          skills.push(s);
        }
      }
      
      // Category
      const categoryMatch = card.match(/class="[^"]*category[^"]*"[^>]*>([^<]+)/i);
      
      // Work type (도급/기간제)
      const isContract = card.includes('도급') || card.includes('프로젝트 의뢰');
      const isTerm = card.includes('기간제') || card.includes('상주');

      const title = titleMatch ? titleMatch[1].trim() : '';
      if (!title) continue;
      
      projects.push({
        title,
        url: urlMatch ? `https://www.wishket.com${urlMatch[1]}` : '',
        budget: budgetMatch ? budgetMatch[1] || budgetMatch[0] : '',
        duration: durationMatch ? durationMatch[1] : '',
        competition: competitionMatch ? parseInt(competitionMatch[1]) : null,
        skills,
        category: categoryMatch ? categoryMatch[1].trim() : '',
        workType: isContract ? '도급' : (isTerm ? '기간제' : ''),
      });
    } catch (e) {
      // skip
    }
  }
  return projects;
}

// Semicolon 팀 스택
const TECH_STACK = {
  'TypeScript': 15, 'JavaScript': 12, 'React': 12, 'React Native': 15,
  'Node.js': 12, 'Next.js': 12, 'Kotlin': 15, 'Spring Boot': 15, 'Java': 10,
  'Spring': 10, 'Supabase': 12, 'PostgreSQL': 10, 'MySQL': 8, 'MongoDB': 8,
  'Redis': 8, 'AWS': 10, 'Docker': 8, 'Kubernetes': 8, 'Terraform': 10,
  'Vue.js': 10, 'Angular': 8, 'Tailwind': 8,
  'AI': 12, 'Machine Learning': 10, 'ChatGPT': 10, 'LLM': 12,
  'Python': 8, 'Django': 8, 'Flask': 8, 'GraphQL': 8, 'REST API': 6,
  'Flutter': 8, 'Swift': 6, 'iOS': 6, 'Android': 6, 'Firebase': 8,
  'Express': 10, 'NestJS': 10, 'Nest.js': 10,
};

const DOMAIN_PREFERENCES = {
  'AI': 10, '교육': 8, '헬스케어': 8, '의료': 8, '커머스': 7, '쇼핑몰': 7,
  '핀테크': 9, '금융': 8, '게임': 6, '엔터테인먼트': 7, 'SaaS': 9,
  '플랫폼': 7, 'ERP': 6, 'CRM': 6,
};

function scoreProject(project) {
  let score = 0;
  const reasons = [];

  // Tech stack matching
  const allText = [project.title, ...project.skills, project.category].join(' ').toLowerCase();
  const matched = new Set();
  
  for (const [tech, weight] of Object.entries(TECH_STACK)) {
    if (matched.has(tech)) continue;
    const techLower = tech.toLowerCase();
    
    for (const skill of project.skills) {
      if (skill.toLowerCase().includes(techLower) || techLower.includes(skill.toLowerCase())) {
        score += weight;
        reasons.push(`${tech}: +${weight}`);
        matched.add(tech);
        break;
      }
    }
    
    if (!matched.has(tech) && allText.includes(techLower)) {
      score += Math.floor(weight * 0.7);
      reasons.push(`${tech}(제목): +${Math.floor(weight * 0.7)}`);
      matched.add(tech);
    }
  }

  // Domain preferences
  for (const [domain, weight] of Object.entries(DOMAIN_PREFERENCES)) {
    if (allText.includes(domain.toLowerCase())) {
      score += weight;
      reasons.push(`${domain} 도메인: +${weight}`);
    }
  }

  // Budget bonus
  if (project.budget) {
    const budgetNum = project.budget.replace(/[,\s]/g, '').match(/(\d+)/);
    if (budgetNum) {
      const amount = parseInt(budgetNum[1]);
      if (amount >= 1000) { score += 10; reasons.push('고예산: +10'); }
      else if (amount >= 500) { score += 5; reasons.push('중예산: +5'); }
    }
  }

  // Competition bonus
  if (project.competition !== null) {
    if (project.competition < 5) { score += 8; reasons.push('낮은 경쟁률: +8'); }
    else if (project.competition < 10) { score += 4; reasons.push('보통 경쟁률: +4'); }
  }

  return { score, reasons };
}

async function main() {
  console.error('🦀 위시캣 프로젝트 크롤링 시작...');
  
  let allProjects = [];
  
  for (let page = 1; page <= 3; page++) {
    try {
      const html = await fetchHTML(`https://www.wishket.com/project/?page=${page}`);
      const projects = parseProjects(html);
      console.error(`📦 페이지 ${page}: ${projects.length}개 프로젝트`);
      allProjects.push(...projects);
    } catch (e) {
      console.error(`❌ 페이지 ${page} 오류: ${e.message}`);
    }
  }
  
  // Deduplicate
  const seen = new Set();
  allProjects = allProjects.filter(p => {
    if (seen.has(p.title)) return false;
    seen.add(p.title);
    return true;
  });

  console.error(`📦 총 ${allProjects.length}개 프로젝트 (중복 제거 후)`);

  // Score and filter
  const scored = allProjects.map(p => {
    const { score, reasons } = scoreProject(p);
    return { ...p, score, reasons };
  }).filter(p => p.score >= 40)
    .sort((a, b) => b.score - a.score);

  console.error(`✨ 40점 이상: ${scored.length}개`);

  // Output JSON
  console.log(JSON.stringify(scored, null, 2));
}

main().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
