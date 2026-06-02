import { describe, it, expect } from 'vitest';
import { listMemberChannels, type ConversationsClient } from '../slack/list-member-channels';

function fakeClient(pages: Array<{ channels: any[]; next?: string }>): ConversationsClient {
  let i = 0;
  return {
    users: {
      async conversations() {
        const p = pages[i++];
        return {
          channels: p.channels,
          response_metadata: p.next ? { next_cursor: p.next } : { next_cursor: '' },
        };
      },
    },
  };
}

describe('listMemberChannels', () => {
  it('여러 페이지를 next_cursor 따라 모두 수집', async () => {
    const web = fakeClient([
      { channels: [{ id: 'C1', name: 'a', is_private: false }], next: 'cur1' },
      { channels: [{ id: 'C2', name: 'b', is_private: true }], next: '' },
    ]);
    const out = await listMemberChannels('colony', { web });
    expect(out.map((c) => c.id)).toEqual(['C1', 'C2']);
    expect(out[1].is_private).toBe(true);
  });

  it('빈 next_cursor 에서 종료', async () => {
    const web = fakeClient([{ channels: [{ id: 'C9', name: 'z' }], next: '' }]);
    const out = await listMemberChannels('colony', { web });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ id: 'C9', name: 'z', is_private: false });
  });

  it('id 없는 채널은 스킵', async () => {
    const web = fakeClient([{ channels: [{ name: 'noid' }, { id: 'C3', name: 'ok' }], next: '' }]);
    const out = await listMemberChannels('colony', { web });
    expect(out.map((c) => c.id)).toEqual(['C3']);
  });
});
