import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  query: vi.fn(),
}));

import { query } from '../../db';
import { createMeeting, getMeeting, listMeetings, updateMeeting } from '../meeting';

const mockQuery = vi.mocked(query);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockRows(rows: Record<string, unknown>[], rowCount?: number): any {
  return { rows, rowCount: rowCount ?? rows.length };
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('createMeeting — target_domain support', () => {
  it('should include target_domain in INSERT', async () => {
    mockQuery.mockResolvedValueOnce(
      mockRows([
        {
          meeting_id: 'm-1',
          title: '주간 회의',
          meeting_type: 'regular',
          target_domain: 'axoracle',
          attendees: ['reus', 'garden'],
        },
      ]),
    );

    const result = await createMeeting({
      title: '주간 회의',
      meeting_type: 'regular',
      attendees: ['reus', 'garden'],
      target_domain: 'axoracle',
    });

    expect(result.target_domain).toBe('axoracle');
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('target_domain');
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain('axoracle');
  });

  it('should not include service_id in INSERT', async () => {
    mockQuery.mockResolvedValueOnce(mockRows([{ meeting_id: 'm-1a' }]));

    await createMeeting({
      title: '테스트',
      meeting_type: 'adhoc',
      attendees: ['reus'],
      target_domain: 'axoracle',
    });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('service_id');
  });

  it('should pass null target_domain when not provided', async () => {
    mockQuery.mockResolvedValueOnce(mockRows([{ meeting_id: 'm-2' }]));

    await createMeeting({
      title: '임시 회의',
      meeting_type: 'adhoc',
      attendees: ['reus'],
    });

    const params = mockQuery.mock.calls[0][1] as unknown[];
    const targetDomainParam = params[params.length - 1];
    expect(targetDomainParam).toBeNull();
  });
});

describe('listMeetings — targetDomain filter', () => {
  it('should filter by target_domain when provided', async () => {
    mockQuery.mockResolvedValueOnce(mockRows([{ meeting_id: 'm-1', target_domain: 'axoracle' }]));

    await listMeetings(50, 0, 'axoracle');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('target_domain = $1');
    expect(mockQuery.mock.calls[0][1]).toEqual(['axoracle', 50, 0]);
  });

  it('should not filter when targetDomain is not provided', async () => {
    mockQuery.mockResolvedValueOnce(mockRows([], 0));

    await listMeetings(50, 0);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('target_domain = $1');
  });
});

describe('updateMeeting — target_domain update', () => {
  it('should include target_domain in SET clause', async () => {
    mockQuery.mockResolvedValueOnce(mockRows([{ meeting_id: 'm-1', target_domain: 'bebecare' }]));

    await updateMeeting('m-1', { target_domain: 'bebecare' });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('target_domain');
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain('bebecare');
  });

  it('should allow setting target_domain to null', async () => {
    mockQuery.mockResolvedValueOnce(mockRows([{ meeting_id: 'm-1', target_domain: null }]));

    await updateMeeting('m-1', { target_domain: null });

    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain(null);
  });

  it('should skip DB query when no fields provided', async () => {
    mockQuery.mockResolvedValueOnce(mockRows([{ meeting_id: 'm-1' }]));

    await updateMeeting('m-1', {});

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('SELECT');
    expect(sql).not.toContain('UPDATE');
  });
});

describe('getMeeting — target_domain in result', () => {
  it('should return target_domain in meeting object', async () => {
    mockQuery.mockResolvedValueOnce(
      mockRows([
        {
          meeting_id: 'm-1',
          title: '테스트',
          target_domain: 'axoracle',
        },
      ]),
    );

    const meeting = await getMeeting('m-1');
    expect(meeting).not.toBeNull();
    expect(meeting!.target_domain).toBe('axoracle');
  });
});
