import { NextRequest, NextResponse } from 'next/server';
import { getProject, updateFeature } from '@/lib/gfp';
import { getItem } from '@/lib/kb';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { feature_id, title, description, priority } = body;

    if (!feature_id || !title) {
      return NextResponse.json({ error: 'feature_id and title are required' }, { status: 400 });
    }

    // 1. 프로젝트 + 기능 정보 조회
    const project = await getProject(id);
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
      return NextResponse.json({ error: `KB에 '${project.service_domain}/repo' 엔트리가 없습니다. 먼저 등록해주세요.` }, { status: 400 });
    }

    // GitHub org/repo 형식 파싱 (예: "semicolon-devteam/proj-axoracle")
    const repoMatch = repoPath.match(/([^/\s]+\/[^/\s]+)/);
    if (!repoMatch) {
      return NextResponse.json({ error: `repo 형식이 올바르지 않습니다: ${repoPath}` }, { status: 400 });
    }
    const repo = repoMatch[1];

    // 3. GitHub Issue 생성
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
      '',
      `---`,
      `> 이 이슈는 SEMO 서비스 대시보드에서 자동 생성되었습니다.`,
      `> 서비스: ${project.project_name} (${project.service_domain})`,
      `> Feature ID: ${feature_id}`,
    ].filter(Boolean).join('\n');

    const labels = ['enhancement', 'bot:spec-ready'];
    if (priority === 'high') labels.push('priority:high');

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
      body: JSON.stringify({
        title: `[기능개선] ${feature.name}: ${title}`,
        body: issueBody,
        labels,
      }),
    });

    if (!ghResponse.ok) {
      const ghError = await ghResponse.text();
      console.error('GitHub Issue creation failed:', ghError);
      return NextResponse.json({ error: `GitHub Issue 생성 실패: ${ghResponse.status}` }, { status: 502 });
    }

    const issue = await ghResponse.json();

    // 4. feature metadata에 issue URL 기록
    await updateFeature(feature_id, {
      metadata: {
        github_issue_url: issue.html_url,
        github_issue_number: issue.number,
        improvement_requested_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      issue_url: issue.html_url,
      issue_number: issue.number,
    }, { status: 201 });
  } catch (error) {
    console.error('Feature improve error:', error);
    return NextResponse.json({ error: 'Failed to create improvement issue' }, { status: 500 });
  }
}
