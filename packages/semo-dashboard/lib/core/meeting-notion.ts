/**
 * Meeting Notion Integration
 *
 * Syncs meeting notes to a Notion database via fetch (no @notionhq/client dependency).
 * Pattern follows meeting-github.ts (direct fetch calls).
 */

import { query } from '../db';
import type { Meeting } from './meeting';
import type { MeetingAnalysis } from './meeting-generate';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function getNotionCredentials(): { apiKey: string; dbId: string } | null {
  const apiKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_MEETINGS_DB_ID;
  if (!apiKey || !dbId) return null;
  return { apiKey, dbId };
}

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

/** 429 재시도를 포함한 fetch wrapper (1회) */
async function notionFetch(
  url: string,
  options: RequestInit & { headers: Record<string, string> },
): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429) {
    const retryAfter = Math.max(1, parseInt(res.headers.get('Retry-After') ?? '1', 10) || 1);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return fetch(url, options);
  }
  return res;
}

/** meeting_type + adhoc_subtype 조합으로 Notion select 값 생성 */
function buildTypeLabel(meeting: Meeting): string {
  if (meeting.meeting_type === 'regular') return '정기회의';
  const subMap: Record<string, string> = {
    client: '클라이언트',
    internal: '내부',
    external: '외부',
    workshop: '워크샵',
  };
  const sub = meeting.adhoc_subtype ? (subMap[meeting.adhoc_subtype] ?? meeting.adhoc_subtype) : '';
  return sub ? `임시: ${sub}` : '임시회의';
}

/** Notion DB 속성 오브젝트 생성 */
function buildProperties(
  meeting: Meeting,
  analysis: MeetingAnalysis,
  discussionUrl: string | null,
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Title: {
      title: [{ text: { content: meeting.title } }],
    },
    Date: {
      date: { start: meeting.meeting_date },
    },
    Type: {
      select: { name: buildTypeLabel(meeting) },
    },
    Attendees: {
      multi_select: meeting.attendees.map((name) => ({ name })),
    },
    Status: {
      select: { name: 'Synced' },
    },
    'Meeting ID': {
      rich_text: [{ text: { content: meeting.meeting_id } }],
    },
    Decisions: {
      number: analysis.decisions.length,
    },
    Actions: {
      number: analysis.action_items.length,
    },
  };

  if (meeting.target_domain) {
    props['Domain'] = { select: { name: meeting.target_domain } };
  }

  if (discussionUrl) {
    props['Discussion URL'] = { url: discussionUrl };
  }

  return props;
}

/** 페이지 body 블록 생성 */
function buildChildren(analysis: MeetingAnalysis): unknown[] {
  const blocks: unknown[] = [];

  // 회의 요약
  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: '회의 요약' } }] },
  });

  const summaryLines = [
    analysis.agenda_items,
    analysis.next_meeting ? `다음 미팅: ${analysis.next_meeting}` : '',
    analysis.additional_notes,
  ]
    .filter(Boolean)
    .join('\n\n');

  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ text: { content: summaryLines || '요약 없음' } }],
    },
  });

  // 의사결정
  if (analysis.decisions.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ text: { content: '의사결정' } }] },
    });
    for (const d of analysis.decisions) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: d.title }, annotations: { bold: true } },
            { text: { content: `: ${d.content} (담당: ${d.assignee})` } },
          ],
        },
      });
    }
  }

  // 액션 아이템
  if (analysis.action_items.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ text: { content: '액션 아이템' } }] },
    });
    for (const a of analysis.action_items) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [
            {
              text: {
                content: `[${a.assignee}] ${a.item} (기한: ${a.deadline})`,
              },
            },
          ],
          checked: false,
        },
      });
    }
  }

  return blocks;
}

/**
 * 회의록을 Notion DB에 동기화합니다.
 * NOTION_API_KEY 또는 NOTION_MEETINGS_DB_ID 없으면 null 반환 (graceful skip).
 */
export async function syncMeetingToNotion(
  meeting: Meeting,
  analysis: MeetingAnalysis,
  discussionUrl: string | null,
): Promise<{ pageId: string; url: string } | null> {
  const creds = getNotionCredentials();
  if (!creds) return null;

  const { apiKey, dbId } = creds;
  const properties = buildProperties(meeting, analysis, discussionUrl);
  const children = buildChildren(analysis);

  // 이미 notion_page_id가 있으면 PATCH(업데이트)
  if (meeting.notion_page_id) {
    const patchRes = await notionFetch(`${NOTION_API_BASE}/pages/${meeting.notion_page_id}`, {
      method: 'PATCH',
      headers: notionHeaders(apiKey),
      body: JSON.stringify({ properties }),
    });

    if (!patchRes.ok) {
      const text = await patchRes.text();
      throw new Error(`Notion PATCH failed (${patchRes.status}): ${text}`);
    }

    const data = (await patchRes.json()) as { id: string; url: string };
    return { pageId: data.id, url: data.url };
  }

  // 신규 생성 (POST)
  const createRes = await notionFetch(`${NOTION_API_BASE}/pages`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties,
      children,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Notion POST failed (${createRes.status}): ${text}`);
  }

  const data = (await createRes.json()) as { id: string; url: string };
  return { pageId: data.id, url: data.url };
}

/**
 * Notion 동기화 결과를 DB에 저장합니다.
 */
export async function updateNotionSync(
  meetingId: string,
  result: { pageId: string; url: string } | null,
  error?: string,
): Promise<void> {
  if (result) {
    await query(
      `UPDATE semo.meetings
       SET notion_page_id = $2, notion_url = $3,
           notion_sync_status = 'synced', notion_sync_error = NULL,
           updated_at = NOW()
       WHERE meeting_id = $1`,
      [meetingId, result.pageId, result.url],
    );
  } else {
    await query(
      `UPDATE semo.meetings
       SET notion_sync_status = 'failed', notion_sync_error = $2,
           updated_at = NOW()
       WHERE meeting_id = $1`,
      [meetingId, error ?? 'Unknown error'],
    );
  }
}
