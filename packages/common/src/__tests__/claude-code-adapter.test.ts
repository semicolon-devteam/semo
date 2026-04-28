import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClaudeCodeAdapter } from '../runtime/adapters/claude-code-adapter.js';

/**
 * P6-1 단위 테스트.
 *
 * 실제 `claude` 바이너리를 호출하지 않고, stdin 을 받아 Claude Code 의 JSON 결과를
 * 모사하는 가짜 바이너리를 spawn 하여 ClaudeCodeAdapter.dispatch 의 wiring 을 검증.
 */

const FAKE_DIR = mkdtempSync(join(tmpdir(), 'semo-cc-adapter-'));

function writeFakeClaude(name: string, body: string): string {
  const path = join(FAKE_DIR, name);
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`, 'utf8');
  chmodSync(path, 0o755);
  return path;
}

const FAKE_OK = writeFakeClaude(
  'fake-claude-ok.sh',
  `cat > /dev/null
cat <<'JSON'
{"type":"result","subtype":"success","is_error":false,"duration_ms":42,"num_turns":1,"result":"hi from fake","stop_reason":"end_turn","session_id":"3a0a5584-e988-4795-aab0-f14af5b8540b","total_cost_usd":0.001,"permission_denials":[],"terminal_reason":"completed","uuid":"fa610c7d-66c7-409d-8258-f4ad2813ff58"}
JSON`,
);

const FAKE_ERR = writeFakeClaude(
  'fake-claude-err.sh',
  `cat > /dev/null
cat <<'JSON'
{"type":"result","subtype":"error_during_execution","is_error":true,"api_error_status":"401","duration_ms":10,"num_turns":0,"result":"Not logged in","stop_reason":"stop_sequence","session_id":"00000000-0000-4000-8000-000000000000","total_cost_usd":0,"permission_denials":[],"terminal_reason":"completed","uuid":"00000000-0000-4000-8000-000000000001"}
JSON`,
);

const FAKE_HANG = writeFakeClaude(
  'fake-claude-hang.sh',
  `cat > /dev/null
exec sleep 30`,
);

const FAKE_ECHO_ARGS = writeFakeClaude(
  'fake-claude-echo-args.sh',
  `cat > /dev/null
# args 를 stderr 로 기록 — adapter 가 hostMeta.stderr_tail 에 보존.
printf '%s\\n' "$@" >&2
cat <<'JSON'
{"type":"result","subtype":"success","is_error":false,"duration_ms":1,"num_turns":1,"result":"args-ok","stop_reason":"end_turn","session_id":"3a0a5584-e988-4795-aab0-f14af5b8540b","total_cost_usd":0,"permission_denials":[],"terminal_reason":"completed","uuid":"fa610c7d-66c7-409d-8258-f4ad2813ff58"}
JSON`,
);

afterAll(() => {
  rmSync(FAKE_DIR, { recursive: true, force: true });
});

describe('ClaudeCodeAdapter.dispatch (P6-1)', () => {
  it('파싱: result 텍스트와 session_id 를 그대로 매핑한다', async () => {
    const adapter = new ClaudeCodeAdapter({ binaryPath: FAKE_OK });
    const result = await adapter.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
    });
    expect(result.text).toBe('hi from fake');
    expect(result.session.hostSessionId).toBe('3a0a5584-e988-4795-aab0-f14af5b8540b');
    expect(result.endReason).toBe('completed');
    expect(result.toolCallCount).toBe(1);
    expect(result.hostMeta?.total_cost_usd).toBe(0.001);
  });

  it('is_error=true → endReason=error 매핑', async () => {
    const adapter = new ClaudeCodeAdapter({ binaryPath: FAKE_ERR });
    const result = await adapter.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
    });
    expect(result.endReason).toBe('error');
    expect(result.hostMeta?.api_error_status).toBe('401');
  });

  it('timeout → endReason=timeout + 자식 강제 종료', async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: FAKE_HANG,
      defaultTimeoutMs: 200,
    });
    const result = await adapter.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
    });
    expect(result.endReason).toBe('timeout');
  }, 8000);

  it("hookless 기본: --setting-sources '' + --settings {hooks:{}} 인자 포함", async () => {
    const adapter = new ClaudeCodeAdapter({ binaryPath: FAKE_ECHO_ARGS });
    const result = await adapter.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
    });
    const stderr = String(result.hostMeta?.stderr_tail ?? '');
    expect(stderr).toContain('--no-session-persistence');
    expect(stderr).toContain('--setting-sources');
    expect(stderr).toContain('{"hooks":{}}');
  });

  it('loadUserHooks=true 면 --setting-sources user 만 추가, hooks overlay 제외', async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: FAKE_ECHO_ARGS,
      loadUserHooks: true,
    });
    const result = await adapter.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
    });
    const stderr = String(result.hostMeta?.stderr_tail ?? '');
    expect(stderr).toContain('--setting-sources\nuser');
    expect(stderr).not.toContain('{"hooks":{}}');
  });

  it('useBareMode=true 면 --bare 인자 추가 + setting-sources/settings overlay 제외', async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: FAKE_ECHO_ARGS,
      useBareMode: true,
    });
    const r = await adapter.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
    });
    const stderr = String(r.hostMeta?.stderr_tail ?? '');
    expect(stderr).toContain('--bare');
    expect(stderr).not.toContain('--setting-sources');
    expect(stderr).not.toContain('{"hooks":{}}');
  });

  it('maxBudgetUsd: input 우선, 없으면 default, 둘 다 없으면 인자 미추가', async () => {
    const noBudget = new ClaudeCodeAdapter({ binaryPath: FAKE_ECHO_ARGS });
    const r1 = await noBudget.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
    });
    expect(String(r1.hostMeta?.stderr_tail ?? '')).not.toContain('--max-budget-usd');

    const defaultBudget = new ClaudeCodeAdapter({
      binaryPath: FAKE_ECHO_ARGS,
      defaultMaxBudgetUsd: 0.5,
    });
    const r2 = await defaultBudget.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
    });
    expect(String(r2.hostMeta?.stderr_tail ?? '')).toContain('--max-budget-usd\n0.5');

    const r3 = await defaultBudget.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: 'claude-code:planclaw:0' },
      prompt: 'hello',
      maxBudgetUsd: 1.25,
    });
    // input 우선
    expect(String(r3.hostMeta?.stderr_tail ?? '')).toContain('--max-budget-usd\n1.25');
  });

  it('hostSessionId 가 raw UUID 면 그대로 --session-id 로 패스, 아니면 새 UUID 생성', async () => {
    const adapter = new ClaudeCodeAdapter({ binaryPath: FAKE_ECHO_ARGS });
    const passedUuid = '11111111-2222-4333-8444-555555555555';
    await adapter.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: passedUuid },
      prompt: 'hello',
    });
    // FAKE_ECHO_ARGS 가 args 를 stderr 로 echo — 두 번째 dispatch 에서 다른 UUID 가 생성되는지 검증
    // 은 fake 단계에서는 어렵고, 인자 인코딩만 확인.
    const adapterEcho = new ClaudeCodeAdapter({ binaryPath: FAKE_ECHO_ARGS });
    const r = await adapterEcho.dispatch({
      botId: 'planclaw',
      session: { hostSessionId: passedUuid },
      prompt: 'hello',
    });
    expect(String(r.hostMeta?.stderr_tail ?? '')).toContain(passedUuid);
  });
});
