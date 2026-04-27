/**
 * InMemoryHookGateway — HookGateway reference 구현 (P5-7).
 *
 * Guard 를 메모리에 register, run() 호출 시 평가 → 결과 반환 + 옵션 audit sink 기록.
 * cli (`semo guard run <name>`) 가 이 게이트웨이를 사용하도록 점진 이관 가능.
 */

import type {
  HookGateway,
  HookGuard,
  HookPayload,
  HookResult,
  HookTrigger,
  PolicyAuditSink,
} from '../hook-gateway.js';

export interface InMemoryHookGatewayOptions {
  audit?: PolicyAuditSink;
}

export class InMemoryHookGateway implements HookGateway {
  private readonly guards = new Map<string, HookGuard>();
  private readonly audit?: PolicyAuditSink;

  constructor(options: InMemoryHookGatewayOptions = {}) {
    this.audit = options.audit;
  }

  register(guard: HookGuard): void {
    this.guards.set(guard.name, guard);
  }

  list(): HookGuard[] {
    return Array.from(this.guards.values());
  }

  async run(name: string, payload: HookPayload | null): Promise<HookResult> {
    const guard = this.guards.get(name);
    if (!guard) {
      return { exitCode: 2, level: 'pass', message: `unknown guard: ${name}` };
    }
    const result = await guard.evaluate(payload);
    if (this.audit) {
      // trigger 정보는 cli 에서 알 수 없으므로 첫 등록 trigger 사용
      const trigger: HookTrigger = guard.triggers[0] ?? 'Stop';
      try {
        await this.audit.record(guard.name, trigger, result);
      } catch {
        // audit 실패는 guard 결과를 막지 않음
      }
    }
    return result;
  }
}

/** stdout 한 줄 기록 reference audit sink. */
export class ConsolePolicyAuditSink implements PolicyAuditSink {
  constructor(private readonly useStderr = true) {}
  async record(guard: string, trigger: HookTrigger, result: HookResult): Promise<void> {
    const out = this.useStderr ? process.stderr : process.stdout;
    out.write(`[guard-audit] ${trigger} → ${guard} ${result.level} exit=${result.exitCode}\n`);
  }
}
