/**
 * Sandbox Export API — 샌드박스 실행 결과 내보내기.
 * teardown 전 전체 섹션, 비용, 타이밍 등을 JSON으로 다운로드.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSandboxReport } from '@/lib/sandbox';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');

    if (!serviceId) {
      return NextResponse.json({ error: 'service_id required' }, { status: 400 });
    }

    const report = await getSandboxReport(serviceId, { include_sections: true });
    if (!report) {
      return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 });
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      project: {
        service_id: report.project.service_id,
        project_name: report.project.project_name,
        service_domain: report.project.service_domain,
        created_at: report.project.created_at,
        current_phase: report.project.current_phase,
        status: report.project.status,
      },
      sandbox_config: {
        mode: report.config.mode,
        depth: report.config.depth,
        scenario_id: report.config.scenario_id ?? null,
        initial_description: report.config.initial_description ?? null,
        virtual_po: report.config.virtual_po,
      },
      run_stats: report.run_stats,
      sections_by_phase: report.sections_by_phase,
      sections_detail: report.sections_detail?.map((s) => ({
        section_id: s.section_id,
        phase: s.phase,
        section_key: s.section_key,
        title: s.title,
        content: s.content,
        status: s.status,
        source: s.source,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      verification: report.verification,
    };

    const filename = `sandbox-export-${report.project.service_domain}-${Date.now()}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[SANDBOX EXPORT] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
