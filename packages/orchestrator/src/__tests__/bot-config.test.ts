import { describe, it, expect } from 'vitest';
import { loadBotConfig, loadAllBotConfigs, BOT_IDS } from '../bot-config';

describe('bot-config', () => {
  describe('BOT_IDS', () => {
    it('should contain all 7 bots', () => {
      expect(BOT_IDS).toHaveLength(7);
      expect(BOT_IDS).toContain('semiclaw');
      expect(BOT_IDS).toContain('planclaw');
      expect(BOT_IDS).toContain('designclaw');
      expect(BOT_IDS).toContain('workclaw');
      expect(BOT_IDS).toContain('reviewclaw');
      expect(BOT_IDS).toContain('infraclaw');
      expect(BOT_IDS).toContain('growthclaw');
    });
  });

  describe('loadBotConfig', () => {
    it('should load semiclaw config with correct model', () => {
      const config = loadBotConfig('semiclaw');
      expect(config.botId).toBe('semiclaw');
      expect(config.model).toBe('claude-opus-4-6'); // inherit → opus
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
      for (const botId of BOT_IDS) {
        const config = loadBotConfig(botId);
        expect(config.slackProfile.username).toBeTruthy();
        expect(config.slackProfile.icon_emoji).toMatch(/^:/);
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
      expect(() => loadBotConfig('nonexistent' as any)).toThrow('Agent definition not found');
    });
  });

  describe('loadAllBotConfigs', () => {
    it('should load all 7 bot configs', () => {
      const configs = loadAllBotConfigs();
      expect(configs.size).toBe(7);
      for (const botId of BOT_IDS) {
        expect(configs.has(botId)).toBe(true);
      }
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
