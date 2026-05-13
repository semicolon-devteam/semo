import type { AgentSpec } from './types.js';

/**
 * Runtime-specific AgentSpec loader boundary.
 *
 * This interface is intentionally dependency-free. Team loaders may use pg in
 * packages/cli, Personal loaders may use SQLite/KbStore elsewhere, but common
 * agents code must stay storage-agnostic so solo bundles do not pull Team deps.
 */
export interface AgentLoader {
  listBotIds(): Promise<string[]>;
  loadSpec(botId: string): Promise<AgentSpec>;
}
