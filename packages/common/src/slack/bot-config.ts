import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Pool } from 'pg';
import type { BotConfig } from './channel-types.js';
import { resolveMcpForBot, loadMcpAccessFromDb } from '../mcp-config.js';
import { resolveBotWorkspace } from '../paths.js';

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
  incubator: { username: 'Incubator', icon_emoji: ':hatching_chick:' },
};
export let SLACK_PROFILES: Record<string, { username: string; icon_emoji: string }> = {
  ...FALLBACK_SLACK_PROFILES,
};

const SEMO_DASHBOARD_URL = process.env.SEMO_DASHBOARD_URL || '';

export async function loadSlackProfilesFromAPI(): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    if (process.env.SEMO_AGENT_SECRET) {
      headers['x-semo-agent-token'] = process.env.SEMO_AGENT_SECRET;
      headers['x-semo-agent-id'] = 'orchestrator';
    }
    const res = await fetch(`${SEMO_DASHBOARD_URL}/api/bots/profiles`, { headers });
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

/** Fallback 봇 목록 (DB 장애 시) */
export const FALLBACK_BOT_IDS = [
  'semiclaw',
  'planclaw',
  'designclaw',
  'workclaw',
  'reviewclaw',
  'infraclaw',
  'growthclaw',
  'incubator',
] as const;

/** @deprecated Use string directly. Kept for backward compat. */
export type BotId = string;

/** DB에서 활성 봇 목록 동적 로드 (bot_status 기반) */
let _activeBotIds: string[] = [...FALLBACK_BOT_IDS];
export async function loadActiveBotIds(pool: Pool): Promise<string[]> {
  try {
    const result = await pool.query(
      `SELECT bot_id FROM semo.bot_status WHERE status != 'retired' ORDER BY bot_id`,
    );
    if (result.rows.length > 0) {
      _activeBotIds = result.rows.map((r) => r.bot_id);
    }
  } catch {
    // fallback to hardcoded list
  }
  return _activeBotIds;
}
export function getActiveBotIds(): readonly string[] {
  return _activeBotIds;
}

export function loadBotConfig(botId: string, serviceDomain?: string): BotConfig {
  const def = parseAgentDefinition(botId);

  // 서비스 도메인을 KB 접근 목록에 동적 추가
  const kbDomains = [...(KB_DOMAINS[botId] || [])];
  if (serviceDomain && kbDomains.length > 0) {
    kbDomains.push(serviceDomain);
  }

  const mcp = resolveMcpForBot(botId);

  return {
    botId,
    model: resolveModel(def.model),
    tools: def.tools,
    maxTurns: def.maxTurns,
    maxBudgetPerMessage: BUDGET_PER_MESSAGE[botId] || 1.0,
    soulPrompt: def.body,
    kbDomains,
    slackProfile: SLACK_PROFILES[botId] || { username: botId, icon_emoji: ':robot_face:' },
    ...(Object.keys(mcp.servers).length > 0
      ? { mcpServers: mcp.servers, mcpAllowedTools: mcp.allowedTools }
      : {}),
  };
}

export function loadAllBotConfigs(): Map<string, BotConfig> {
  const configs = new Map<string, BotConfig>();
  for (const botId of FALLBACK_BOT_IDS) {
    try {
      configs.set(botId, loadBotConfig(botId));
    } catch (err) {
      console.error(`[bot-config] Failed to load ${botId}:`, err);
    }
  }
  return configs;
}

// ── Parent-based KB domain expansion ──

// Cache: parent domain → child domains (populated once at boot)
const childDomainCache = new Map<string, string[]>();

/**
 * Expand KB domains by including child domains (modules) of each parent.
 * Queries semo.ontology.parent at boot time, caches the result.
 */
export async function expandKBDomainsWithChildren(
  pool: Pool,
  domains: string[],
): Promise<string[]> {
  const expanded = [...domains];
  const uncached = domains.filter((d) => !childDomainCache.has(d));

  if (uncached.length > 0) {
    try {
      const res = await pool.query(
        'SELECT domain, parent FROM semo.ontology WHERE parent = ANY($1)',
        [uncached],
      );
      // Initialize cache for all queried domains
      for (const d of uncached) childDomainCache.set(d, []);
      for (const row of res.rows) {
        childDomainCache.get(row.parent)!.push(row.domain);
      }
    } catch (err) {
      console.error('[bot-config] Failed to expand child domains:', err);
      // Non-fatal: bots still work with base domains
    }
  }

  for (const d of domains) {
    const children = childDomainCache.get(d);
    if (children) expanded.push(...children);
  }

  return [...new Set(expanded)];
}

