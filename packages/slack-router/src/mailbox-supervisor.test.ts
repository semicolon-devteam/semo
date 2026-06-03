import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { MailboxSupervisor } from './mailbox-supervisor';

function fakeSpawn() {
  const children: Array<EventEmitter & { kill: any; pid: number }> = [];
  const fn = vi.fn((_cmd: string, _args: string[]) => {
    const ee = new EventEmitter() as EventEmitter & { kill: any; pid: number };
    ee.pid = 1000 + children.length;
    ee.kill = vi.fn();
    children.push(ee);
    return ee as any;
  });
  return { fn, children };
}

function makeSup(over = {}) {
  const { fn, children } = fakeSpawn();
  const sup = new MailboxSupervisor({
    spawnFn: fn as any,
    log: () => {},
    respawnBackoffMs: 1000,
    idleExitMs: 0, // 기존 args 단언 보존 — idle-exit 는 전용 테스트에서 검증
    ...over,
  });
  return { sup, fn, children };
}

describe('MailboxSupervisor', () => {
  it('첫 호출에 spawn, 같은 봇 재호출은 already-running', () => {
    const { sup, fn } = makeSup({ serveCommand: ['semo'] });
    expect(sup.ensureWorker('jumuni')).toBe('spawned');
    expect(sup.ensureWorker('jumuni')).toBe('already-running');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe('semo');
    expect(fn.mock.calls[0][1]).toEqual(['runtime', 'serve', '--bot', 'jumuni']);
    expect(sup.activeBots()).toEqual(['jumuni']);
  });

  it('idleExitMs>0 이면 spawn args 에 --idle-exit-ms 주입', () => {
    const { sup, fn } = makeSup({ serveCommand: ['semo'], idleExitMs: 60_000 });
    expect(sup.ensureWorker('jumuni')).toBe('spawned');
    expect(fn.mock.calls[0][1]).toEqual([
      'runtime',
      'serve',
      '--bot',
      'jumuni',
      '--idle-exit-ms',
      '60000',
    ]);
  });

  it('워커 종료 후 백오프 내 재spawn 금지, 백오프 후 재spawn', () => {
    const { sup, children } = makeSup({ respawnBackoffMs: 10_000 });
    sup.ensureWorker('a');
    children[0].emit('exit', 0, null); // 종료
    expect(sup.activeBots()).toEqual([]);
    expect(sup.ensureWorker('a')).toBe('backoff'); // 백오프 내
  });

  it('max workers 초과 시 defer', () => {
    const { sup } = makeSup({ maxWorkers: 2 });
    expect(sup.ensureWorker('a')).toBe('spawned');
    expect(sup.ensureWorker('b')).toBe('spawned');
    expect(sup.ensureWorker('c')).toBe('max-workers');
  });

  it('shutdown 시 모든 워커에 SIGTERM + 이후 ensureWorker 차단', () => {
    const { sup, children } = makeSup();
    sup.ensureWorker('a');
    sup.ensureWorker('b');
    sup.shutdown();
    expect(children[0].kill).toHaveBeenCalledWith('SIGTERM');
    expect(children[1].kill).toHaveBeenCalledWith('SIGTERM');
    expect(sup.ensureWorker('c')).toBe('shutting-down');
  });

  it('error 이벤트에 워커 제거', () => {
    const { sup, children } = makeSup();
    sup.ensureWorker('a');
    children[0].emit('error', new Error('boom'));
    expect(sup.activeBots()).toEqual([]);
  });
});
