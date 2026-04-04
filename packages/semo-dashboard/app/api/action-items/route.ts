import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getItem, upsertItem, deleteItemByKey } from '@/lib/kb';
import { parseActionItems, resolveAssignees, toggleItemInContent, generateNewContent, removeItemFromContent, updateItemInContent, type ActionItem, type AliasMap, type TeamMemberInfo } from '@/lib/action-items';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await query(
      `SELECT kb.kb_id, kb.domain, kb.sub_key, kb.content,
              o.entity_type, o.description,
              s.project_name
       FROM semo.knowledge_base kb
       JOIN semo.ontology o ON kb.domain = o.domain
       LEFT JOIN semo.services s ON s.service_domain = o.domain
       WHERE kb.key = 'action-item'
       ORDER BY kb.sub_key DESC`,
    );

    // 모든 team 도메인의 nickname, real-name, role 조회 → alias 맵 구축
    const allTeamRes = await query(
      `SELECT o.domain, kb.key, kb.content
       FROM semo.ontology o
       LEFT JOIN semo.knowledge_base kb ON kb.domain = o.domain AND kb.key IN ('nickname', 'real-name', 'role')
       WHERE o.entity_type = 'team'`,
    );
    const teamInfoMap = new Map<string, TeamMemberInfo>();
    for (const r of allTeamRes.rows) {
      const info = teamInfoMap.get(r.domain) || { domain: r.domain, nickname: '', realName: '', role: '' };
      if (r.key === 'nickname') info.nickname = r.content?.trim() || '';
      if (r.key === 'real-name') info.realName = r.content?.trim() || '';
      if (r.key === 'role') info.role = r.content?.trim() || '';
      teamInfoMap.set(r.domain, info);
    }
    // alias 맵: lowercase alias → TeamMemberInfo
    const aliasMap: AliasMap = new Map();
    for (const info of teamInfoMap.values()) {
      aliasMap.set(info.domain.toLowerCase(), info);
      if (info.nickname) aliasMap.set(info.nickname.toLowerCase(), info);
      if (info.realName) aliasMap.set(info.realName.toLowerCase(), info);
    }

    const items: ActionItem[] = [];
    for (const row of res.rows) {
      const domainType = row.entity_type === 'team' ? 'team' as const : 'service' as const;
      let label: string;
      if (domainType === 'team') {
        const info = teamInfoMap.get(row.domain);
        label = info?.nickname || row.domain.charAt(0).toUpperCase() + row.domain.slice(1);
      } else {
        label = row.project_name || row.domain;
      }
      const parsed = parseActionItems(
        row.content,
        row.domain,
        row.sub_key,
        domainType,
        label,
      );
      items.push(...parsed);
    }

    // 담당자 정규화
    resolveAssignees(items, aliasMap);

    // team 멤버 목록도 클라이언트에 전달 (필터/생성 UI용)
    const teamMembers = Array.from(teamInfoMap.values()).map(info => ({
      domain: info.domain,
      nickname: info.nickname || info.domain,
      role: info.role,
    }));

    const open = items.filter((i) => i.status === 'open').length;
    return NextResponse.json({
      items,
      teamMembers,
      stats: { total: items.length, open, completed: items.length - open },
    });
  } catch (error) {
    console.error('Action items GET error:', error);
    return NextResponse.json({ items: [], stats: { total: 0, open: 0, completed: 0 } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { domain, subKey, itemIndex, completed } = await request.json();
    if (!domain || subKey == null || itemIndex == null || completed == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const rawKey = `action-item/${subKey}`;
    const existing = await getItem(domain, rawKey);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updatedContent = toggleItemInContent(existing.content, itemIndex, completed);
    await upsertItem(domain, rawKey, updatedContent, 'dashboard');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Action items PATCH error:', error);
    return NextResponse.json({ error: 'Toggle failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { domain, description, assignee, deadline, service } = await request.json();
    if (!domain || !description) {
      return NextResponse.json({ error: 'domain and description are required' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const slug = description
      .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
      .toLowerCase();
    const rawKey = `action-item/${today}/${slug}`;

    const content = generateNewContent({ description, assignee, deadline, service });
    await upsertItem(domain, rawKey, content, 'dashboard');

    return NextResponse.json({ ok: true, key: rawKey });
  } catch (error) {
    console.error('Action items POST error:', error);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { domain, subKey, itemIndex, description, assignee, deadline } = await request.json();
    if (!domain || subKey == null || itemIndex == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const rawKey = `action-item/${subKey}`;
    const existing = await getItem(domain, rawKey);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = updateItemInContent(existing.content, itemIndex, { description, assignee, deadline });
    await upsertItem(domain, rawKey, updated, 'dashboard');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Action items PUT error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { domain, subKey, itemIndex } = await request.json();
    if (!domain || subKey == null || itemIndex == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const rawKey = `action-item/${subKey}`;
    const existing = await getItem(domain, rawKey);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = removeItemFromContent(existing.content, itemIndex);
    if (!updated.trim()) {
      await deleteItemByKey(domain, rawKey);
    } else {
      await upsertItem(domain, rawKey, updated, 'dashboard');
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Action items DELETE error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
