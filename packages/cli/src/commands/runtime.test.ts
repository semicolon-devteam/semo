import { describe, expect, it } from 'vitest';
import { buildRuntimeAudit, formatDispatchFailureForLog, normalizeDispatchOutput } from './runtime';

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
          exit_code: 124,
          stderr_tail: 'Authorization: Bearer secret-token-123 failed',
        },
      },
    });

    expect(audit.bot_id).toBe('hermes-canary');
    expect(audit.host_kind).toBe('hermes-cli');
    expect(audit.profile).toBe('semo-hermes-canary');
    expect(audit.provider).toBe('openai-codex');
    expect(audit.model).toBe('gpt-5.5');
    expect(audit.semo_role).toBe('research/code-inspection/plan-review');
    expect(audit.end_reason).toBe('timeout');
    expect(audit.timeout_ms).toBe(300000);
    expect(audit.exit_code).toBe(124);
    expect(audit.stderr_tail).toContain('Bearer [REDACTED]');
    expect(audit.stderr_tail).not.toContain('secret-token-123');
  });
});
