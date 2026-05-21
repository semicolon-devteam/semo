import { describe, expect, it } from 'vitest';
import { buildBotRuntimeConfig, requiresClaudeSeatForHostKind } from './bots-factory.js';

describe('bots factory runtime-aware creation helpers', () => {
  it('requires Claude seat only for legacy/claude-code host kinds', () => {
    expect(requiresClaudeSeatForHostKind(undefined)).toBe(true);
    expect(requiresClaudeSeatForHostKind('claude-code')).toBe(true);

    expect(requiresClaudeSeatForHostKind('hermes-cli')).toBe(false);
    expect(requiresClaudeSeatForHostKind('hermes-desktop')).toBe(false);
    expect(requiresClaudeSeatForHostKind('openclaw')).toBe(false);
    expect(requiresClaudeSeatForHostKind('codex-cli')).toBe(false);
    expect(requiresClaudeSeatForHostKind('ollama-cli')).toBe(false);
    expect(requiresClaudeSeatForHostKind('local-worker')).toBe(false);
  });

  it('builds hermes-cli runtime config without Claude seat fields', () => {
    const config = buildBotRuntimeConfig({
      hostKind: 'hermes-cli',
      hermesHome: '/tmp/hermes-agents',
      hermesProfile: 'semo-grant-research-agent',
      hermesProvider: 'openai-codex',
      hermesModel: 'gpt-5.5',
      hermesMaxTurns: 3,
      hermesRole: 'research/screening',
      hermesToolsets: 'web,file,terminal',
      hermesSkills: 'semo-operations',
    });

    expect(config).toEqual({
      host_kind: 'hermes-cli',
      transport: 'semo-mailbox-only',
      gateway_enabled: false,
      hermes_home: '/tmp/hermes-agents',
      hermes_profile: 'semo-grant-research-agent',
      hermes_provider: 'openai-codex',
      hermes_model: 'gpt-5.5',
      hermes_max_turns: 3,
      hermes_role: 'research/screening',
      hermes_toolsets: 'web,file,terminal',
      hermes_skills: 'semo-operations',
    });
  });
});
