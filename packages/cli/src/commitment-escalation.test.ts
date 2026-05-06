import { describe, it, expect } from 'vitest';
import { commitmentPatternId } from './commitment-escalation.js';

describe('commitmentPatternId', () => {
  it('groups identical titles to identical keys', () => {
    const a = commitmentPatternId('semiclaw', 'cron: SEMO cron poller heartbeat');
    const b = commitmentPatternId('semiclaw', 'cron: SEMO cron poller heartbeat');
    expect(a).toBe(b);
  });

  it('is case-insensitive', () => {
    const a = commitmentPatternId('semiclaw', 'cron: SEMO cron poller heartbeat');
    const b = commitmentPatternId('semiclaw', 'cron: semo cron poller heartbeat');
    expect(a).toBe(b);
  });

  it('collapses whitespace runs and trims', () => {
    const a = commitmentPatternId('semiclaw', 'cron: SEMO cron poller heartbeat');
    const b = commitmentPatternId('semiclaw', '  cron:   SEMO   cron poller heartbeat  ');
    expect(a).toBe(b);
  });

  it('normalizes full-width digits to ASCII (NFKC)', () => {
    const fw = commitmentPatternId('semiclaw', '서비스 헬스체크 (４개)');
    const ascii = commitmentPatternId('semiclaw', '서비스 헬스체크 (4개)');
    expect(fw).toBe(ascii);
  });

  it('strips zero-width invisibles', () => {
    const plain = commitmentPatternId('semiclaw', 'cron: SEMO cron poller heartbeat');
    // ZWSP at end and middle
    const dirty = commitmentPatternId('semiclaw', 'cron: SEMO​ cron poller heartbeat﻿');
    expect(plain).toBe(dirty);
  });

  it('isolates different bots even when titles match', () => {
    const semi = commitmentPatternId('semiclaw', 'cron: same task');
    const plan = commitmentPatternId('planclaw', 'cron: same task');
    expect(semi).not.toBe(plan);
  });

  it('survives emoji and grapheme clusters without breaking', () => {
    const key = commitmentPatternId('semiclaw', 'release v1.2.3 🚀 deploy');
    expect(key).toMatch(/^semiclaw::.+#[0-9a-f]{10}$/);
    expect(key).toContain('🚀');
  });

  it('emits hash suffix that distinguishes titles sharing a 60-code-point prefix', () => {
    const sharedPrefix = 'a'.repeat(60);
    const a = commitmentPatternId('semiclaw', sharedPrefix + ' alpha');
    const b = commitmentPatternId('semiclaw', sharedPrefix + ' beta');
    expect(a).not.toBe(b);
    // visible prefix is identical between them
    const aPrefix = a.split('#')[0];
    const bPrefix = b.split('#')[0];
    expect(aPrefix).toBe(bPrefix);
    // but hash suffix differs
    expect(a.split('#')[1]).not.toBe(b.split('#')[1]);
  });
});
