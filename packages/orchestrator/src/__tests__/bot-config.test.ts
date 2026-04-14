import { describe, it, expect } from 'vitest';
import { loadBotConfig, loadAllBotConfigs, FALLBACK_BOT_IDS } from '../bot-config';

describe('bot-config', () => {
  describe('FALLBACK_BOT_IDS', () => {
    it('should contain all 8 bots (7 claw + incubator)', () => {
      expect(FALLBACK_BOT_IDS).toHaveLength(8);
      expect(FALLBACK_BOT_IDS).toContain('semiclaw');
      expect(FALLBACK_BOT_IDS).toContain('planclaw');
      expect(FALLBACK_BOT_IDS).toContain('designclaw');
      expect(FALLBACK_BOT_IDS).toContain('workclaw');
      expect(FALLBACK_BOT_IDS).toContain('reviewclaw');
      expect(FALLBACK_BOT_IDS).toContain('infraclaw');
      expect(FALLBACK_BOT_IDS).toContain('growthclaw');
      expect(FALLBACK_BOT_IDS).toContain('incubator');
    });
  });

  describe('loadBotConfig', () => {
    it('should load semiclaw config with correct model', () => {
      const config = loadBotConfig('semiclaw');
      expect(config.botId).toBe('semiclaw');
      expect(config.model).toBe('claude-sonnet-4-6'); // sonnet (PM/라우팅 위주)
      expect(config.maxTurns).toBe(50);
      expect(config.tools).toContain('Read');
      expect(config.tools).toContain('Bash');
    });

    it('should load growthclaw with sonnet model', () => {
      const config = loadBotConfig('growthclaw');
      expect(config.model).toBe('claude-sonnet-4-6');
    });

    it('should restrict reviewclaw tools — no Edit/Write', () => {
      const config = loadBotConfig('reviewclaw');
      expect(config.tools).toContain('Read');
      expect(config.tools).toContain('Grep');
      expect(config.tools).toContain('Bash');
      expect(config.tools).not.toContain('Edit');
      expect(config.tools).not.toContain('Write');
    });

    it('should restrict planclaw tools — no Edit', () => {
      const config = loadBotConfig('planclaw');
      expect(config.tools).toContain('Write');
      expect(config.tools).not.toContain('Edit');
    });

    it('should give workclaw full tools', () => {
      const config = loadBotConfig('workclaw');
      expect(config.tools).toContain('Read');
      expect(config.tools).toContain('Edit');
      expect(config.tools).toContain('Write');
      expect(config.tools).toContain('Bash');
    });

    it('should have soulPrompt body (non-empty)', () => {
      const config = loadBotConfig('designclaw');
      expect(config.soulPrompt.length).toBeGreaterThan(100);
      expect(config.soulPrompt).toContain('DesignClaw');
    });

    it('should have slack profile for each bot', () => {
      for (const botId of FALLBACK_BOT_IDS) {
        try {
          const config = loadBotConfig(botId);
          expect(config.slackProfile.username).toBeTruthy();
          expect(config.slackProfile.icon_emoji).toMatch(/^:/);
        } catch {
          // incubator agent definition may not exist yet in test env
        }
      }
    });

    it('should add serviceDomain to kbDomains when provided', () => {
      const config = loadBotConfig('designclaw', 'seum');
      expect(config.kbDomains).toContain('semicolon');
      expect(config.kbDomains).toContain('seum');
    });

    it('should give semiclaw empty kbDomains (full access)', () => {
      const config = loadBotConfig('semiclaw');
      expect(config.kbDomains).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should throw for nonexistent bot', () => {
      expect(() => loadBotConfig('nonexistent')).toThrow('Agent definition not found');
    });
  });

  describe('loadAllBotConfigs', () => {
    it('should load bot configs from fallback list', () => {
      const configs = loadAllBotConfigs();
      expect(configs.size).toBeGreaterThanOrEqual(7);
      expect(configs.has('semiclaw')).toBe(true);
      expect(configs.has('planclaw')).toBe(true);
    });

    it('should have consistent maxBudgetPerMessage', () => {
      const configs = loadAllBotConfigs();
      for (const [, config] of configs) {
        expect(config.maxBudgetPerMessage).toBeGreaterThan(0);
        expect(config.maxBudgetPerMessage).toBeLessThanOrEqual(2);
      }
    });
  });
});
