import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { BotConfig } from './types';

const AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');

// Phase 1에서 전환한 agent definition frontmatter 파싱
function parseAgentDefinition(botId: string): {
  model: string;
  tools: string[];
  maxTurns: number;
  body: string;
} {
  const filePath = path.join(AGENTS_DIR, botId, `${botId}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent definition not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error(`No YAML frontmatter in ${filePath}`);
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  // Simple YAML parsing (tools is array, others are scalars)
  const model =
    frontmatter
      .match(/^model:\s*(.+)$/m)?.[1]
      ?.trim()
      .replace(/"/g, '') || 'inherit';
  const maxTurns = parseInt(frontmatter.match(/^maxTurns:\s*(\d+)$/m)?.[1] || '30', 10);

  const tools: string[] = [];
  const toolsMatch = frontmatter.match(/^tools:\n((?:\s+-\s+.+\n?)+)/m);
  if (toolsMatch) {
    for (const line of toolsMatch[1].split('\n')) {
      const t = line.match(/^\s+-\s+(.+)$/)?.[1]?.trim();
      if (t) tools.push(t);
    }
  }

  return { model, tools, maxTurns, body };
}

function resolveModel(model: string): string {
  if (model === 'inherit' || model === 'opus') return 'claude-opus-4-6';
  if (model === 'sonnet') return 'claude-sonnet-4-6';
  if (model === 'haiku') return 'claude-haiku-4-5-20251001';
  return model; // full model ID
}

export const SLACK_PROFILES: Record<string, { username: string; icon_emoji: string }> = {
  semiclaw: { username: 'SemiClaw', icon_emoji: ':clipboard:' },
  planclaw: { username: 'PlanClaw', icon_emoji: ':bar_chart:' },
  designclaw: { username: 'DesignClaw', icon_emoji: ':art:' },
  workclaw: { username: 'WorkClaw', icon_emoji: ':hammer_and_wrench:' },
  reviewclaw: { username: 'ReviewClaw', icon_emoji: ':mag:' },
  infraclaw: { username: 'InfraClaw', icon_emoji: ':gear:' },
  growthclaw: { username: 'GrowthClaw', icon_emoji: ':chart_with_upwards_trend:' },
};

// 봇별 KB 접근 도메인 — semicolon(공통)은 모든 봇에 허용
const KB_DOMAINS: Record<string, string[]> = {
  semiclaw: [], // orchestrator: 제한 없음 (빈 배열 = 전체 허용)
  planclaw: ['semicolon', 'semo'],
  designclaw: ['semicolon'],
  workclaw: ['semicolon'],
  reviewclaw: ['semicolon'],
  infraclaw: ['semicolon', 'semo'],
  growthclaw: ['semicolon'],
};

const BUDGET_PER_MESSAGE: Record<string, number> = {
  semiclaw: 1.5,
  planclaw: 1.0,
  designclaw: 1.0,
  workclaw: 1.5,
  reviewclaw: 0.8,
  infraclaw: 1.0,
  growthclaw: 0.5,
};

export const BOT_IDS = [
  'semiclaw',
  'planclaw',
  'designclaw',
  'workclaw',
  'reviewclaw',
  'infraclaw',
  'growthclaw',
] as const;
export type BotId = (typeof BOT_IDS)[number];

export function loadBotConfig(botId: BotId, serviceDomain?: string): BotConfig {
  const def = parseAgentDefinition(botId);

  // 서비스 도메인을 KB 접근 목록에 동적 추가
  const kbDomains = [...(KB_DOMAINS[botId] || [])];
  if (serviceDomain && kbDomains.length > 0) {
    kbDomains.push(serviceDomain);
  }

  return {
    botId,
    model: resolveModel(def.model),
    tools: def.tools,
    maxTurns: def.maxTurns,
    maxBudgetPerMessage: BUDGET_PER_MESSAGE[botId] || 1.0,
    soulPrompt: def.body,
    kbDomains,
    slackProfile: SLACK_PROFILES[botId] || { username: botId, icon_emoji: ':robot_face:' },
  };
}

export function loadAllBotConfigs(): Map<BotId, BotConfig> {
  const configs = new Map<BotId, BotConfig>();
  for (const botId of BOT_IDS) {
    try {
      configs.set(botId, loadBotConfig(botId));
    } catch (err) {
      console.error(`[bot-config] Failed to load ${botId}:`, err);
    }
  }
  return configs;
}
