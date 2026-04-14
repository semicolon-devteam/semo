import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── DB mock ──────────────────────────────────────────────────────────────────
vi.mock('../../db', () => ({
  query: vi.fn(),
}));

import { query } from '../../db';
import { syncMeetingToNotion, updateNotionSync } from '../meeting-notion';
import type { Meeting } from '../meeting';
import type { MeetingAnalysis } from '../meeting-generate';

const mockQuery = vi.mocked(query);

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    meeting_id: 'meet-001',
    title: '주간 회의',
    meeting_type: 'regular',
    adhoc_subtype: null,
    meeting_date: '2026-04-14',
    attendees: ['reus', 'garden'],

    target_domain: 'axoracle',
    audio_filename: null,
    audio_duration_ms: null,
    vito_transcribe_id: null,
    transcription_status: 'completed',
    transcription_error: null,
    raw_transcript: null,
    speaker_map: {},
    mapped_transcript: '회의 내용',
    discussion_url: null,
    discussion_number: null,
    generation_status: 'completed',
    generation_error: null,
    generation_result: null,
    notion_page_id: null,
    notion_url: null,
    notion_sync_status: null,
    notion_sync_error: null,
    created_at: '2026-04-14T00:00:00Z',
    updated_at: '2026-04-14T00:00:00Z',
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<MeetingAnalysis> = {}): MeetingAnalysis {
  return {
    meeting_time: '2026-04-14 10:00-11:00',
    meeting_type_label: '정기 회고&회의',
    agenda_items: '안건 1\n안건 2',
    decisions: [
      {
        title: '배포 일정',
        content: '다음 주 배포',
        background: '일정 논의',
        assignee: 'reus',
        related_project: 'axoracle',
      },
    ],
    kpi_changes: [],
    action_items: [{ assignee: 'garden', item: 'PR 리뷰', deadline: '04/18' }],
    next_meeting: '2026-04-21 (월) 10:00',
    additional_notes: '',
    ...overrides,
  };
}

