import { NextRequest, NextResponse } from 'next/server';
import { listFeatures, createFeature, updateFeature, deleteFeature, getProject } from '@/lib/gfp';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const features = await listFeatures(id);
    return NextResponse.json(features);
  } catch (error) {
    console.error('Features list error:', error);
    return NextResponse.json({ error: 'Failed to fetch features' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, category, status, parent_id, sort_order, metadata } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const feature = await createFeature({
      project_id: id,
      name,
      description,
      category,
      status,
      parent_id,
      sort_order,
      metadata,
    });
    return NextResponse.json(feature, { status: 201 });
  } catch (error) {
    console.error('Feature create error:', error);
    return NextResponse.json({ error: 'Failed to create feature' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const body = await request.json();
    const { feature_id, ...data } = body;

    if (!feature_id) {
      return NextResponse.json({ error: 'feature_id is required' }, { status: 400 });
    }

    const feature = await updateFeature(feature_id, data);
    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    return NextResponse.json(feature);
  } catch (error) {
    console.error('Feature update error:', error);
    return NextResponse.json({ error: 'Failed to update feature' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const { searchParams } = new URL(request.url);
    const featureId = searchParams.get('feature_id');

    if (!featureId) {
      return NextResponse.json({ error: 'feature_id is required' }, { status: 400 });
    }

    const deleted = await deleteFeature(featureId);
    if (!deleted) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Feature delete error:', error);
    return NextResponse.json({ error: 'Failed to delete feature' }, { status: 500 });
  }
}
