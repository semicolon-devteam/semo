/**
 * Deploy Verification API
 *
 * GET  — 최신 검증 결과 조회
 * POST — Dashboard 서버사이드 검증 실행 (GitHub CI + health endpoint)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProject, getLatestVerification, createDeployVerification } from '@/lib/gfp';
import type { DeployCheckResult } from '@/types';

export const dynamic = 'force-dynamic';

const SOURCE_REPO_TOKEN = process.env.SOURCE_REPO_TOKEN;
const GITHUB_ORG = 'semicolon-devteam';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const infraPhase = project.infra_phase ?? 0;
    const verification = await getLatestVerification(id, infraPhase);
    return NextResponse.json({ verification, infra_phase: infraPhase });
  } catch (error) {
    console.error('Deploy verify GET error:', error);
    return NextResponse.json({ error: 'Failed to get verification' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!project.service_domain) {
      return NextResponse.json({ error: 'service_domain is not set' }, { status: 400 });
    }

    const domain = project.service_domain;
    const infraPhase = project.infra_phase ?? 0;

    const [ciResult, healthResult] = await Promise.all([
      checkGitHubCI(domain),
      checkHealthEndpoint(domain),
    ]);

    const verification = await createDeployVerification({
      service_id: id,
      infra_phase: infraPhase,
      checks: {
        ci_build: ciResult,
        health_endpoint: healthResult,
        pod_status: {
          status: 'skip',
          detail:
            'kubectl 접근 불가 — InfraClaw callback 필요. CreateContainerConfigError는 K8s Secret 미존재가 주원인.',
        },
        tls_cert: { status: 'skip', detail: 'kubectl 접근 불가 — InfraClaw callback 필요.' },
      },
      verified_by: 'dashboard-api',
    });

    return NextResponse.json({ ok: true, verification });
  } catch (error) {
    console.error('Deploy verify POST error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

// ── GitHub CI Check ──

async function checkGitHubCI(domain: string): Promise<DeployCheckResult> {
  if (!SOURCE_REPO_TOKEN) {
    return { status: 'skip', detail: 'SOURCE_REPO_TOKEN not configured' };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${domain}/actions/runs?per_page=1&branch=dev`,
      {
        headers: {
          Authorization: `Bearer ${SOURCE_REPO_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!res.ok) {
      return { status: 'fail', detail: `GitHub API error: ${res.status}` };
    }

    const data = await res.json();
    const run = data.workflow_runs?.[0];
    if (!run) {
      return { status: 'fail', detail: 'No workflow runs found' };
    }

    if (run.conclusion === 'success') {
      return { status: 'pass', detail: `Run #${run.run_number} success`, run_id: run.id };
    }
    return {
      status: 'fail',
      detail: `Run #${run.run_number} ${run.conclusion ?? run.status}`,
      run_id: run.id,
    };
  } catch (err) {
    return { status: 'fail', detail: `GitHub API fetch failed: ${(err as Error).message}` };
  }
}

// ── Health Endpoint Check ──

async function checkHealthEndpoint(domain: string): Promise<DeployCheckResult> {
  const url = `https://${domain}.semi-colon.space/api/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      return { status: 'pass', detail: `${res.status} OK`, url };
    }
    return { status: 'fail', detail: `${res.status} ${res.statusText}`, url };
  } catch (err) {
    return { status: 'fail', detail: `Unreachable: ${(err as Error).message}`, url };
  }
}