// ── Global fetch mock ─────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  mockQuery.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();

  delete process.env.NOTION_API_KEY;
  delete process.env.NOTION_MEETINGS_DB_ID;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('syncMeetingToNotion', () => {
  // 1. 정상 동작: 페이지 생성 성공 → pageId, url 반환
  it('페이지 생성 성공 시 pageId와 url을 반환한다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'page-xyz', url: 'https://notion.so/page-xyz' }),
    });

    const result = await syncMeetingToNotion(
      makeMeeting(),
      makeAnalysis(),
      'https://github.com/discussion/1',
    );

    expect(result).toEqual({ pageId: 'page-xyz', url: 'https://notion.so/page-xyz' });

    // POST to /pages
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/pages');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.parent).toEqual({ database_id: 'db-abc123' });
    expect(body.properties).toBeDefined();
    expect(body.children).toBeDefined();
  });

  // 2. 환경변수 미설정 시 null 반환 (graceful skip)
  it('NOTION_API_KEY 미설정 시 null을 반환한다', async () => {
    delete process.env.NOTION_API_KEY;
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    const result = await syncMeetingToNotion(makeMeeting(), makeAnalysis(), null);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('NOTION_MEETINGS_DB_ID 미설정 시 null을 반환한다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    delete process.env.NOTION_MEETINGS_DB_ID;

    const result = await syncMeetingToNotion(makeMeeting(), makeAnalysis(), null);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // 3. notion_page_id 있을 때 PATCH 업데이트 모드
  it('notion_page_id가 있으면 PATCH로 업데이트한다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'existing-page', url: 'https://notion.so/existing-page' }),
    });

    const meeting = makeMeeting({ notion_page_id: 'existing-page' });
    const result = await syncMeetingToNotion(meeting, makeAnalysis(), null);

    expect(result).toEqual({ pageId: 'existing-page', url: 'https://notion.so/existing-page' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/pages/existing-page');
    expect(options.method).toBe('PATCH');

    // PATCH body에는 children이 없어야 함 (properties만)
    const body = JSON.parse(options.body);
    expect(body.properties).toBeDefined();
    expect(body.children).toBeUndefined();
  });

  // 4. 429 응답 시 1회 재시도 (Retry-After 헤더 준수)
  it('429 응답 시 Retry-After만큼 대기 후 1회 재시도한다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    vi.useFakeTimers();

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (h: string) => (h === 'Retry-After' ? '2' : null) },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'page-retry', url: 'https://notion.so/page-retry' }),
      });

    const promise = syncMeetingToNotion(makeMeeting(), makeAnalysis(), null);

    // Retry-After: 2 → 2000ms 타이머 진행
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toEqual({ pageId: 'page-retry', url: 'https://notion.so/page-retry' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  // 5. API 에러 시 throw (500 응답)
  it('Notion API 500 응답 시 에러를 throw한다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(syncMeetingToNotion(makeMeeting(), makeAnalysis(), null)).rejects.toThrow(
      'Notion POST failed (500): Internal Server Error',
    );
  });

  it('PATCH 모드에서 500 응답 시 에러를 throw한다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server Error',
    });

    await expect(
      syncMeetingToNotion(makeMeeting({ notion_page_id: 'existing-page' }), makeAnalysis(), null),
    ).rejects.toThrow('Notion PATCH failed (500): Server Error');
  });

  // 8. Notion 블록 구조: decisions, action items가 올바른 블록 타입으로 변환
  it('decisions이 bulleted_list_item 블록으로 변환된다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', url: 'https://notion.so/p1' }),
    });

    await syncMeetingToNotion(makeMeeting(), makeAnalysis(), null);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const blocks: { type: string; bulleted_list_item?: unknown }[] = body.children;

    const bulletBlocks = blocks.filter((b) => b.type === 'bulleted_list_item');
    expect(bulletBlocks.length).toBeGreaterThan(0);
  });

  it('action_items이 to_do 블록으로 변환된다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', url: 'https://notion.so/p1' }),
    });

    await syncMeetingToNotion(makeMeeting(), makeAnalysis(), null);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const blocks: { type: string; to_do?: { checked: boolean } }[] = body.children;

    const todoBlocks = blocks.filter((b) => b.type === 'to_do');
    expect(todoBlocks.length).toBeGreaterThan(0);
    // checked: false (미완료 상태)
    expect(todoBlocks[0].to_do?.checked).toBe(false);
  });

  // 8-b. bold annotations 구조 검증 (Notion API 스펙)
  it('decision 제목의 bold annotations가 rich_text 최상위 레벨에 있다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', url: 'https://notion.so/p1' }),
    });

    await syncMeetingToNotion(makeMeeting(), makeAnalysis(), null);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const blocks: { type: string; bulleted_list_item?: { rich_text: unknown[] } }[] = body.children;
    const bulletBlock = blocks.find((b) => b.type === 'bulleted_list_item');

    expect(bulletBlock).toBeDefined();
    const richText = bulletBlock!.bulleted_list_item!.rich_text as Array<{
      type?: string;
      text?: { content: string };
      annotations?: { bold: boolean };
    }>;

    // 첫 번째 rich_text 요소: title (bold)
    const titleItem = richText[0];
    expect(titleItem.annotations?.bold).toBe(true);
    // annotations는 text 오브젝트 내부가 아닌 최상위에 있어야 함
    expect((titleItem.text as Record<string, unknown>)?.annotations).toBeUndefined();
  });

  // 9. Attendees multi_select: 올바른 Notion 속성 형식
  it('attendees가 multi_select 형식으로 변환된다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', url: 'https://notion.so/p1' }),
    });

    const meeting = makeMeeting({ attendees: ['reus', 'garden', 'semi'] });
    await syncMeetingToNotion(meeting, makeAnalysis(), null);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const attendeesProp = body.properties.Attendees;

    expect(attendeesProp).toEqual({
      multi_select: [{ name: 'reus' }, { name: 'garden' }, { name: 'semi' }],
    });
  });

  // 10. 빈 analysis 처리: decisions/actions가 빈 배열일 때 에러 없이 동작
  it('decisions과 action_items이 빈 배열이어도 에러 없이 동작한다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p-empty', url: 'https://notion.so/p-empty' }),
    });

    const emptyAnalysis = makeAnalysis({ decisions: [], action_items: [] });

    await expect(syncMeetingToNotion(makeMeeting(), emptyAnalysis, null)).resolves.toEqual({
      pageId: 'p-empty',
      url: 'https://notion.so/p-empty',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const blocks: { type: string }[] = body.children;

    // decisions/actions 헤딩 블록이 없어야 함
    const hasDecisionHeading = blocks.some((b) => b.type === 'heading_2');
    // summary heading은 있고, decision/action heading은 없어야 함
    const headings = blocks.filter((b) => b.type === 'heading_2');
    expect(headings.length).toBe(1); // 회의 요약 헤딩만
    expect(blocks.filter((b) => b.type === 'bulleted_list_item')).toHaveLength(0);
    expect(blocks.filter((b) => b.type === 'to_do')).toHaveLength(0);
  });

  // Notion 헤더 검증 (Authorization, Notion-Version)
  it('올바른 Notion 헤더를 전송한다', async () => {
    process.env.NOTION_API_KEY = 'my-notion-token';
    process.env.NOTION_MEETINGS_DB_ID = 'db-xyz';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', url: 'https://notion.so/p1' }),
    });

    await syncMeetingToNotion(makeMeeting(), makeAnalysis(), null);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer my-notion-token');
    expect(options.headers['Notion-Version']).toBe('2022-06-28');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  // discussionUrl이 null이면 Discussion URL 속성 없음
  it('discussionUrl이 null이면 Discussion URL 속성을 포함하지 않는다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', url: 'https://notion.so/p1' }),
    });

    await syncMeetingToNotion(makeMeeting(), makeAnalysis(), null);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.properties['Discussion URL']).toBeUndefined();
  });

  it('discussionUrl이 있으면 Discussion URL 속성을 포함한다', async () => {
    process.env.NOTION_API_KEY = 'secret-key';
    process.env.NOTION_MEETINGS_DB_ID = 'db-abc123';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', url: 'https://notion.so/p1' }),
    });

    await syncMeetingToNotion(makeMeeting(), makeAnalysis(), 'https://github.com/discussion/42');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.properties['Discussion URL']).toEqual({ url: 'https://github.com/discussion/42' });
  });
});

