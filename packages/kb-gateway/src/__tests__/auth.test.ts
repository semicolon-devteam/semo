import { describe, it, expect } from 'vitest';
import { signPayload, verifySignature } from '../lib/auth.js';

describe('verifySignature', () => {
  const secret = 'test-secret-' + 'a'.repeat(48);
  const body = JSON.stringify({ hello: 'world' });

  it('accepts valid signature', () => {
    const sig = signPayload(body, secret);
    const r = verifySignature({ botId: 'semiclaw', signature: sig, rawBody: body, secret });
    expect(r.ok).toBe(true);
    expect(r.botId).toBe('semiclaw');
  });

  it('rejects missing bot id', () => {
    const sig = signPayload(body, secret);
    const r = verifySignature({ botId: undefined, signature: sig, rawBody: body, secret });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/X-Bot-Id/);
  });

  it('rejects missing signature', () => {
    const r = verifySignature({ botId: 'x', signature: undefined, rawBody: body, secret });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/X-Signature/);
  });

  it('rejects wrong signature', () => {
    const r = verifySignature({ botId: 'x', signature: 'deadbeef', rawBody: body, secret });
    expect(r.ok).toBe(false);
  });

  it('rejects tampered body (same sig, different body)', () => {
    const sig = signPayload(body, secret);
    const r = verifySignature({
      botId: 'x',
      signature: sig,
      rawBody: JSON.stringify({ hello: 'tampered' }),
      secret,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects when secret is empty', () => {
    const sig = signPayload(body, secret);
    const r = verifySignature({ botId: 'x', signature: sig, rawBody: body, secret: '' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/HMAC secret/);
  });
});
