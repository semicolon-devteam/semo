#!/usr/bin/env python3
"""
Wishket 외주 프로젝트 크롤러
Semicolon 팀 스택 기준 스코어링
"""

import asyncio
import json
import re
from datetime import datetime
from playwright.async_api import async_playwright

# Semicolon 팀 기술 스택 (가중치 포함)
TECH_STACK = {
    # 핵심 스택
    'TypeScript': 15, 'JavaScript': 12, 'React': 12, 'React Native': 15,
    'Node.js': 12, 'Next.js': 12, 'Kotlin': 15, 'Spring Boot': 15, 'Java': 10,
    # 인프라/DB
    'Supabase': 12, 'PostgreSQL': 10, 'MySQL': 8, 'MongoDB': 8, 'Redis': 8,
    'AWS': 10, 'Docker': 8, 'Kubernetes': 8, 'Terraform': 10,
    # 프론트엔드
    'Vue.js': 10, 'Angular': 8, 'HTML': 5, 'CSS': 5, 'Tailwind': 8,
    # AI/ML
    'AI': 12, 'Machine Learning': 10, 'ChatGPT': 10, 'LLM': 12,
    # 기타
    'Python': 8, 'Django': 8, 'Flask': 8, 'GraphQL': 8, 'REST API': 6,
}

# 도메인 선호도
DOMAIN_PREFERENCES = {
    'AI': 10, '교육': 8, '헬스케어': 8, '커머스': 7, '핀테크': 9,
    '게임': 6, '엔터테인먼트': 7, 'SaaS': 9,
}

def score_project(project):
    """프로젝트 스코어링"""
    score = 0
    reasons = []
    
    # 기술 스택 매칭
    for skill in project.get('skills', []):
        skill_lower = skill.lower()
        for tech, weight in TECH_STACK.items():
            if tech.lower() in skill_lower or skill_lower in tech.lower():
                score += weight
                reasons.append(f'{tech}: +{weight}')
                break
    
    # 도메인 선호도
    title = project.get('title', '').lower()
    category = project.get('category', '').lower()
    for domain, weight in DOMAIN_PREFERENCES.items():
        if domain.lower() in title or domain.lower() in category:
            score += weight
            reasons.append(f'{domain} 도메인: +{weight}')
    
    # 예산 가산점
    budget_text = project.get('budget', '')
    budget_match = re.search(r'(\d+)', budget_text)
    if budget_match:
        amount = int(budget_match.group(1))
        if amount >= 1000:
            score += 10
            reasons.append('고예산: +10')
        elif amount >= 500:
            score += 5
            reasons.append('중예산: +5')
    
    # 경쟁률 가산점
    competition = project.get('competition', 0)
    if competition < 5:
        score += 8
        reasons.append('낮은 경쟁률: +8')
    elif competition < 10:
        score += 4
        reasons.append('보통 경쟁률: +4')
    
    return score, reasons

def format_project(project, score_info):
    """프로젝트 포맷팅"""
    score, reasons = score_info
    skills_text = ', '.join(project.get('skills', [])[:8]) or '정보 없음'
    
    lines = [
        f"*[{score}점] {project.get('title', '제목 없음')}*",
        f"💰 예산: {project.get('budget', '미공개')}",
        f"📅 기간: {project.get('duration', '미정')}",
        f"👥 경쟁률: {project.get('competition', '정보 없음')}명",
        f"🛠 기술: {skills_text}",
        f"🏷 도메인: {project.get('category', '기타')}",
    ]
    
    if project.get('deadline'):
        lines.append(f"⏰ 마감: {project['deadline']}")
    
    if project.get('url'):
        lines.append(f"🔗 {project['url']}")
    
    return '\n'.join(lines)

async def crawl_wishket():
    """위시캣 프로젝트 크롤링"""
    print('🦀 위시켓 프로젝트 크롤링 시작...')
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # 위시켓 프로젝트 목록 페이지
            await page.goto('https://www.wishket.com/project/', wait_until='networkidle')
            
            # 프로젝트 카드 찾기 (실제 HTML 구조에 맞춰 수정 필요)
            await page.wait_for_selector('.project-info-box', timeout=10000)
            
            projects = []
            project_cards = await page.query_selector_all('.project-info-box')
            
            print(f'📦 총 {len(project_cards)}개 프로젝트 발견')
            
            for card in project_cards[:20]:  # 최대 20개만 크롤링
                try:
                    # 제목
                    title_el = await card.query_selector('.title-text')
                    title = await title_el.inner_text() if title_el else ''
                    
                    # 예산
                    budget_el = await card.query_selector('.price')
                    budget = await budget_el.inner_text() if budget_el else ''
                    
                    # 기간
                    duration_el = await card.query_selector('.category .text')
                    duration = await duration_el.inner_text() if duration_el else ''
                    
                    # 기술 스택
                    skills = []
                    skill_els = await card.query_selector_all('.skills .skill')
                    for skill_el in skill_els:
                        skill = await skill_el.inner_text()
                        skills.append(skill.strip())
                    
                    # URL
                    link_el = await card.query_selector('a.project-link')
                    url = await link_el.get_attribute('href') if link_el else ''
                    if url and not url.startswith('http'):
                        url = f'https://www.wishket.com{url}'
                    
                    # 경쟁률 (지원자 수)
                    competition = 0
                    comp_el = await card.query_selector('.proposal-count')
                    if comp_el:
                        comp_text = await comp_el.inner_text()
                        comp_match = re.search(r'(\d+)', comp_text)
                        if comp_match:
                            competition = int(comp_match.group(1))
                    
                    project = {
                        'title': title.strip(),
                        'budget': budget.strip(),
                        'duration': duration.strip(),
                        'skills': skills,
                        'url': url,
                        'competition': competition,
                        'category': '',  # 카테고리 정보가 있다면 추가
                        'deadline': '',  # 마감일 정보가 있다면 추가
                    }
                    
                    projects.append(project)
                    
                except Exception as e:
                    print(f'프로젝트 파싱 오류: {e}')
                    continue
            
            # 스코어링
            scored_projects = []
            for project in projects:
                score, reasons = score_project(project)
                scored_projects.append({
                    **project,
                    'score': score,
                    'reasons': reasons
                })
            
            # 40점 이상 필터링 & 정렬
            filtered = [p for p in scored_projects if p['score'] >= 40]
            filtered.sort(key=lambda x: x['score'], reverse=True)
            
            print(f'✨ 40점 이상 프로젝트: {len(filtered)}개')
            
            # JSON 출력
            print('\n--- PROJECTS_JSON ---')
            print(json.dumps(filtered, ensure_ascii=False, indent=2))
            print('--- END_PROJECTS_JSON ---')
            
            await browser.close()
            return filtered
            
        except Exception as e:
            print(f'❌ 크롤링 오류: {e}')
            await browser.close()
            return []

def main():
    """메인 함수"""
    projects = asyncio.run(crawl_wishket())
    return projects

if __name__ == '__main__':
    main()
