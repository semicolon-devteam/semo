import { NextRequest, NextResponse } from 'next/server';
import {
  listKPIMetrics,
  listKPIPeriods,
  batchCreateKPIMetrics,
  updateKPIMetric,
  deleteKPIMetric,
} from '@/lib/gfp';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const [metrics, periods] = await Promise.all([
      listKPIMetrics(id, period, limit),
      listKPIPeriods(id),
    ]);

    return NextResponse.json({
      metrics,
      periods,
      latestPeriod: periods[0] ?? null,
    });
  } catch (error) {
    console.error('KPI metrics list error:', error);
    return NextResponse.json({ error: 'Failed to fetch KPI metrics' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { period, source, metrics } = body;

    if (!period || !Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json(
        { error: 'period (string) and metrics (non-empty array) are required' },
        { status: 400 }
      );
    }

    const created = await batchCreateKPIMetrics(id, period, source ?? 'manual', metrics);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('KPI metrics create error:', error);
    return NextResponse.json({ error: 'Failed to create KPI metrics' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const body = await request.json();
    const { metric_id, ...data } = body;

    if (!metric_id) {
      return NextResponse.json({ error: 'metric_id is required' }, { status: 400 });
    }

    const metric = await updateKPIMetric(metric_id, data);
    if (!metric) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
    }
    return NextResponse.json(metric);
  } catch (error) {
    console.error('KPI metric update error:', error);
    return NextResponse.json({ error: 'Failed to update KPI metric' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const { searchParams } = new URL(request.url);
    const metricId = searchParams.get('metric_id');

    if (!metricId) {
      return NextResponse.json({ error: 'metric_id is required' }, { status: 400 });
    }

    const deleted = await deleteKPIMetric(metricId);
    if (!deleted) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('KPI metric delete error:', error);
    return NextResponse.json({ error: 'Failed to delete KPI metric' }, { status: 500 });
  }
}
