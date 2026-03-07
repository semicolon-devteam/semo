#!/usr/bin/env node
/**
 * Wishket 외주 프로젝트 크롤러
 * Semicolon 팀 스택 기준 스코어링
 */

const https = require('https');
const http = require('http');

// Semicolon 팀 기술 스택 (가중치 포함)
const TECH_STACK = {
  // 핵심 스택 (높은 가중치)
  'TypeScript': 15,
  'JavaScript': 12,
  'React': 12,
  'React Native': 15,
  'Node.js': 12,
  'Next.js': 12,
  'Kotlin': 15,
  'Spring Boot': 15,
  'Java': 10,
  
  // 인프라/DB
  'Supabase': 12,
  'PostgreSQL': 10,
  'MySQL': 8,
  'MongoDB': 8,
  'Redis': 8,
  'AWS': 10,
  'Docker': 8,
  'Kubernetes': 8,
  'Terraform': 10,
  
  // 프론트엔드
  'Vue.js': 10,
  'Angular': 8,
  'HTML': 5,
  'CSS': 5,
  'Tailwind': 8,
  
  // AI/ML
  'AI': 12,
  'Machine Learning': 10,
  'ChatGPT': 10,
  'LLM': 12,
  
  // 기타
  'Python': 8,
  'Django': 8,
  'Flask': 8,
  'GraphQL': 8,
  'REST API': 6,
};

// 도메인 선호도
const DOMAIN_PREFERENCES = {
  'AI': 10,
  '교육': 8,
  '헬스케어': 8,
  '커머스': 7,
  '핀테크': 9,
  '게임': 6,
  '엔터테인먼트': 7,
  'SaaS': 9,
};

async function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseProjects(html) {
  const projects = [];
  
  // 위시캣 프로젝트 카드 파싱 (HTML 구조 기반)
  // 실제 HTML 구조에 맞춰 정규식 조정 필요
  const projectPattern = /<article[^>]*class="[^"]*project[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  const matches = html.matchAll(projectPattern);
  
  for (const match of matches) {
    const cardHTML = match[1];
    
    try {
      const project = {
        title: extractText(cardHTML, /<h[23][^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/h[23]>/i),
        budget: extractText(cardHTML, /예산[:\s]*([0-9,]+만원|[0-9,]+원)/i),
        duration: extractText(cardHTML, /기간[:\s]*([^<]+)/i),
        competition: extractText(cardHTML, /지원자[:\s]*(\d+)명/i),
        skills: extractSkills(cardHTML),
        category: extractText(cardHTML, /카테고리[:\s]*([^<]+)/i) || extractText(cardHTML, /<span[^>]*class="[^"]*category[^"]*"[^>]*>(.*?)<\/span>/i),
        url: extractURL(cardHTML),
        deadline: extractText(cardHTML, /마감[:\s]*([^<]+)/i),
      };
      
      if (project.title) {
        projects.push(project);
      }
    } catch (e) {
      console.error('프로젝트 파싱 오류:', e.message);
    }
  }
  
  return projects;
}

function extractText(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1].replace(/<[^>]*>/g, '').trim() : '';
}

function extractURL(html) {
  const match = html.match(/href="([^"]*(?:project|detail)[^"]*)"/i);
  return match ? `https://www.wishket.com${match[1]}` : '';
}

function extractSkills(html) {
  const skills = [];
  const skillPattern = /<(?:span|div)[^>]*class="[^"]*(?:skill|tech|tag)[^"]*"[^>]*>(.*?)<\/(?:span|div)>/gi;
  const matches = html.matchAll(skillPattern);
  
  for (const match of matches) {
    const skill = match[1].replace(/<[^>]*>/g, '').trim();
    if (skill && skill.length < 30) {
      skills.push(skill);
    }
  }
  
  return skills;
}

function scoreProject(project) {
  let score = 0;
  const reasons = [];
  
  // 기술 스택 매칭
  for (const skill of project.skills) {
    for (const [tech, weight] of Object.entries(TECH_STACK)) {
      if (skill.toLowerCase().includes(tech.toLowerCase()) || 
          tech.toLowerCase().includes(skill.toLowerCase())) {
        score += weight;
        reasons.push(`${tech}: +${weight}`);
        break;
      }
    }
  }
  
  // 도메인 선호도
  const title = project.title.toLowerCase();
  const category = project.category.toLowerCase();
  for (const [domain, weight] of Object.entries(DOMAIN_PREFERENCES)) {
    if (title.includes(domain.toLowerCase()) || category.includes(domain.toLowerCase())) {
      score += weight;
      reasons.push(`${domain} 도메인: +${weight}`);
    }
  }
  
  // 예산 가산점 (큰 프로젝트 선호)
  if (project.budget) {
    const budgetMatch = project.budget.match(/(\d+)/);
    if (budgetMatch) {
      const amount = parseInt(budgetMatch[1]);
      if (amount >= 1000) {
        score += 10;
        reasons.push('고예산: +10');
      } else if (amount >= 500) {
        score += 5;
        reasons.push('중예산: +5');
      }
    }
  }
  
  // 경쟁률 가산점 (낮은 경쟁률 선호)
  if (project.competition) {
    const competitionMatch = project.competition.match(/(\d+)/);
    if (competitionMatch) {
      const count = parseInt(competitionMatch[1]);
      if (count < 5) {
        score += 8;
        reasons.push('낮은 경쟁률: +8');
      } else if (count < 10) {
        score += 4;
        reasons.push('보통 경쟁률: +4');
      }
    }
  }
  
  return { score, reasons };
}

function formatProject(project, scoreInfo) {
  const lines = [
    `*[${scoreInfo.score}점] ${project.title}*`,
    `💰 예산: ${project.budget || '미공개'}`,
    `📅 기간: ${project.duration || '미정'}`,
    `👥 경쟁률: ${project.competition || '정보 없음'}명`,
    `🛠 기술: ${project.skills.slice(0, 8).join(', ') || '정보 없음'}`,
    `🏷 도메인: ${project.category || '기타'}`,
  ];
  
  if (project.deadline) {
    lines.push(`⏰ 마감: ${project.deadline}`);
  }
  
  if (project.url) {
    lines.push(`🔗 ${project.url}`);
  }
  
  return lines.join('\n');
}

async function main() {
  console.log('🦀 위시캣 프로젝트 크롤링 시작...');
  
  try {
    // 위시캣 프로젝트 목록 페이지 크롤링
    const url = 'https://www.wishket.com/project/';
    const html = await fetchHTML(url);
    
    const projects = parseProjects(html);
    console.log(`📦 총 ${projects.length}개 프로젝트 발견`);
    
    // 스코어링
    const scoredProjects = projects.map(project => {
      const scoreInfo = scoreProject(project);
      return { ...project, ...scoreInfo };
    }).filter(p => p.score >= 40)
      .sort((a, b) => b.score - a.score);
    
    console.log(`✨ 40점 이상 프로젝트: ${scoredProjects.length}개`);
    
    // JSON 출력 (OpenClaw에서 처리)
    console.log('\n--- PROJECTS_JSON ---');
    console.log(JSON.stringify(scoredProjects, null, 2));
    console.log('--- END_PROJECTS_JSON ---');
    
  } catch (error) {
    console.error('❌ 크롤링 오류:', error.message);
    process.exit(1);
  }
}

main();
