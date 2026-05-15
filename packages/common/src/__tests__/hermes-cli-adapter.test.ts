import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { HermesCliAdapter, HermesDesktopAdapter } from '../runtime/adapters/hermes-cli-adapter.js';

const FAKE_DIR = mkdtempSync(join(tmpdir(), 'semo-hermes-adapter-'));

function writeFake(name: string, body: string): string {
  const p = join(FAKE_DIR, name);
  writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`, 'utf8');
  chmodSync(p, 0o755);
  return p;
}

const FAKE_VERSION = writeFake(
  'fake-hermes-version.sh',
  `if [[ "$1" == "--version" ]]; then
  echo "hermes 0.0.fake"
  exit 0
fi
echo "Hermes says hello"`,
);

const FAKE_ECHO_ARGS = writeFake(
  'fake-hermes-echo-args.sh',
  `if [[ "$1" == "--version" ]]; then
  echo "hermes 0.0.fake"
  exit 0
fi
printf 'ARGS:'
for a in "$@"; do printf ' [%s]' "$a"; done
printf '\\n'
printf 'HERMES_HOME=%s\\n' "$HERMES_HOME"`,
);

const FAKE_HANG = writeFake('fake-hermes-hang.sh', `exec sleep 30`);

const FAKE_SESSION_ID = writeFake(
  'fake-hermes-session-id.sh',
  `if [[ "$1" == "--version" ]]; then
  echo "hermes 0.0.fake"
  exit 0
fi
printf 'ARGS:'
for a in "$@"; do printf ' [%s]' "$a"; done
printf '\\n'
printf 'session_id: 20260515_102345_abcdef\\n' >&2`,
);

afterAll(() => {
  rmSync(FAKE_DIR, { recursive: true, force: true });
});

describe('HermesCliAdapter', () => {
  it('probe: hermes --version 성공 시 ok=true', async () => {
    const adapter = new HermesCliAdapter({ binaryPath: FAKE_VERSION });
    const r = await adapter.probe();
    expect(r.ok).toBe(true);
    expect(r.detail).toContain('hermes 0.0.fake');
  });

  it('dispatch: hermes --profile semo-{bot} chat --query ... --quiet 호출', async () => {
    const adapter = new HermesCliAdapter({
      binaryPath: FAKE_ECHO_ARGS,
      hermesHome: '/tmp/hermes-semo-test',
      provider: 'openrouter',
      model: 'nous/test-model',
      toolsets: 'skills',
      skills: 'semo-canary',
      maxTurns: 4,
    });
    const session = await adapter.startSession({ botId: 'reviewclaw' });
    const r = await adapter.dispatch({
      botId: 'reviewclaw',
      session,
      prompt: 'hello',
    });

    expect(r.endReason).toBe('completed');
    expect(r.text).toContain('[--profile] [semo-reviewclaw]');
    expect(r.text).toContain('[chat] [--query] [hello] [--quiet]');
    expect(r.text).toContain('[--provider] [openrouter]');
    expect(r.text).toContain('[--model] [nous/test-model]');
    expect(r.text).toContain('[--toolsets] [skills]');
    expect(r.text).toContain('[--skills] [semo-canary]');
    expect(r.text).toContain('[--max-turns] [4]');
    expect(r.text).toContain('[--source] [semo-runtime]');
    expect(r.text).toContain('HERMES_HOME=/tmp/hermes-semo-test');
    expect(r.hostMeta?.profile).toBe('semo-reviewclaw');
  });

  it('dispatch: SEMO role-bounded worker context를 prompt 앞에 주입', async () => {
    const adapter = new HermesCliAdapter({
      binaryPath: FAKE_ECHO_ARGS,
      profile: 'semo-hermes-canary',
      semoRole: 'research/code-inspection/plan-review',
    });
    const session = await adapter.startSession({ botId: 'hermes-canary' });
    const r = await adapter.dispatch({
      botId: 'hermes-canary',
      session,
      prompt: 'what is your transport owner?',
    });

    expect(r.endReason).toBe('completed');
    expect(r.text).toContain('bot_id: hermes-canary');
    expect(r.text).toContain('SEMO role: research/code-inspection/plan-review');
    expect(r.text).toContain('SEMO mailbox/outbox is the only Slack/Discord transport owner');
    expect(r.text).toContain('User prompt:');
    expect(r.text).toContain('what is your transport owner?');
    expect(r.hostMeta?.semo_role).toBe('research/code-inspection/plan-review');
  });

  it('timeout → endReason=timeout', async () => {
    const adapter = new HermesCliAdapter({
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

  it('dispatch: enableSessionResume=true 이고 reused runtime session이면 --resume을 붙이고 Hermes session_id를 저장', async () => {
    const adapter = new HermesCliAdapter({
      binaryPath: FAKE_SESSION_ID,
      enableSessionResume: true,
    });
    const r = await adapter.dispatch({
      botId: 'hermes-canary',
      session: { hostSessionId: '20260515_101010_123abc' },
      prompt: 'hello again',
      context: { runtimeSessionReused: true },
    });

    expect(r.endReason).toBe('completed');
    expect(r.text).toContain('[--resume] [20260515_101010_123abc]');
    expect(r.session.hostSessionId).toBe('20260515_102345_abcdef');
    expect(r.hostMeta?.session_resume_enabled).toBe(true);
    expect(r.hostMeta?.session_resume_requested).toBe(true);
    expect(r.hostMeta?.hermes_session_id).toBe('20260515_102345_abcdef');
  });

  it('dispatch: resume opt-in이어도 reused가 아니면 --resume을 붙이지 않는다', async () => {
    const adapter = new HermesCliAdapter({
      binaryPath: FAKE_SESSION_ID,
      enableSessionResume: true,
    });
    const r = await adapter.dispatch({
      botId: 'hermes-canary',
      session: { hostSessionId: '20260515_101010_123abc' },
      prompt: 'first turn',
    });

    expect(r.text).not.toContain('[--resume]');
    expect(r.hostMeta?.session_resume_requested).toBe(false);
  });

  it('HermesDesktopAdapter remains a legacy alias with hermes-desktop kind', () => {
    const adapter = new HermesDesktopAdapter({ binaryPath: FAKE_VERSION });
    expect(adapter.kind).toBe('hermes-desktop');
  });
});