describe('updateNotionSync', () => {
  // 6. 성공 시 DB에 synced 상태 저장
  it('성공 결과를 받으면 synced 상태로 DB를 업데이트한다', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    } as never);

    await updateNotionSync('meet-001', { pageId: 'page-xyz', url: 'https://notion.so/page-xyz' });

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];

    expect((sql as string).toLowerCase()).toContain('update');
    expect(sql as string).toContain("notion_sync_status = 'synced'");
    expect(params).toContain('meet-001');
    expect(params).toContain('page-xyz');
    expect(params).toContain('https://notion.so/page-xyz');
  });

  // 7. 실패 시 DB에 failed 상태 + 에러 메시지 저장
  it('null 결과를 받으면 failed 상태와 에러 메시지로 DB를 업데이트한다', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    } as never);

    await updateNotionSync('meet-001', null, 'Notion API timeout');

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];

    expect(sql as string).toContain("notion_sync_status = 'failed'");
    expect(params).toContain('meet-001');
    expect(params).toContain('Notion API timeout');
  });

  it('에러 메시지가 없으면 Unknown error를 저장한다', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    } as never);

    await updateNotionSync('meet-001', null);

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain('Unknown error');
  });

  it('DB 쿼리 실패 시 에러를 전파한다', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));

    await expect(
      updateNotionSync('meet-001', { pageId: 'p1', url: 'https://notion.so/p1' }),
    ).rejects.toThrow('DB connection failed');
  });
});
