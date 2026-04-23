import { describe, expect, it, vi } from 'vitest';
import { ClaudeCodeTarget } from '../execution/claude-code.js';
import type { OperationalStoreLike } from '../execution/seat-types.js';

describe('ClaudeCodeTarget seat strategies', () => {
  it('dedicated strategy does not require ops store', () => {
    const target = new ClaudeCodeTarget({ kind: 'claude-code' }, { seatStrategy: 'dedicated' });
    expect(target.kind).toBe('claude-code');
  });

  it('pool strategy requires ops store', () => {
    expect(() => new ClaudeCodeTarget({ kind: 'claude-code' }, { seatStrategy: 'pool' })).toThrow(
      /opsStore/,
    );
  });

  it('pool strategy calls allocateSeat / releaseSeat around dispatch', async () => {
    const alloc = vi.fn().mockResolvedValue({
      id: 'seat-1',
      botId: 'workclaw',
      seatKey: '/tmp/claude-config',
      allocatedAt: new Date().toISOString(),
    });
    const release = vi.fn().mockResolvedValue(undefined);
    const ops: OperationalStoreLike = { allocateSeat: alloc, releaseSeat: release };
    const target = new ClaudeCodeTarget(
      { kind: 'claude-code' },
      { seatStrategy: 'pool', opsStore: ops, binary: 'echo' },
    );
    await target.dispatch({
      botId: 'workclaw',
      sessionKey: 's',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(alloc).toHaveBeenCalledWith('workclaw');
    expect(release).toHaveBeenCalledWith('seat-1');
  });

  it('pool strategy throws when no seat available and does not call release', async () => {
    const alloc = vi.fn().mockResolvedValue(null);
    const release = vi.fn();
    const ops: OperationalStoreLike = { allocateSeat: alloc, releaseSeat: release };
    const target = new ClaudeCodeTarget(
      { kind: 'claude-code' },
      { seatStrategy: 'pool', opsStore: ops, binary: 'echo' },
    );
    await expect(
      target.dispatch({
        botId: 'workclaw',
        sessionKey: 's',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow(/no seat/);
    expect(release).not.toHaveBeenCalled();
  });
});
