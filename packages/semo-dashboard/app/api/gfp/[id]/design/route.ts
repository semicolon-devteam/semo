/**
 * GFP Design Context API
 *
 * Phase 0-2 승인된 산출물에서 UI 컨텍스트를 구조화하여 추출.
 * DesignClaw stitch-bridge 스킬이 Stitch 프롬프트 생성 시 사용.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProject, listSections, getDesignStep } from '@/lib/gfp';
import { DESIGN_STEPS, matchesStep } from '@/types';

export const dynamic = 'force-dynamic';

interface ScreenInfo {
  name: string;
  type: string;
  purpose: string;
  source_section: string;
}

interface UIContext {
  project_name: string;
  service_domain: string | null;
  persona: string | null;
  service_type: string | null;
  constraints: string[];
  screens: ScreenInfo[];
  user_flows: string[];
  features: string[];
}

/**
 * POST /api/gfp/[id]/design/extract-context
 * Phase 0-2 승인 섹션에서 UI 관련 정보를 JSON으로 추출
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Phase 0-2 섹션 조회 (승인된 것만)
    const [phase0, phase1, phase2] = await Promise.all([
      listSections(id, 0),
      listSections(id, 1),
      listSections(id, 2),
    ]);

    const approved0 = phase0.filter((s) => s.status === 'approved');
    const approved1 = phase1.filter((s) => s.status === 'approved');
    const approved2 = phase2.filter((s) => s.status === 'approved');

    // Constitution에서 페르소나, 서비스 형태, 제약사항 추출
    const persona = extractFromSections(approved0, ['persona', 'user', 'identity']);
    const serviceType = extractFromSections(approved0, ['service', 'platform', 'form']);
    const constraints = extractListFromSections(approved0, [
      'constraint',
      'non-negotiable',
      'accessibility',
    ]);

    // PRD에서 기능 목록, 유저 스토리 추출
    const features = extractListFromSections(approved2, ['feature', 'function', 'requirement']);
    const userFlows = extractListFromSections(approved1.concat(approved2), [
      'flow',
      'journey',
      'story',
      'scenario',
    ]);

    // 기능 목록에서 화면 도출
    const screens = deriveScreens(features, approved2);

    const context: UIContext = {
      project_name: project.project_name,
      service_domain: project.service_domain,
      persona,
      service_type: serviceType,
      constraints,
      screens,
      user_flows: userFlows,
      features,
    };

    return NextResponse.json(context);
  } catch (error) {
    console.error('GFP design context extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract design context' }, { status: 500 });
  }
}

/**
 * GET /api/gfp/[id]/design
 * Phase 4 디자인 섹션 요약 (Stitch 프롬프트 + 결과)
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sections = await listSections(id, 4);

    const prompts = sections.filter((s) => s.section_key.startsWith('stitch-prompt-'));
    const results = sections.filter((s) => s.section_key.startsWith('stitch-result-'));
    const summary = sections.find((s) => s.section_key === 'design-spec-summary');

    // Design step information
    const designStep = await getDesignStep(id);
    const steps = DESIGN_STEPS.map((def) => {
      const stepSections = sections.filter((s) => matchesStep(s.section_key, def));
      const allApproved =
        stepSections.length > 0 && stepSections.every((s) => s.status === 'approved');
      const hasAny = stepSections.length > 0;
      return {
        ...def,
        sections: stepSections,
        status: allApproved
          ? ('completed' as const)
          : hasAny
            ? ('in-progress' as const)
            : ('pending' as const),
      };
    });

    return NextResponse.json({
      // New: design step data
      design_step: designStep,
      steps,
      // Backward compat
      prompts,
      results,
      summary: summary ?? null,
      total_prompts: prompts.length,
      completed_results: results.filter((r) => r.status === 'approved').length,
    });
  } catch (error) {
    console.error('GFP design fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch design data' }, { status: 500 });
  }
}

// ── Helpers ──

function extractFromSections(
  sections: { content: string; section_key: string }[],
  keywords: string[],
): string | null {
  for (const section of sections) {
    const lower = section.section_key.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      // 첫 문단 또는 첫 200자 반환
      const firstParagraph = section.content.split('\n\n')[0];
      return firstParagraph.slice(0, 500);
    }
  }
  // 키워드 매칭 없으면 전체 content에서 키워드 포함 문단 탐색
  for (const section of sections) {
    const paragraphs = section.content.split('\n\n');
    for (const p of paragraphs) {
      if (keywords.some((k) => p.toLowerCase().includes(k))) {
        return p.slice(0, 500);
      }
    }
  }
  return null;
}

function extractListFromSections(
  sections: { content: string; section_key: string }[],
  keywords: string[],
): string[] {
  const items: string[] = [];
  for (const section of sections) {
    const lines = section.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // 마크다운 리스트 아이템 (- , * , 1. , [ ] 등)
      if (/^[-*]\s|^\d+\.\s|^- \[/.test(trimmed)) {
        const text = trimmed.replace(/^[-*]\s+|^\d+\.\s+|^- \[.\]\s*/, '').trim();
        if (
          text.length > 5 &&
          keywords.some(
            (k) => section.section_key.toLowerCase().includes(k) || text.toLowerCase().includes(k),
          )
        ) {
          items.push(text);
        }
      }
    }
  }
  return [...new Set(items)].slice(0, 50);
}

function deriveScreens(
  features: string[],
  prdSections: { content: string; section_key: string; title: string }[],
): ScreenInfo[] {
  const SCREEN_KEYWORDS: Record<string, string[]> = {
    Auth: ['login', 'signup', 'register', 'auth', '로그인', '가입', '인증'],
    Dashboard: ['dashboard', 'home', 'overview', '대시보드', '홈', '개요', '통계'],
    'List/Table': ['list', 'search', 'filter', 'browse', '목록', '검색', '필터', '조회'],
    Detail: ['detail', 'profile', 'view', '상세', '프로필', '정보'],
    Form: ['create', 'edit', 'new', 'form', '생성', '등록', '수정', '작성'],
    Settings: ['settings', 'preferences', '설정', '환경설정'],
    Onboarding: ['onboarding', 'tutorial', 'welcome', '온보딩', '가이드'],
  };

  const screens: ScreenInfo[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const lower = feature.toLowerCase();
    for (const [screenType, keywords] of Object.entries(SCREEN_KEYWORDS)) {
      if (keywords.some((k) => lower.includes(k))) {
        const name = feature.slice(0, 50);
        if (!seen.has(name)) {
          seen.add(name);
          screens.push({
            name,
            type: screenType,
            purpose: feature,
            source_section: 'prd',
          });
        }
        break;
      }
    }
  }

  // PRD 섹션에서 추가 화면 도출
  for (const section of prdSections) {
    const lower = section.content.toLowerCase();
    for (const [screenType, keywords] of Object.entries(SCREEN_KEYWORDS)) {
      if (keywords.some((k) => lower.includes(k)) && !seen.has(section.title)) {
        seen.add(section.title);
        screens.push({
          name: section.title,
          type: screenType,
          purpose: `PRD section: ${section.section_key}`,
          source_section: section.section_key,
        });
      }
    }
  }

  return screens;
}
