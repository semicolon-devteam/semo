export type BotTeamBucket = 'runtime-service' | 'installed-agent' | 'legacy-agent';

export interface BotTeamRow {
  id: string;
  name?: string | null;
  status?: string | null;
  config?: Record<string, unknown> | null;
}

export interface BotTeamSplit<T extends BotTeamRow> {
  runtimeServices: T[];
  installedAgents: T[];
  legacyAgents: T[];
}

export const RUNTIME_SERVICE_BOT_IDS = new Set([
  'slack-router',
  'openclaw',
  'semobot',
  'cron-poller',
  'kb-sidekick',
  'incubator',
  'semiclaw-overflow',
]);

export const LEGACY_OPENCLAW_DEFAULT = [
  'semiclaw',
  'planclaw',
  'designclaw',
  'workclaw',
  'reviewclaw',
  'infraclaw',
  'growthclaw',
];

function hasString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function classifyBotRow(row: BotTeamRow): BotTeamBucket {
  const config = row.config ?? {};
  if (config.runtime_service === true || RUNTIME_SERVICE_BOT_IDS.has(row.id)) {
    return 'runtime-service';
  }
  if (hasString(config.install_id) || row.id.startsWith('ag-')) {
    return 'installed-agent';
  }
  return 'legacy-agent';
}

export function splitBotRowsForTeamDashboard<T extends BotTeamRow>(rows: T[]): BotTeamSplit<T> {
  const split: BotTeamSplit<T> = { runtimeServices: [], installedAgents: [], legacyAgents: [] };
  for (const row of rows) {
    const bucket = classifyBotRow(row);
    if (bucket === 'runtime-service') split.runtimeServices.push(row);
    else if (bucket === 'installed-agent') split.installedAgents.push(row);
    else split.legacyAgents.push(row);
  }
  return split;
}

export function openClawBotsFromRuntimeSourceMap(
  map: Record<string, string> | undefined,
): string[] {
  if (!map) return [...LEGACY_OPENCLAW_DEFAULT];
  return Object.entries(map)
    .filter(([, runtimeSource]) => runtimeSource === 'openclaw')
    .map(([botId]) => botId)
    .sort();
}
