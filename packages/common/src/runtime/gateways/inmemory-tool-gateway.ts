/**
 * InMemoryToolGateway — ToolGateway 의 reference 구현.
 *
 * 도구 핸들러는 메모리에 register(name, handler) 로 등록. invoke(req) 호출 시:
 *   1. 권한 정책(ToolPermissionPolicy) 평가 → 거부 시 permissionRequired 반환
 *   2. 등록된 핸들러 호출 → 결과/에러를 ToolCallResult 로 변환
 *   3. ToolAuditSink.record() 로 호출 이력 영속화
 *
 * P5-3a: 기존 hooks/MCP tool 흐름은 변경하지 않음. 새 코드 경로에서만 사용.
 * P5-3b: ~/.semo/shared/hooks/* 의 ad-hoc 처리를 단계적으로 이 게이트웨이로 이관.
 */

import type { HostAdapter } from '../host-adapter.js';
import type {
  ToolAuditSink,
  ToolCallRequest,
  ToolCallResult,
  ToolGateway,
  ToolPermissionPolicy,
} from '../tool-gateway.js';

/** 모든 호출 자동 허용. P5-3a 기본값 — 기존 hooks 의 wide-open 동작 호환. */
export class AlwaysAllowPolicy implements ToolPermissionPolicy {
  async evaluate(): Promise<{ allow: boolean }> {
    return { allow: true };
  }
}

/** 호출 결과를 stdout/stderr 로 기록. 디버깅용 reference. */
export class ConsoleAuditSink implements ToolAuditSink {
  constructor(private readonly useStderr = false) {}
  async record(req: ToolCallRequest, res: ToolCallResult): Promise<void> {
    const out = this.useStderr ? process.stderr : process.stdout;
    const status = res.ok ? 'ok' : `err(${res.error})`;
    out.write(`[tool-audit] ${req.callerId} → ${req.name} ${status} (${res.durationMs}ms)\n`);
  }
}

export interface InMemoryToolGatewayOptions {
  /** 권한 정책. 기본 AlwaysAllowPolicy. */
  policy?: ToolPermissionPolicy;
  /** 감사 sink. 기본 동작 없음 (호출 기록 영속화 X). */
  audit?: ToolAuditSink;
}

export class InMemoryToolGateway implements ToolGateway {
  readonly host: HostAdapter;
  private readonly handlers = new Map<string, (req: ToolCallRequest) => Promise<unknown>>();
  private readonly policy: ToolPermissionPolicy;
  private readonly audit?: ToolAuditSink;

  constructor(host: HostAdapter, options: InMemoryToolGatewayOptions = {}) {
    this.host = host;
    this.policy = options.policy ?? new AlwaysAllowPolicy();
    this.audit = options.audit;
  }

  register(name: string, handler: (req: ToolCallRequest) => Promise<unknown>): void {
    this.handlers.set(name, handler);
  }

  async invoke(req: ToolCallRequest): Promise<ToolCallResult> {
    const start = Date.now();

    // 1. 권한 평가
    const perm = await this.policy.evaluate(req);
    if (!perm.allow) {
      const result: ToolCallResult = {
        ok: false,
        error: `도구 '${req.name}' 호출이 권한 정책에 의해 거부됨.`,
        permissionRequired: perm.permissionRequired,
        durationMs: Date.now() - start,
      };
      if (this.audit) await this.audit.record(req, result);
      return result;
    }

    // 2. 핸들러 조회
    const handler = this.handlers.get(req.name);
    if (!handler) {
      const result: ToolCallResult = {
        ok: false,
        error: `도구 '${req.name}' 가 ToolGateway 에 등록되지 않음.`,
        durationMs: Date.now() - start,
      };
      if (this.audit) await this.audit.record(req, result);
      return result;
    }

    // 3. 실행
    try {
      const output = await handler(req);
      const result: ToolCallResult = {
        ok: true,
        output,
        durationMs: Date.now() - start,
      };
      if (this.audit) await this.audit.record(req, result);
      return result;
    } catch (err) {
      const result: ToolCallResult = {
        ok: false,
        error: (err as Error).message,
        durationMs: Date.now() - start,
      };
      if (this.audit) await this.audit.record(req, result);
      return result;
    }
  }
}
