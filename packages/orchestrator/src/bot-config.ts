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

// ── 동적 모델 업그레이드 ──

const OPUS_UPGRADE_TRIGGERS: Partial<Record<BotId, RegExp>> = {
  semiclaw: /의사결정|전략|로드맵|분쟁|에스컬|판단|우선순위\s*조정|리스크/i,
  reviewclaw: /보안|취약점|성능\s*병목|아키텍처|마이그레이션|리팩토링\s*전략/i,
  infraclaw: /마이그레이션|아키텍처|재설계|무중단|롤백\s*전략|DR/i,
  designclaw: /브랜딩|디자인\s*시스템\s*설계|사용성\s*분석|전체\s*리디자인/i,
};

export function resolveModelForMessage(botId: BotId, baseModel: string, message: string): string {
  if (baseModel === 'claude-opus-4-6') return baseModel;
  const trigger = OPUS_UPGRADE_TRIGGERS[botId];
  if (trigger?.test(message)) return 'claude-opus-4-6';
  const isLong = message.length > 300;
  const hasGenKeyword = /작성해|만들어|설계해|분석해|계획.*세워/i.test(message);
  if (isLong && hasGenKeyword) return 'claude-opus-4-6';
  return baseModel;
}

// Bot Slack profiles — KB 기반 동적 로드, 하드코딩 fallback
const FALLBACK_SLACK_PROFILES: Record<string, { username: string; icon_emoji: string }> = {
  semiclaw: { username: 'SemiClaw', icon_emoji: ':clipboard:' },
  planclaw: { username: 'PlanClaw', icon_emoji: ':bar_chart:' },
  designclaw: { username: 'DesignClaw', icon_emoji: ':art:' },
  workclaw: { username: 'WorkClaw', icon_emoji: ':hammer_and_wrench:' },
  reviewclaw: { username: 'ReviewClaw', icon_emoji: ':mag:' },
  infraclaw: { username: 'InfraClaw', icon_emoji: ':gear:' },
  growthclaw: { username: 'GrowthClaw', icon_emoji: ':chart_with_upwards_trend:' },
};
export let SLACK_PROFILES: Record<string, { username: string; icon_emoji: string }> = {
  ...FALLBACK_SLACK_PROFILES,
};

const SEMO_DASHBOARD_URL = process.env.SEMO_DASHBOARD_URL || 'https://semo.semi-colon.space';

export async function loadSlackProfilesFromAPI(): Promise<void> {
  try {
    const res = await fetch(`${SEMO_DASHBOARD_URL}/api/bots/profiles`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, { username: string; icon_emoji: string }>;
    if (Object.keys(data).length > 0) {
      SLACK_PROFILES = data;
      console.log(`[bot-config] Loaded ${Object.keys(data).length} bot profiles from KB`);
    }
  } catch {
    // API 미구현 시 하드코딩 프로필 사용 — 정상 동작
  }
}

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
