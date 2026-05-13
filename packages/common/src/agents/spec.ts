import type { HostKind } from '../runtime/host-adapter.js';
import type {
  AgentDelegationSpec,
  AgentModelPolicy,
  AgentProfile,
  AgentProjectionChannel,
  AgentSpec,
} from './types.js';

export interface AgentDefinitionProjection {
  name: string;
  displayName?: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
}

export interface BotStatusProjection {
  bot_id: string;
  name?: string | null;
  emoji?: string | null;
  role?: string | null;
  kb_domains?: string[] | null;
  budget_per_message?: number | string | null;
  slack_username?: string | null;
  slack_icon_emoji?: string | null;
  derived_from?: string | null;
  reply_as?: string | null;
  is_helper?: boolean | null;
  skip_projection_targets?: string[] | null;
}

export interface BotDelegationProjection {
  from_bot_id: string;
  to_bot_id: string;
  domains?: string[] | null;
  delegation_type?: string | null;
  method?: string | null;
  channel?: string | null;
  priority?: number | null;
}

export interface BuildAgentSpecInput {
  agent: AgentDefinitionProjection;
  botStatus?: BotStatusProjection | null;
  delegations?: BotDelegationProjection[];
  profile?: AgentProfile;
  modelPolicy?: Partial<AgentModelPolicy>;
}

const TEAM_MODEL_POLICY: AgentModelPolicy = {
  primary: 'openai-codex/gpt-5.5',
  fallbacks: [],
  forbiddenProviders: ['anthropic'],
};

const PERSONAL_MODEL_POLICY: AgentModelPolicy = {
  primary: 'ollama/llama3.1',
  fallbacks: [],
  forbiddenProviders: [],
};

const DEFAULT_RUNTIME_HINTS: HostKind[] = ['claude-code', 'codex-cli', 'openclaw'];
const TEAM_DEFAULT_TOOLS = ['Read', 'Glob', 'Grep', 'Bash', 'Edit', 'Write', 'WebFetch'];
const PERSONAL_DEFAULT_TOOLS = ['Read', 'Glob', 'Grep', 'Bash'];

export function stripMarkdownFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content.trim() };

  return {
    frontmatter: parseSimpleFrontmatter(match[1]),
    body: match[2].trim(),
  };
}

function parseSimpleFrontmatter(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let currentArrayKey: string | null = null;
  for (const line of raw.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const arrayMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayMatch && currentArrayKey) {
      const prev = Array.isArray(out[currentArrayKey]) ? (out[currentArrayKey] as string[]) : [];
      out[currentArrayKey] = [...prev, unquote(arrayMatch[1].trim())];
      continue;
    }

    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    currentArrayKey = key;
    if (value.length === 0) {
      out[key] = [];
    } else {
      out[key] = unquote(value);
    }
  }
  return out;
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function projectionTargetArray(value: unknown): AgentSpec['skipProjectionTargets'] {
  const allowed = new Set(['claude-code', 'codex-skill', 'openclaw']);
  return stringArray(value).filter(
    (v): v is NonNullable<AgentSpec['skipProjectionTargets']>[number] => allowed.has(v),
  );
}

function displayName(input: BuildAgentSpecInput, frontmatter: Record<string, unknown>): string {
  return (
    input.botStatus?.slack_username ??
    input.botStatus?.name ??
    input.agent.displayName ??
    (typeof frontmatter.name === 'string' ? frontmatter.name : null) ??
    input.agent.name
  );
}

function normalizeDelegations(rows: BotDelegationProjection[] = []): AgentDelegationSpec[] {
  return rows
    .filter((row) => row.to_bot_id)
    .map((row) => ({
      toBotId: row.to_bot_id,
      domains: row.domains ?? [],
      delegationType: row.delegation_type ?? undefined,
      method: row.method ?? undefined,
      channel: row.channel ?? undefined,
      priority: row.priority ?? undefined,
    }));
}

export function buildAgentSpec(input: BuildAgentSpecInput): AgentSpec {
  const { frontmatter, body } = stripMarkdownFrontmatter(input.agent.content);
  const metadata = { ...(input.agent.metadata ?? {}) };
  const profile = input.profile ?? 'team';
  const defaultModelPolicy = profile === 'personal' ? PERSONAL_MODEL_POLICY : TEAM_MODEL_POLICY;
  const modelPolicy = {
    ...defaultModelPolicy,
    ...(input.modelPolicy ?? {}),
    fallbacks: input.modelPolicy?.fallbacks ?? defaultModelPolicy.fallbacks,
  };
  const runtimeHints =
    profile === 'personal' ? (['ollama-cli', 'os-shell'] as const) : DEFAULT_RUNTIME_HINTS;
  const frontmatterTools = stringArray(frontmatter.tools);
  const defaultTools = profile === 'personal' ? PERSONAL_DEFAULT_TOOLS : TEAM_DEFAULT_TOOLS;

  return {
    botId: input.agent.name,
    displayName: displayName(input, frontmatter),
    emoji:
      input.botStatus?.slack_icon_emoji ??
      input.botStatus?.emoji ??
      (typeof metadata.emoji === 'string' ? metadata.emoji : undefined),
    role:
      input.botStatus?.role ??
      (typeof metadata.role === 'string' ? metadata.role : undefined) ??
      (typeof frontmatter.description === 'string' ? frontmatter.description : undefined) ??
      input.agent.name,
    profile,
    derivedFrom:
      input.botStatus?.derived_from ??
      (typeof metadata.derived_from === 'string' ? metadata.derived_from : undefined),
    replyAs:
      input.botStatus?.reply_as ??
      (typeof metadata.reply_as === 'string' ? metadata.reply_as : undefined),
    personaPrompt: body,
    kbDomains: input.botStatus?.kb_domains ?? stringArray(metadata.kb_domains),
    delegations: normalizeDelegations(input.delegations),
    runtimeHints: [...runtimeHints],
    projectionTargets: projectionTargetsForProfile(profile, [...runtimeHints]),
    isHelper: input.botStatus?.is_helper ?? undefined,
    skipProjectionTargets: projectionTargetArray(
      input.botStatus?.skip_projection_targets ?? metadata.skip_projection_targets,
    ),
    modelPolicy,
    toolPolicy: {
      tools: frontmatterTools.length > 0 ? frontmatterTools : defaultTools,
      permissionMode: profile === 'team' ? 'bypass' : 'workspace-write',
    },
    metadata,
  };
}

function projectionTargetsForProfile(
  profile: AgentProfile,
  runtimeHints: string[],
): AgentProjectionChannel[] {
  if (profile === 'personal') return ['local-cli'];
  const targets: AgentProjectionChannel[] = ['local-cli'];
  if (runtimeHints.includes('openclaw') || runtimeHints.includes('claude-code')) {
    targets.push('slack', 'discord');
  }
  return [...targets, 'codex-skill'];
}
