/**
 * GFP Design Step API
 *
 * Phase 4 내부 디자인 서브스텝 진행 체크 및 전진.
 * POST: 현재 스텝 체크 후 가능하면 자동 전진
 * GET: 현재 스텝 상태 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProject, getDesignStep, checkDesignStepAdvance, listSections } from '@/lib/gfp';
import { DESIGN_STEPS, matchesStep } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const designStep = await getDesignStep(id);
    const sections = await listSections(id, 4);

    const currentDef = DESIGN_STEPS.find((s) => s.step === designStep);
    const stepSections = currentDef
      ? sections.filter((s) => matchesStep(s.section_key, currentDef))
      : [];
    const blockingSections = stepSections
      .filter((s) => s.status !== 'approved')
      .map((s) => s.section_key);

    return NextResponse.json({
      design_step: designStep,
      can_advance: stepSections.length > 0 && blockingSections.length === 0,
      blocking_sections: blockingSections,
    });
  } catch (error) {
    console.error('GFP design step check error:', error);
    return NextResponse.json({ error: 'Failed to check design step' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (action === 'advance' || action === 'check') {
      const prevStep = (project.metadata?.design_step as number) ?? 1;
      const newStep = await checkDesignStepAdvance(id);

      return NextResponse.json({
        design_step: newStep,
        advanced: newStep > prevStep,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "advance" or "check".' },
      { status: 400 },
    );
  } catch (error) {
    console.error('GFP design step advance error:', error);
    return NextResponse.json({ error: 'Failed to advance design step' }, { status: 500 });
  }
}