/**
 * Load all bot configs with parent-based KB domain expansion.
 * Async version — call after DB pool is ready.
 */
export async function loadAllBotConfigsAsync(pool: Pool): Promise<Map<string, BotConfig>> {
  const configs = new Map<string, BotConfig>();

  // DB에서 MCP 접근 매트릭스 + 활성 봇 목록 동적 로드
  await loadMcpAccessFromDb(pool);
  const activeBotIds = await loadActiveBotIds(pool);

  // Pre-expand all unique base domains across bots
  const allBaseDomains = new Set<string>();
  for (const domains of Object.values(KB_DOMAINS)) {
    for (const d of domains) allBaseDomains.add(d);
  }
  await expandKBDomainsWithChildren(pool, [...allBaseDomains]);

  for (const botId of activeBotIds) {
    try {
      const def = parseAgentDefinition(botId);
      const baseDomains = KB_DOMAINS[botId] || ['semicolon'];
      const kbDomains =
        baseDomains.length > 0 ? await expandKBDomainsWithChildren(pool, baseDomains) : [];

      const mcp = resolveMcpForBot(botId);

      const botConfig: BotConfig = {
        botId,
        model: resolveModel(def.model),
        tools: def.tools,
        maxTurns: def.maxTurns,
        maxBudgetPerMessage: BUDGET_PER_MESSAGE[botId] || 1.0,
        soulPrompt: def.body,
        kbDomains,
        slackProfile: SLACK_PROFILES[botId] || { username: botId, icon_emoji: ':robot_face:' },
        ...(Object.keys(mcp.servers).length > 0
          ? { mcpServers: mcp.servers, mcpAllowedTools: mcp.allowedTools }
          : {}),
      };

      if (botId === 'workclaw') {
        botConfig.agents = {
          'worktree-coder': {
            description:
              'Runs coding tasks in an isolated git worktree to prevent conflicts with main branch. Use for any task that modifies source code files.',
            prompt: [
              'You are a coding agent running in an isolated git worktree.',
              'Your CWD is a temporary worktree branched from the target repository.',
              'Follow this workflow:',
              '1. Create a feature branch (feat/<slug>)',
              '2. Implement the requested changes',
              '3. Run build verification (tsc --noEmit, lint)',
              '4. Commit changes with a descriptive message',
              '5. Push the branch and create a PR to dev',
              'Report results when done. Do not merge.',
            ].join('\n'),
            tools: ['Read', 'Glob', 'Grep', 'Bash', 'Edit', 'Write'],
            model: 'sonnet',
            maxTurns: 50,
            effort: 'medium',
            permissionMode: 'acceptEdits',
          },
          'build-verify-background': {
            description:
              'Runs full build verification (tsc --noEmit, lint, build) in the background. Use when asked to verify the build or run a full check.',
            prompt: [
              'Run the following commands in sequence and report results:',
              '1. npx tsc --noEmit',
              '2. npm run lint',
              '3. npm run build',
              'Report pass/fail for each step with any error output.',
            ].join('\n'),
            tools: ['Bash', 'Read'],
            model: 'claude-haiku-4-5-20251001',
            maxTurns: 20,
            effort: 'low',
            permissionMode: 'acceptEdits',
            background: true,
          },
        };
        botConfig.worktreeSettings = {
          symlinkDirectories: ['node_modules', '.next', '.cache'],
        };
      }

      configs.set(botId, botConfig);
    } catch (err) {
      console.error(`[bot-config] Failed to load ${botId}:`, err);
    }
  }
  return configs;
}

// ── Per-bot skill symlinks ──

export function syncBotSkillSymlinks(botId: string, sessionCwd: string): number {
  const skillsDir = path.join(sessionCwd, '.claude', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });
  const srcDir = path.join(resolveBotWorkspace(botId), 'skills');
  if (!fs.existsSync(srcDir)) return 0;

  let count = 0;
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    if (!fs.statSync(src).isDirectory()) continue;
    if (!fs.existsSync(path.join(src, 'SKILL.md'))) continue;

    const dest = path.join(skillsDir, name);
    try {
      if (fs.lstatSync(dest).isSymbolicLink() && fs.readlinkSync(dest) === src) {
        count++;
        continue;
      }
      fs.rmSync(dest, { recursive: true });
    } catch {
      // dest doesn't exist
    }
    fs.symlinkSync(src, dest);
    count++;
  }
  return count;
}
