import type { HostKind } from '../runtime/host-adapter.js';

export type AgentRuntimeProjectionTarget = 'claude-code' | 'codex-skill' | 'openclaw';
export type AgentProfile = 'team' | 'personal';

export type AgentProjectionChannel = 'slack' | 'discord' | 'github' | 'local-cli' | 'codex-skill';

export interface AgentDelegationSpec {
  toBotId: string;
  domains: string[];
  delegationType?: string;
  method?: string;
  channel?: string;
  priority?: number;
  reason?: string;
}

export interface AgentModelPolicy {
  primary: string;
  fallbacks: string[];
  forbiddenProviders?: string[];
}

export interface AgentToolPolicy {
  tools: string[];
  mcpServers?: string[];
  permissionMode?: 'ask' | 'workspace-write' | 'bypass';
}

export interface AgentSpec {
  botId: string;
  displayName: string;
  emoji?: string;
  role: string;
  profile: AgentProfile;
  derivedFrom?: string;
  replyAs?: string;
  personaPrompt: string;
  kbDomains: string[];
  delegations: AgentDelegationSpec[];
  runtimeHints: HostKind[];
  projectionTargets: AgentProjectionChannel[];
  isHelper?: boolean;
  skipProjectionTargets?: AgentRuntimeProjectionTarget[];
  modelPolicy: AgentModelPolicy;
  toolPolicy: AgentToolPolicy;
  metadata?: Record<string, unknown>;
}

export interface RenderContext {
  profile?: AgentProfile;
  semoRoot?: string;
  sessionDir?: string;
  mailboxDir?: string;
  codexSkillsDir?: string;
  openclawHomeDir?: string;
}

export type RenderedAgentArtifactFormat = 'markdown' | 'json';

export interface RenderedAgentArtifact {
  target: AgentRuntimeProjectionTarget;
  path: string;
  format: RenderedAgentArtifactFormat;
  content: string;
}

export interface AgentRenderer {
  readonly target: AgentRuntimeProjectionTarget;
  render(spec: AgentSpec, context?: RenderContext): RenderedAgentArtifact[];
}
