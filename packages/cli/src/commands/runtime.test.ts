import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildRuntimeAudit,
  buildRuntimeSessionEntry,
  buildRuntimeSessionKey,
  formatDispatchFailureForLog,
  loadRuntimeSessionMap,
  normalizeDispatchOutput,
  saveRuntimeSessionMap,
} from './runtime';

describe('runtime serve logging', () => {
  it('includes hostMeta stderr_tail and exit metadata for non-completed dispatch results', () => {
    const line = formatDispatchFailureForLog(
      {
        text: '',
        endReason: 'error',
        hostMeta: {
          exit_code: 42,
          signal: 'SIGTERM',
          stderr_tail: 'No inference provider configured',
        },
      },
      1234,
    );

    expect(line).toContain('endReason=error');
    expect(line).toContain('1234ms');
    expect(line).toContain('exit_code=42');
    expect(line).toContain('signal=SIGTERM');
    expect(line).toContain('stderr_tail=No inference provider configured');
  });

  it('includes a response text snippet when dispatch returns text with a non-completed reason', () => {
    const line = formatDispatchFailureForLog(
      {
        text: 'partial response before failure',
        endReason: 'timeout',
        hostMeta: {},
      },
      5000,
    );

    expect(line).toContain('endReason=timeout');
    expect(line).toContain('text=partial response before failure');
  });
});

describe('runtime output envelope', () => {
  it('uses plain text as canonical fallback', () => {
    const out = normalizeDispatchOutput('그냥 일반 답변');

    expect(out.replyText).toBe('그냥 일반 답변');
    expect(out.kbStatus).toBe('not-needed');
    expect(out.envelope).toBeUndefined();
  });

  it('extracts fenced JSON envelope when reply_text is present', () => {
    const out = normalizeDispatchOutput([
      '```json',
      '{"reply_text":"정규화된 답변","kb_status":"pending","needs_user_confirmation":true,"actions_taken":["checked"],"files_changed":["a.ts"],"suggested_delegation":"role:review"}',
      '```',
    ].join('\n'));

    expect(out.replyText).toBe('정규화된 답변');
    expect(out.kbStatus).toBe('pending');
    expect(out.needsUserConfirmation).toBe(true);
    expect(out.envelope?.actions_taken).toEqual(['checked']);
    expect(out.envelope?.files_changed).toEqual(['a.ts']);
    expect(out.envelope?.suggested_delegation).toBe('role:review');
  });

  it('falls back to original text when JSON is invalid or lacks reply_text', () => {
    const invalid = '```json\n{"kb_status":"written"}\n```';
    const out = normalizeDispatchOutput(invalid);

    expect(out.replyText).toBe(invalid);
    expect(out.envelope).toBeUndefined();
  });
});

describe('runtime audit metadata', () => {
  it('captures host/provider/model/role/end/timeout and redacted stderr tail', () => {
    const audit = buildRuntimeAudit({
      botId: 'hermes-canary',
      hostKind: 'hermes-cli',
      elapsedMs: 1234,
      timeoutMs: 300000,
      result: {
        text: 'ok',
        endReason: 'timeout',
        hostMeta: {
          profile: 'semo-hermes-canary',
          provider: 'openai-codex',
          model: 'gpt-5.5',
          semo_role: 'research/code-inspection/plan-review',
          session_resume_enabled: true,
          session_resume_requested: true,
          hermes_session_id: '20260515_102345_abcdef',
          exit_code: 124,
          stderr_tail: 'Authorization: Bearer *** failed',
        },
      },
    });

    expect(audit.bot_id).toBe('hermes-canary');
    expect(audit.host_kind).toBe('hermes-cli');
    expect(audit.profile).toBe('semo-hermes-canary');
    expect(audit.provider).toBe('openai-codex');
    expect(audit.model).toBe('gpt-5.5');
    expect(audit.semo_role).toBe('research/code-inspection/plan-review');
    expect(audit.session_resume_enabled).toBe(true);
    expect(audit.session_resume_requested).toBe(true);
    expect(audit.hermes_session_id).toBe('20260515_102345_abcdef');
    expect(audit.end_reason).toBe('timeout');
    expect(audit.timeout_ms).toBe(300000);
    expect(audit.exit_code).toBe(124);
    expect(audit.stderr_tail).toContain('Bearer [REDACTED]');
    expect(audit.stderr_tail).not.toContain('secret-token-123');
  });
});

describe('runtime thread session mapping', () => {
  it('keys sessions by platform/channel/thread/bot and sanitizes unsafe separators', () => {
    const key = buildRuntimeSessionKey('hermes-canary', {
      id: 'msg-1',
      platform: 'slack',
      channel_id: 'C123',
      thread_id: '171.42/unsafe',
    });

    expect(key).toBe('slack:C123:171.42_unsafe:hermes-canary');
  });

  it('falls back to message id when no thread id exists to avoid channel-wide leaks', () => {
    const a = buildRuntimeSessionKey('hermes-canary', {
      id: 'msg-a',
      platform: 'discord',
      channel_id: 'chan-1',
    });
    const b = buildRuntimeSessionKey('hermes-canary', {
      id: 'msg-b',
      platform: 'discord',
      channel_id: 'chan-1',
    });

    expect(a).not.toBe(b);
  });

  it('loads, saves, and prunes expired runtime session mappings', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-runtime-session-'));
    const file = path.join(dir, 'sessions.json');
    const active = buildRuntimeSessionEntry({ hostSessionId: 'session-a' }, 60_000);
    const expired = {
      session: { hostSessionId: 'session-old' },
      updated_at: new Date(Date.now() - 120_000).toISOString(),
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    };

    saveRuntimeSessionMap(file, { active, expired });
    const loaded = loadRuntimeSessionMap(file, 60_000);

    expect(loaded.active?.session.hostSessionId).toBe('session-a');
    expect(loaded.expired).toBeUndefined();
  });
});
