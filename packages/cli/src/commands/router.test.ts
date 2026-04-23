import { describe, it, expect } from 'vitest';
import { __testables } from './router.js';
import { CURRENT_CONFIG_SCHEMA_VERSION } from '../config/types.js';
import type { SemoConfig, MessagingSource } from '../config/types.js';

const { pickPlatform } = __testables;

function cfg(sources: MessagingSource[]): SemoConfig {
  return {
    schema_version: CURRENT_CONFIG_SCHEMA_VERSION,
    profile: 'solo-offline',
    kb: { driver: 'sqlite' },
    ops: { driver: 'sqlite' },
    messaging: { sources },
    execution: { target: 'ollama' },
    network: { mode: 'offline' },
  };
}

describe('router — pickPlatform', () => {
  it('명시 옵션 우선: --platform slack', () => {
    expect(pickPlatform(cfg(['discord']), 'slack')).toBe('slack');
  });

  it('명시 옵션 검증: 알 수 없는 값은 throw', () => {
    expect(() => pickPlatform(cfg(['discord']), 'telegram')).toThrow(/discord 또는 slack/);
  });

  it('config 추론: discord 포함 → discord', () => {
    expect(pickPlatform(cfg(['discord']))).toBe('discord');
  });

  it('config 추론: slack 만 있음 → slack', () => {
    expect(pickPlatform(cfg(['slack']))).toBe('slack');
  });

  it('config 추론: discord + slack 공존 → discord 우선', () => {
    expect(pickPlatform(cfg(['slack', 'discord']))).toBe('discord');
  });

  it('config 추론: stdin 만 있음 → throw', () => {
    expect(() => pickPlatform(cfg(['stdin']))).toThrow(/messaging\.sources/);
  });

  it('config 추론: 빈 sources → throw', () => {
    expect(() => pickPlatform(cfg([]))).toThrow(/messaging\.sources/);
  });
});
