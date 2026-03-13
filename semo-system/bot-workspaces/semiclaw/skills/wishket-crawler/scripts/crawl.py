#!/usr/bin/env python3
"""
Wishket 외주 프로젝트 크롤러 v2
- 로그인 처리 추가
- BASIC 등급 필터링 (BOOST/PRO/PRIME 전용 프로젝트 제외)
"""

import asyncio
import json
import re
import os
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

# 위시켓 계정 정보 (환경 변수 or 직접 설정)
WISHKET_EMAIL = os.getenv('WISHKET_EMAIL', 'reus@semi-colon.space')
WISHKET_PASSWORD = os.getenv('WISHKET_PASSWORD', 'team-semicolon')

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

async def login_wishket(page):
    """위시켓 로그인 처리"""
    print('🔐 위시켓 로그인 중...')
    
    try:
        await page.goto('https://www.wishket.com/accounts/login/', wait_until='networkidle', timeout=15000)
        
        # 로그인 폼 찾기 (실제 셀렉터는 위시켓 HTML 확인 후 수정 필요)
        # 방법 1: name 속성
        email_input = await page.query_selector('input[name="username"]') or \
                      await page.query_selector('input[type="email"]') or \
                      await page.query_selector('#id_username')
        
        password_input = await page.query_selector('input[name="password"]') or \
                        await page.query_selector('input[type="password"]') or \
                        await page.query_selector('#id_password')
        
        if not email_input or not password_input:
            print('❌ 로그인 폼을 찾을 수 없습니다.')
            return False
        
        # 로그인 정보 입력
        await email_input.fill(WISHKET_EMAIL)
        await password_input.fill(WISHKET_PASSWORD)
        
        # 로그인 버튼 클릭
        login_button = await page.query_selector('button[type="submit"]') or \
                      await page.query_selector('.btn-login') or \
                      await page.query_selector('input[type="submit"]')
        
        if login_button:
            await login_button.click()
        else:
            # 버튼을 못 찾으면 Enter 키 시도
            await password_input.press('Enter')
        
        # 로그인 완료 대기 (URL 변경 or 특정 요소 확인)
        try:
            await page.wait_for_url('**/project/**', timeout=10000)
        except:
            # URL 변경이 없으면 로그인 성공 여부를 다른 방법으로 확인
            await page.wait_for_timeout(3000)
        
        # 로그인 성공 확인 (로그인 폼이 사라졌는지 체크)
        is_logged_in = await page.query_selector('.user-info') or \
                      await page.query_selector('.logout') or \
                      not await page.query_selector('input[name="username"]')
        
        if is_logged_in:
            print('✅ 로그인 성공')
            return True
        else:
            print('❌ 로그인 실패 (자격 증명 확인 필요)')
            return False
            
    except Exception as e:
        print(f'❌ 로그인 오류: {e}')
        return False

async def check_project_access(page, project_url):
    """프로젝트 접근 권한 확인 (BASIC 등급으로 지원 가능한지)"""
    try:
        await page.goto(project_url, wait_until='networkidle', timeout=10000)
        
        # 등급 제한 메시지 확인
        grade_restriction = await page.query_selector('.grade-restriction') or \
                           await page.query_selector('.partner-upgrade-notice') or \
                           await page.query_selector('text=/BOOST|PRO|PRIME.*전용/')
        
        if grade_restriction:
            return False  # 등급 제한으로 접근 불가
        
        # "지원하기" 버튼 활성화 여부 확인
        apply_button = await page.query_selector('.btn-apply:not([disabled])') or \
                      await page.query_selector('button:has-text("지원하기"):not([disabled])')
        
        return apply_button is not None
        
    except Exception as e:
        print(f'⚠️ 프로젝트 접근 확인 오류: {e}')
        return False  # 오류 시 안전하게 제외

async def crawl_wishket():
    """위시켓 프로젝트 크롤링 (로그인 + 등급 필터링)"""
    print('🦀 위시켓 프로젝트 크롤링 시작...')
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # 1. 로그인
            if not await login_wishket(page):
                print('❌ 로그인 실패로 크롤링 중단')
                await browser.close()
                return []
            
            # 2. 프로젝트 목록 페이지로 이동
            print('📋 프로젝트 목록 로딩 중...')
            await page.goto('https://www.wishket.com/project/', wait_until='networkidle', timeout=15000)
            
            # 프로젝트 카드 찾기 (실제 HTML 구조에 맞춰 수정 필요)
            await page.wait_for_selector('.project-info-box, .project-card, .project-item', timeout=10000)
            
            projects = []
            project_cards = await page.query_selector_all('.project-info-box, .project-card, .project-item')
            
            print(f'📦 총 {len(project_cards)}개 프로젝트 발견')
            
            for idx, card in enumerate(project_cards[:20], 1):  # 최대 20개만 크롤링
                try:
                    # URL 먼저 추출
                    link_el = await card.query_selector('a.project-link, a[href*="/project/"]')
                    url = await link_el.get_attribute('href') if link_el else ''
                    if url and not url.startswith('http'):
                        url = f'https://www.wishket.com{url}'
                    
                    if not url:
                        continue
                    
                    # 등급 제한 확인 (목록 화면에서 먼저 체크)
                    grade_badge = await card.query_selector('.grade-badge, .partner-grade, [class*="boost"], [class*="prime"], [class*="pro"]')
                    if grade_badge:
                        grade_text = await grade_badge.inner_text()
                        if any(g in grade_text.upper() for g in ['BOOST', 'PRO', 'PRIME']):
                            print(f'⏭️  [{idx}] {grade_text} 전용 프로젝트 스킵')
                            continue
                    
                    # 프로젝트 정보 추출
                    # 제목
                    title_el = await card.query_selector('.title-text, .project-title, h3, h4')
                    title = await title_el.inner_text() if title_el else ''
                    
                    # 예산
                    budget_el = await card.query_selector('.price, .budget, [class*="price"]')
                    budget = await budget_el.inner_text() if budget_el else ''
                    
                    # 기간
                    duration_el = await card.query_selector('.category .text, .duration, [class*="period"]')
                    duration = await duration_el.inner_text() if duration_el else ''
                    
                    # 기술 스택
                    skills = []
                    skill_els = await card.query_selector_all('.skills .skill, .tech-stack li, .tag')
                    for skill_el in skill_els:
                        skill = await skill_el.inner_text()
                        skills.append(skill.strip())
                    
                    # 경쟁률 (지원자 수)
                    competition = 0
                    comp_el = await card.query_selector('.proposal-count, .applicant-count')
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
                    
                    print(f'✅ [{idx}] {title[:30]}... (스킬: {len(skills)}개)')
                    projects.append(project)
                    
                except Exception as e:
                    print(f'⚠️  [{idx}] 프로젝트 파싱 오류: {e}')
                    continue
            
            # 3. 스코어링
            print(f'\n📊 스코어링 중...')
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
            
            print(f'\n✨ 40점 이상 프로젝트: {len(filtered)}개')
            
            # JSON 출력
            print(json.dumps(filtered, ensure_ascii=False, indent=2))
            
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
