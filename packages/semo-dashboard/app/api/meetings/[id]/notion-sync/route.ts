import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMeeting } from '@/lib/meeting';
import { syncMeetingToNotion, updateNotionSync } from '@/lib/core/meeting-notion';
import { previewMeetingNotes } from '@/lib/meeting-generate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/meetings/[id]/notion-sync — 수동 Notion 동기화/재시도 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Auth: x-semo-agent-token 헤더 또는 Supabase 세션
  const agentToken = request.headers.get('x-semo-agent-token');
  const expectedToken = process.env.SEMO_AGENT_TOKEN;

  if (!agentToken || agentToken !== expectedToken) {
    // Supabase 세션으로 폴백
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const cookieHeader = request.headers.get('cookie') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { cookie: cookieHeader } },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // analysis 데이터 확보 (transcript가 있으면 preview, 없으면 빈 분석)
    let analysis;
    if (meeting.mapped_transcript) {
      try {
        const preview = await previewMeetingNotes(meeting);
        analysis = preview.analysis;
      } catch {
        // transcript 분석 실패 시 빈 분석으로 fallback
        analysis = {
          meeting_time: meeting.meeting_date,
          meeting_type_label: meeting.meeting_type === 'regular' ? '정기 회고&회의' : '임시회의',
          agenda_items: '',
          decisions: [] as {
            title: string;
            content: string;
            background: string;
            assignee: string;
            related_project?: string;
          }[],
          kpi_changes: [] as {
            project: string;
            kpi: string;
            change: string;
            before: string;
            after: string;
            note: string;
          }[],
          action_items: [] as { assignee: string; item: string; deadline: string }[],
          next_meeting: '',
          additional_notes: '',
        };
      }
    } else {
      analysis = {
        meeting_time: meeting.meeting_date,
        meeting_type_label: meeting.meeting_type === 'regular' ? '정기 회고&회의' : '임시회의',
        agenda_items: '',
        decisions: [] as {
          title: string;
          content: string;
          background: string;
          assignee: string;
          related_project?: string;
        }[],
        kpi_changes: [] as {
          project: string;
          kpi: string;
          change: string;
          before: string;
          after: string;
          note: string;
        }[],
        action_items: [] as { assignee: string; item: string; deadline: string }[],
        next_meeting: '',
        additional_notes: '',
      };
    }

    const discussionUrl = meeting.discussion_url ?? null;
    const notionResult = await syncMeetingToNotion(meeting, analysis, discussionUrl);

    if (notionResult === null) {
      // Notion 설정 없음 — graceful skip
      return NextResponse.json({
        success: false,
        error: 'NOTION_API_KEY or NOTION_MEETINGS_DB_ID is not configured',
      });
    }

    await updateNotionSync(id, notionResult);

    return NextResponse.json({
      success: true,
      notion_url: notionResult.url,
    });
  } catch (error) {
    console.error('Notion sync failed:', error);
    const message = error instanceof Error ? error.message : 'Notion sync failed';
    await updateNotionSync(id, null, message).catch(() => {});
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
