import { NextRequest, NextResponse } from 'next/server';
import { getProject, updateFeature } from '@/lib/gfp';
import { getItem } from '@/lib/kb';
import { query } from '@/lib/db';
import { dispatchFeatureSpecRequest, dispatchFeatureSpecRegeneration } from '@/lib/gfp-bot';
import { resolveGfpSlackContext, sendFeatureSpecReviewSlack } from '@/lib/slack';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Spec action dispatches (approve/reject)
    if (body.action === 'approve-spec') {
      return handleApproveSpec(id, body);
    }
    if (body.action === 'reject-spec') {
      return handleRejectSpec(id, body);
    }

    // Default: create improvement request
    return handleCreateImprovement(id, body);
  } catch (error) {
    console.error('Feature improve error:', error);
    return NextResponse.json({ error: 'Failed to process feature improvement' }, { status: 500 });
  }
}

async function handleCreateImprovement(projectId: string, body: Record<string, unknown>) {
  const { feature_id, title, description, priority, mode = 'issue-only' } = body as {
    feature_id: string;
    title: string;
    description?: string;
    priority?: string;
    mode?: 'issue-only' | 'spec-request';
  };

  if (!feature_id || !title) {
    return NextResponse.json({ error: 'feature_id and title are required' }, { status: 400 });
  }

  // 1. 프로젝트 + 기능 정보 조회
  const project = await getProject(projectId);
  if (!project?.service_domain) {
    return NextResponse.json({ error: 'Project not found or no service_domain' }, { status: 404 });
  }

  const featureRes = await query<{ name: string; description: string; category: string; metadata: Record<string, unknown> }>(
    'SELECT name, description, category, metadata FROM semo.service_features WHERE feature_id = $1',
    [feature_id]
  );
  const feature = featureRes.rows[0];
  if (!feature) {
    return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
  }

  // 2. KB에서 repo 정보 조회
  const repoEntry = await getItem(project.service_domain, 'repo');
  const repoPath = repoEntry?.content?.trim();
  if (!repoPath) {
    return NextResponse.json({ error: `KB에 '${project.service_domain}/repo' 엔트리가 없��니다. 먼저 등록해주세요.` }, { status: 400 });
  }

  const repoMatch = repoPath.match(/([^/\s]+\/[^/\s]+)/);
  if (!repoMatch) {
    return NextResponse.json({ error: `repo 형식이 올바르지 않습니다: ${repoPath}` }, { status: 400 });
  }
  const repo = repoMatch[1];

  // 3. GitHub Issue 생성
  const isSpecRequest = mode === 'spec-request';
  const labels = ['enhancement', isSpecRequest ? 'bot:needs-spec' : 'bot:spec-ready'];
  if (priority === 'high') labels.push('priority:high');

  const issueBody = [
    `## 기능 개선 요청`,
    '',
    `**기존 기능**: ${feature.name}`,
    feature.description ? `**기능 설명**: ${feature.description}` : null,
    `**카테고리**: ${feature.category}`,
    '',
    `## 개선 내용`,
    '',
    description || '(상세 설명 없음)',
    '',
    `**우선순위**: ${priority || 'normal'}`,
    isSpecRequest ? `**모드**: 봇 스펙 요청 (PlanClaw 자동 생성)` : null,
    '',
    `---`,
    `> 이 이슈는 SEMO 서비스 대시보드에서 자동 생성되었습니다.`,
    `> 서비스: ${project.project_name} (${project.service_domain})`,
    `> Feature ID: ${feature_id}`,
  ].filter(Boolean).join('\n');

  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) {
    return NextResponse.json({ error: 'GITHUB_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  const ghResponse = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: `[기능개선] ${feature.name}: ${title}`, body: issueBody, labels }),
  });

  if (!ghResponse.ok) {
    const ghError = await ghResponse.text();
    console.error('GitHub Issue creation failed:', ghError);
    return NextResponse.json({ error: `GitHub Issue 생성 실패: ${ghResponse.status}` }, { status: 502 });
  }

  const issue = await ghResponse.json();

  // 4. feature metadata 업데이트
  const metadataUpdate: Record<string, unknown> = {
    github_issue_url: issue.html_url,
    github_issue_number: issue.number,
    improvement_requested_at: new Date().toISOString(),
  };

  if (isSpecRequest) {
    metadataUpdate.spec_status = 'generating';
    metadataUpdate.improvement_title = title;
    metadataUpdate.improvement_description = description || '';
  }

  await updateFeature(feature_id, { metadata: metadataUpdate });

  // 5. spec-request 모드면 PlanClaw 디스패치
  if (isSpecRequest) {
    dispatchFeatureSpecRequest(
      feature_id,
      feature.name,
      feature.description,
      title,
      description || '',
      project.service_domain,
    ).catch((err: unknown) => console.error('Feature spec dispatch failed:', err));
  }

  return NextResponse.json({
    issue_url: issue.html_url,
    issue_number: issue.number,
    mode,
  }, { status: 201 });
}

async function handleApproveSpec(projectId: string, body: Record<string, unknown>) {
  const { feature_id } = body as { feature_id: string };
  if (!feature_id) {
    return NextResponse.json({ error: 'feature_id is required' }, { status: 400 });
  }

  // 1. feature 업데이트: spec 승인 + status in-dev
  const feature = await updateFeature(feature_id, {
    status: 'in-dev',
    metadata: {
      spec_status: 'approved',
      spec_approved_at: new Date().toISOString(),
    },
  });
  if (!feature) {
    return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
  }

  // 2. GitHub Issue 라벨 변경: bot:needs-spec → bot:spec-ready
  const issueNumber = feature.metadata?.github_issue_number as number | undefined;
  if (issueNumber) {
    const project = await getProject(projectId);
    if (project?.service_domain) {
      const repoEntry = await getItem(project.service_domain, 'repo');
      const repoPath = repoEntry?.content?.trim();
      const repoMatch = repoPath?.match(/([^/\s]+\/[^/\s]+)/);
      if (repoMatch) {
        const repo = repoMatch[1];
        const ghToken = process.env.GITHUB_TOKEN;
        if (ghToken) {
          // Remove bot:needs-spec, add bot:spec-ready
          await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels/bot:needs-spec`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
          }).catch(() => {});
          await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ labels: ['bot:spec-ready'] }),
          }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ ok: true, feature });
}

async function handleRejectSpec(projectId: string, body: Record<string, unknown>) {
  const { feature_id, reviewer_note } = body as { feature_id: string; reviewer_note: string };
  if (!feature_id) {
    return NextResponse.json({ error: 'feature_id is required' }, { status: 400 });
  }

  // 1. feature 업데이트: spec 거절
  const feature = await updateFeature(feature_id, {
    metadata: {
      spec_status: 'generating',
      spec_rejected_at: new Date().toISOString(),
      spec_rejection_note: reviewer_note,
    },
  });
  if (!feature) {
    return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
  }

  // 2. PlanClaw에 재생성 디스패치
  const project = await getProject(projectId);
  const originalSpec = (feature.metadata?.spec as string) || '';
  if (project?.service_domain) {
    dispatchFeatureSpecRegeneration(
      feature_id,
      feature.name,
      originalSpec,
      reviewer_note || '수정 필요',
      project.service_domain,
    ).catch((err: unknown) => console.error('Feature spec regen dispatch failed:', err));
  }

  return NextResponse.json({ ok: true, feature });
}
