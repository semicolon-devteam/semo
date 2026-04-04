import { NextRequest, NextResponse } from 'next/server';
import { createMaterial, listMaterials, createSectionsFromMapping } from '@/lib/gfp';
import type { GfpPhaseMapping } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const materials = await listMaterials(id);
    return NextResponse.json(materials);
  } catch (error) {
    console.error('GFP materials list error:', error);
    return NextResponse.json({ error: 'Failed to list materials' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, phase_mapping } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const material = await createMaterial({
      service_id: id,
      content,
      phase_mapping: phase_mapping as GfpPhaseMapping[] | undefined,
    });

    // If phase_mapping provided, auto-create sections from high-coverage phases
    if (phase_mapping && Array.isArray(phase_mapping)) {
      const highCoverage = phase_mapping.filter(
        (m: GfpPhaseMapping) => m.coverage >= 0.3 && m.sections.length > 0
      );
      if (highCoverage.length > 0) {
        const count = await createSectionsFromMapping(id, highCoverage);
        return NextResponse.json({ material, sections_created: count }, { status: 201 });
      }
    }

    return NextResponse.json({ material, sections_created: 0 }, { status: 201 });
  } catch (error) {
    console.error('GFP material create error:', error);
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 });
  }
}
