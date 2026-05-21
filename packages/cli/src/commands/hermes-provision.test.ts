import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildHermesProvisionPlan,
  ensureHermesProvisioned,
  findHermesSkillSource,
  parseHermesSkillList,
} from './hermes-provision.js';

describe('Hermes provision helpers', () => {
  it('defaults hermes-cli bot profiles to semo-<botId> and parses skills', () => {
    const plan = buildHermesProvisionPlan({
      botId: 'grant-research-agent',
      hostKind: 'hermes-cli',
      hermesSkills: 'semo-operations, youtube-content ',
    });

    expect(plan.required).toBe(true);
    expect(plan.profile).toBe('semo-grant-research-agent');
    expect(plan.baseProfile).toBe('semo-hermes-canary');
    expect(plan.skills).toEqual(['semo-operations', 'youtube-content']);
  });

  it('respects explicit profile/base/home and skips non-Hermes hosts', () => {
    const plan = buildHermesProvisionPlan({
      botId: 'worker',
      hostKind: 'codex-cli',
      hermesHome: '/tmp/hermes-home',
      hermesProfile: 'custom-profile',
      hermesBaseProfile: 'base-profile',
    });

    expect(plan.required).toBe(false);
    expect(plan.home).toBe('/tmp/hermes-home');
    expect(plan.profile).toBe('custom-profile');
    expect(plan.baseProfile).toBe('base-profile');
  });

  it('finds local skills by frontmatter name under category directories', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-skill-src-'));
    const skillDir = path.join(home, 'skills', 'devops', 'semo-operations');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      ['---', 'name: semo-operations', '---', '# SEMO Operations'].join('\n'),
    );

    expect(findHermesSkillSource('semo-operations', [home])).toBe(skillDir);
  });

  it('parses the current Hermes skills table output', () => {
    const names = parseHermesSkillList(
      `│ semo-operations         │ devops │ local │ local │ enabled │\n│ test-driven-development │ software-development │ builtin │ builtin │ enabled │`,
    );
    expect(names).toContain('semo-operations');
    expect(names).toContain('test-driven-development');
  });

  it('syncs requested skills into the target profile scope as well as HERMES_HOME', async () => {
    const sourceHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-skill-source-'));
    const targetHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-skill-target-'));
    const skillDir = path.join(sourceHome, 'skills', 'devops', 'semo-operations');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      ['---', 'name: semo-operations', '---', '# SEMO Operations'].join('\n'),
    );

    const plan = buildHermesProvisionPlan({
      botId: 'smoke-agent',
      hostKind: 'hermes-cli',
      hermesHome: targetHome,
      hermesProfile: 'semo-smoke-agent',
      hermesSkills: 'semo-operations',
    });

    const result = await ensureHermesProvisioned(plan, {
      sourceHomes: [sourceHome],
      runner: async (args) => {
        if (args[0] === 'profile' && args[1] === 'show') throw new Error('missing');
        return { stdout: '', stderr: '' };
      },
    });

    expect(result.profileCreated).toBe(true);
    expect(result.skillsSynced).toEqual(['semo-operations']);
    expect(
      fs.existsSync(
        path.join(
          targetHome,
          'profiles',
          'semo-smoke-agent',
          'skills',
          'devops',
          'semo-operations',
          'SKILL.md',
        ),
      ),
    ).toBe(true);
  });
});
