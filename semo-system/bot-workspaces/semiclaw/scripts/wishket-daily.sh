#!/bin/bash
# 위시캣 프로젝트 크롤링 및 Slack 전송

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_FILE="$SCRIPT_DIR/wishket-cache.json"
SLACK_CHANNEL="C0ABAE680PR"
SLACK_USER_MENTION="<@U01KH8V6ZHP>"

# Mock 데이터 (실제 크롤링 대신 사용)
MOCK_PROJECTS='[
  {
    "title": "AI 기반 헬스케어 앱 개발",
    "budget": "3000만원",
    "duration": "3개월",
    "skills": ["React Native", "TypeScript", "Node.js", "AWS", "AI"],
    "category": "헬스케어",
    "competition": 3,
    "url": "https://www.wishket.com/project/123",
    "deadline": "2026-03-10"
  },
  {
    "title": "커머스 웹사이트 리뉴얼",
    "budget": "1500만원",
    "duration": "2개월",
    "skills": ["React", "Next.js", "PostgreSQL", "Docker"],
    "category": "커머스",
    "competition": 8,
    "url": "https://www.wishket.com/project/124",
    "deadline": "2026-03-05"
  },
  {
    "title": "교육 플랫폼 백엔드 개발",
    "budget": "2000만원",
    "duration": "3개월",
    "skills": ["Kotlin", "Spring Boot", "MySQL", "Kubernetes"],
    "category": "교육",
    "competition": 5,
    "url": "https://www.wishket.com/project/125",
    "deadline": "2026-03-12"
  },
  {
    "title": "AI 챗봇 서비스 구축",
    "budget": "2500만원",
    "duration": "2.5개월",
    "skills": ["Python", "LLM", "ChatGPT", "AWS", "React"],
    "category": "AI",
    "competition": 4,
    "url": "https://www.wishket.com/project/126",
    "deadline": "2026-03-08"
  },
  {
    "title": "SaaS 관리자 대시보드",
    "budget": "1200만원",
    "duration": "2개월",
    "skills": ["Vue.js", "TypeScript", "Node.js", "PostgreSQL"],
    "category": "SaaS",
    "competition": 6,
    "url": "https://www.wishket.com/project/127",
    "deadline": "2026-03-15"
  }
]'

# Node.js 스코어링 스크립트
cat > "$SCRIPT_DIR/wishket-score.js" << 'ENDJS'
const TECH_STACK = {
  'TypeScript': 15, 'JavaScript': 12, 'React': 12, 'React Native': 15,
  'Node.js': 12, 'Next.js': 12, 'Kotlin': 15, 'Spring Boot': 15, 'Java': 10,
  'Supabase': 12, 'PostgreSQL': 10, 'MySQL': 8, 'MongoDB': 8, 'Redis': 8,
  'AWS': 10, 'Docker': 8, 'Kubernetes': 8, 'Terraform': 10,
  'Vue.js': 10, 'Angular': 8, 'HTML': 5, 'CSS': 5, 'Tailwind': 8,
  'AI': 12, 'Machine Learning': 10, 'ChatGPT': 10, 'LLM': 12,
  'Python': 8, 'Django': 8, 'Flask': 8, 'GraphQL': 8, 'REST API': 6,
};

const DOMAIN_PREFERENCES = {
  'AI': 10, '교육': 8, '헬스케어': 8, '커머스': 7, '핀테크': 9,
  '게임': 6, '엔터테인먼트': 7, 'SaaS': 9,
};

function scoreProject(project) {
  let score = 0;
  const reasons = [];

  // 기술 스택 매칭
  for (const skill of project.skills) {
    const skillLower = skill.toLowerCase();
    for (const [tech, weight] of Object.entries(TECH_STACK)) {
      if (skillLower.includes(tech.toLowerCase()) || tech.toLowerCase().includes(skillLower)) {
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

  // 예산 가산점
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

  // 경쟁률 가산점
  if (project.competition < 5) {
    score += 8;
    reasons.push('낮은 경쟁률: +8');
  } else if (project.competition < 10) {
    score += 4;
    reasons.append('보통 경쟁률: +4');
  }

  return { score, reasons };
}

function formatProject(project, scoreInfo) {
  const { score, reasons } = scoreInfo;
  const skillsText = project.skills.slice(0, 8).join(', ') || '정보 없음';
  
  return `*[${score}점] ${project.title}*
💰 예산: ${project.budget}
📅 기간: ${project.duration}
👥 경쟁률: ${project.competition}명
🛠 기술: ${skillsText}
🏷 도메인: ${project.category}
⏰ 마감: ${project.deadline}
🔗 ${project.url}`;
}

// stdin에서 JSON 읽기
const input = require('fs').readFileSync(0, 'utf-8');
const projects = JSON.parse(input);

// 스코어링
const scored = projects.map(p => {
  const scoreInfo = scoreProject(p);
  return { ...p, ...scoreInfo };
}).filter(p => p.score >= 40).sort((a, b) => b.score - a.score);

// Slack 메시지 생성
let message = `🦀 *위시켓 외주 프로젝트 (40점 이상)* - ${new Date().toISOString().split('T')[0]}\n\n`;

if (scored.length === 0) {
  message += '오늘은 40점 이상 프로젝트가 없습니다.';
} else {
  scored.forEach((p, i) => {
    message += formatProject(p, p);
    if (i < scored.length - 1) message += '\n\n---\n\n';
  });
}

console.log(JSON.stringify({ text: message }));
ENDJS

# 스코어링 실행
SCORED_MESSAGE=$(echo "$MOCK_PROJECTS" | node "$SCRIPT_DIR/wishket-score.js")

# Slack 전송
echo "📤 Slack 전송 중..."
curl -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$SLACK_CHANNEL\",
    \"text\": \"$SLACK_USER_MENTION\",
    \"blocks\": [
      {
        \"type\": \"section\",
        \"text\": {
          \"type\": \"mrkdwn\",
          \"text\": $(echo "$SCORED_MESSAGE" | jq -R .)
        }
      }
    ]
  }"

echo "✅ 완료"
