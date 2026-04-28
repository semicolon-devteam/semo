import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CodexCliAdapter } from '../runtime/adapters/codex-cli-adapter.js';

/**
 * P6-3 단위 테스트.
 *
 * 가짜 codex 바이너리(stdin 무시, 미리 정의된 JSONL 시퀀스를 stdout 으로 흘림) 으로
 * dispatch 의 인자/JSONL 파싱/매핑 검증.
 */

const FAKE_DIR = mkdtempSync(join(tmpdir(), 'semo-codex-adapter-'));

function writeFake(name: string, body: string): string {
  const p = join(FAKE_DIR, name);
  writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`, 'utf8');
  chmodSync(p, 0o755);
  return p;
}

const FAKE_OK = writeFake(
  'fake-codex-ok.sh',
  `cat <<'JSONL'
{"type":"thread.started","thread_id":"019dd44d-b658-7c20-be0b-01cfd9930772"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"PONG_FAKE_CODEX"}}
{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":80,"output_tokens":5}}
JSONL`,
);

const FAKE_FAIL = writeFake(
  'fake-codex-fail.sh',
  `cat <<'JSONL'
{"type":"thread.started","thread_id":"thr-fail-1"}
{"type":"turn.started"}
{"type":"turn.failed","error":{"message":"rate limited"}}
JSONL`,
);

const FAKE_HANG = writeFake('fake-codex-hang.sh', `exec sleep 30`);

const FAKE_ECHO_ARGS = writeFake(
  'fake-codex-echo-args.sh',
  `# 인자를 stderr 로 라인별 출력 — adapter hostMeta.stderr_tail 에 보존.
for a in "$@"; do printf '%s\\n' "$a"; done >&2
cat <<'JSONL'
{"type":"thread.started","thread_id":"thr-echo-1"}
{"type":"item.completed","item":{"type":"agent_message","text":"args-ok"}}
{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1}}
JSONL`,
);

afterAll(() => {
  rmSync(FAKE_DIR, { recursive: true, force: true });
});

describe('CodexCliAdapter.dispatch (P6-3)', () => {
  it('파싱: 마지막 agent_message + thread_id 매핑', async () => {
    const adapter = new CodexCliAdapter({ binaryPath: FAKE_OK });
    const r = await adapter.dispatch({
      botId: 'reviewclaw',
      session: { hostSessionId: 'incoming' },
      prompt: 'hello',
    });
    expect(r.text).toBe('PONG_FAKE_CODEX');
    expect(r.session.hostSessionId).toBe('019dd44d-b658-7c20-be0b-01cfd9930772');
    expect(r.endReason).toBe('completed');
    expect(r.hostMeta?.thread_id).toBe('019dd44d-b658-7c20-be0b-01cfd9930772');
    expect((r.hostMeta?.usage as { input_tokens?: number })?.input_tokens).toBe(100);
  });

  it('turn.failed → endReason=error', async () => {
    const adapter = new CodexCliAdapter({ binaryPath: FAKE_FAIL });
    const r = await adapter.dispatch({
      botId: 'reviewclaw',
      session: { hostSessionId: 's' },
      prompt: 'hello',
    });
    expect(r.endReason).toBe('error');
  });

  it('timeout → endReason=timeout', async () => {
    const adapter = new CodexCliAdapter({
      binaryPath: FAKE_HANG,
      defaultTimeoutMs: 200,
    });
    const r = await adapter.dispatch({
      botId: 'reviewclaw',
      session: { hostSessionId: 's' },
      prompt: 'hello',
    });
    expect(r.endReason).toBe('timeout');
  }, 8000);

  it('인자: exec --json --skip-git-repo-check --ephemeral --sandbox workspace-write 포함', async () => {
    const adapter = new CodexCliAdapter({ binaryPath: FAKE_ECHO_ARGS });
    const r = await adapter.dispatch({
      botId: 'reviewclaw',
      session: { hostSessionId: 's' },
      prompt: 'hello-prompt',
    });
    const stderr = String(r.hostMeta?.stderr_tail ?? '');
    expect(stderr).toContain('exec');
    expect(stderr).toContain('--json');
    expect(stderr).toContain('--skip-git-repo-check');
    expect(stderr).toContain('--ephemeral');
    expect(stderr).toContain('--sandbox');
    expect(stderr).toContain('workspace-write');
    expect(stderr).toContain('hello-prompt');
  });

  it('ignoreUserConfig=true 면 --ignore-user-config + --ignore-rules 추가', async () => {
    const adapter = new CodexCliAdapter({
      binaryPath: FAKE_ECHO_ARGS,
      ignoreUserConfig: true,
    });
    const r = await adapter.dispatch({
      botId: 'reviewclaw',
      session: { hostSessionId: 's' },
      prompt: 'hello',
    });
    const stderr = String(r.hostMeta?.stderr_tail ?? '');
    expect(stderr).toContain('--ignore-user-config');
    expect(stderr).toContain('--ignore-rules');
  });

  it('signal abort → endReason=cancelled', async () => {
    const adapter = new CodexCliAdapter({
      binaryPath: FAKE_HANG,
      defaultTimeoutMs: 60_000,
    });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 100);
    const r = await adapter.dispatch({
      botId: 'reviewclaw',
      session: { hostSessionId: 's' },
      prompt: 'hello',
      signal: ctrl.signal,
    });
    expect(r.endReason).toBe('cancelled');
  }, 8000);

  it('defaultModel + defaultSandbox 매핑', async () => {
    const adapter = new CodexCliAdapter({
      binaryPath: FAKE_ECHO_ARGS,
      defaultModel: 'o3',
      defaultSandbox: 'dangerous',
    });
    const r = await adapter.dispatch({
      botId: 'reviewclaw',
      session: { hostSessionId: 's' },
      prompt: 'hello',
    });
    const stderr = String(r.hostMeta?.stderr_tail ?? '');
    expect(stderr).toContain('--model');
    expect(stderr).toContain('o3');
    // dangerous → danger-full-access
    expect(stderr).toContain('danger-full-access');
  });
});
