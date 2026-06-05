/**
 * semo agent-factory — 포터블 봇 CRUD.
 *
 * Team(PG)은 기존 `semo bots factory` 가 계속 담당한다(PG schema/view 의존).
 * Solo(SQLite) 에서는 이 명령을 통해 KbStore + OperationalStore 만으로 봇을 CRUD.
 *
 * 저장 구조 (KbStore):
 *   - `{botId}` / `identity` — role, emoji, slack-username (frontmatter)
 *   - `{botId}` / `delegation/{toBotId}` — 위임 설정 (JSON in content)
 *   - `{botId}` / `status` — active/retired/online + timestamp
 *   - `{botId}` / `template` — 템플릿 봇 ID (있으면)
 *
 * 시트는 OperationalStore.allocateSeat 이 담당.
 *
 * 하위 명령:
 *   create --id <botId> --role <role> [--template <botId>] [--delegations <json>]
 *   delete --id <botId> [--force]
 *   show   --id <botId>
 *   list
 */
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { loadProfile } from '../config';
import { openStores, type StoreHandle } from '../config/store-factory.js';
import type { KbStore } from '@team-semicolon/semo-kb-core';
import {
  closeConnection,
  getAgents,
  getAgentByName,
  getBotStatusProjection,
  getDelegations,
  getPool,
  isDbConnected,
} from '../database';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

interface Delegation {
  to_bot_id: string;
  domains: string[];
  delegation_type?: string;
  method?: string;
  priority?: number;
}

type AgentRendererTarget = 'claude-code' | 'codex-skill' | 'openclaw';

interface LastRenderedManifest {
  version: 1;
  artifactPath: string;
  renderedSha256: string;
  renderedAt: string;
}

interface ProjectionDiffRow {
  botId: string;
  path: string;
  status: 'different' | 'missing-in-legacy' | 'missing-in-renderer';
  allowed: boolean;
  legacySha256?: string;
  rendererSha256?: string;
}

type JsonObject = Record<string, unknown>;

const OPENCLAW_RUNTIME_TOP_LEVEL_KEYS = new Set([
  'agents',
  'channels',
  'commands',
  'gateway',
  'hooks',
  'messages',
  'meta',
  'models',
  'plugins',
  'tools',
  'ui',
]);

export interface CreateInput {
  botId: string;
  role: string;
  templateBotId?: string;
  delegations: Delegation[];
  kbDomains: string[];
  slackUsername?: string;
  slackIconEmoji?: string;
  dryRun: boolean;
}

const TEMPLATE_SEED_KEYS = [
  'identity',
  'delegation',
  'model-config',
  'status',
  'slack-profile',
  'cron-schedule',
  'tools',
  'skills',
  'kb-access',
];

async function copyTemplateSeeds(
  kb: KbStore,
  templateBotId: string,
  newBotId: string,
): Promise<number> {
  let copied = 0;
  for (const key of TEMPLATE_SEED_KEYS) {
    const source = await kb.get(templateBotId, key);
    if (!source) continue;
    await kb.upsert({
      domain: newBotId,
      key,
      content: source.content,
      metadata: { ...(source.metadata ?? {}), copied_from: templateBotId },
      createdBy: 'agent-factory',
    });
    copied += 1;
  }
  return copied;
}

export async function createBot(stores: StoreHandle, input: CreateInput): Promise<void> {
  if (input.dryRun) {
    console.log(chalk.yellow('🧪 DRY-RUN — 다음 작업을 수행 예정:'));
    console.log(JSON.stringify(input, null, 2));
    return;
  }

  const existing = await stores.kb.get(input.botId, 'identity');
  if (existing) {
    throw new Error(`봇 "${input.botId}" 이미 존재. show 로 상태 확인 후 retire/delete.`);
  }

  const seat = await stores.ops.allocateSeat(input.botId);
  if (!seat) {
    throw new Error('가용 seat 없음. `semo seats add` 로 시트 확보 또는 retire.');
  }

  await stores.kb.upsert({
    domain: input.botId,
    key: 'identity',
    content: JSON.stringify(
      {
        role: input.role,
        slack_username: input.slackUsername ?? input.botId,
        slack_icon: input.slackIconEmoji ?? ':robot_face:',
        kb_domains: input.kbDomains,
      },
      null,
      2,
    ),
    metadata: {
      seat_id: seat.id,
      seat_key: seat.seatKey,
      template_bot_id: input.templateBotId ?? null,
    },
    createdBy: 'agent-factory',
  });

  await stores.kb.upsert({
    domain: input.botId,
    key: 'status',
    content: 'online',
    metadata: { transitioned_at: new Date().toISOString() },
    createdBy: 'agent-factory',
  });

  for (const d of input.delegations) {
    await stores.kb.upsert({
      domain: input.botId,
      key: 'delegation',
      subKey: d.to_bot_id,
      content: JSON.stringify(
        {
          delegation_type: d.delegation_type ?? 'routing',
          domains: d.domains,
          method: d.method ?? 'slack',
          priority: d.priority ?? 100,
        },
        null,
        2,
      ),
      createdBy: 'agent-factory',
    });
  }

  let copied = 0;
  if (input.templateBotId) {
    copied = await copyTemplateSeeds(stores.kb, input.templateBotId, input.botId);
  }

  console.log(
    chalk.green(
      `✓ 봇 "${input.botId}" 생성 완료 — seat=${seat.id}${copied > 0 ? ` (template 시드 ${copied}건)` : ''}`,
    ),
  );
}

async function deleteBot(stores: StoreHandle, botId: string, force: boolean): Promise<void> {
  const identity = await stores.kb.get(botId, 'identity');
  if (!identity) throw new Error(`봇 "${botId}" 없음`);

  if (force) {
    const seatId = identity.metadata?.seat_id;
    if (typeof seatId === 'string') {
      await stores.ops.releaseSeat(seatId).catch(() => undefined);
    }
    await stores.kb.delete({ domain: botId, key: 'identity' });
    await stores.kb.delete({ domain: botId, key: 'status' });
    for (const k of TEMPLATE_SEED_KEYS) {
      if (k === 'identity' || k === 'status') continue;
      await stores.kb.delete({ domain: botId, key: k }).catch(() => undefined);
    }
    console.log(chalk.yellow(`⚠ 봇 "${botId}" 강제 삭제 (cascade).`));
  } else {
    await stores.kb.upsert({
      domain: botId,
      key: 'status',
      content: 'retired',
      metadata: { transitioned_at: new Date().toISOString() },
      createdBy: 'agent-factory',
    });
    const seatId = identity.metadata?.seat_id;
    if (typeof seatId === 'string') {
      await stores.ops.releaseSeat(seatId).catch(() => undefined);
    }
    console.log(chalk.green(`✓ 봇 "${botId}" retire 완료 (seat 해제).`));
  }
}

async function showBot(stores: StoreHandle, botId: string): Promise<void> {
  const identity = await stores.kb.get(botId, 'identity');
  if (!identity) {
    console.log(chalk.yellow(`봇 "${botId}" 없음`));
    process.exitCode = 2;
    return;
  }
  const status = await stores.kb.get(botId, 'status');
  const delegations = await stores.kb.search('', {
    topK: 50,
    domain: botId,
  });

  console.log(chalk.cyan.bold(`\nBot: ${botId}\n`));
  console.log(chalk.white('identity:'));
  console.log(identity.content);
  console.log(chalk.gray(`  metadata: ${JSON.stringify(identity.metadata ?? {})}`));
  console.log(chalk.white(`\nstatus: ${status?.content ?? 'unknown'}`));

  const delegationEntries = delegations.filter((e) => e.key === 'delegation');
  if (delegationEntries.length > 0) {
    console.log(chalk.white('\nDelegations:'));
    for (const d of delegationEntries) {
      console.log(chalk.gray(`  → ${d.subKey}: ${d.content.replace(/\s+/g, ' ').slice(0, 80)}`));
    }
  }
}

function parseTargets(raw: string): AgentRendererTarget[] {
  const targets = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set(['claude-code', 'codex-skill', 'openclaw']);
  for (const target of targets) {
    if (!allowed.has(target)) {
      throw new Error(`unknown target "${target}" (allowed: ${[...allowed].join(', ')})`);
    }
  }
  return targets as AgentRendererTarget[];
}

function parseIds(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadCommonAgentsModule(): Promise<typeof import('@team-semicolon/semo-common')> {
  try {
    return await import('@team-semicolon/semo-common');
  } catch (err) {
    throw new Error(
      `@team-semicolon/semo-common 로드 실패 — optional 의존성입니다. 설치: npm i -g @team-semicolon/semo-common. 상세: ${
        (err as Error).message
      }`,
    );
  }
}

async function renderAgent(options: {
  botId: string;
  targets: AgentRendererTarget[];
  write: boolean;
  json: boolean;
  semoRoot?: string;
  sessionDir?: string;
  mailboxDir?: string;
  codexSkillsDir?: string;
  openclawHomeDir?: string;
  force?: boolean;
  quiet?: boolean;
}): Promise<{
  spec: unknown;
  artifacts: Array<{ path: string; content: string; target: string }>;
}> {
  const { spec, artifacts } = await loadRenderedAgent(options);

  if (options.quiet) {
    // no-op
  } else if (options.json) {
    console.log(JSON.stringify({ spec, artifacts }, null, 2));
  } else {
    const botId =
      typeof spec === 'object' && spec && 'botId' in spec ? String(spec.botId) : options.botId;
    console.log(chalk.cyan(`AgentSpec: ${botId} → ${options.targets.join(', ')}`));
    for (const artifact of artifacts) {
      console.log(`${options.write ? 'write' : 'render'} ${artifact.target} ${artifact.path}`);
    }
  }

  if (options.write) {
    for (const artifact of artifacts) {
      writeArtifactSafely(artifact.path, artifact.content, { force: !!options.force });
    }
  }

  return { spec, artifacts };
}

function backupPath(filePath: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  return `${filePath}.bak-${stamp}`;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function manifestPath(filePath: string): string {
  return `${filePath}.agent-spec-last-rendered.json`;
}

function readLastRenderedManifest(filePath: string): LastRenderedManifest | null {
  const file = manifestPath(filePath);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as LastRenderedManifest;
  } catch {
    return null;
  }
}

function writeLastRenderedManifest(filePath: string, content: string): void {
  const file = manifestPath(filePath);
  const manifest: LastRenderedManifest = {
    version: 1,
    artifactPath: filePath,
    renderedSha256: sha256(content),
    renderedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeArtifactSafely(filePath: string, content: string, options: { force: boolean }): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    writeLastRenderedManifest(filePath, content);
    return;
  }

  const current = fs.readFileSync(filePath, 'utf8');
  if (current === content) {
    writeLastRenderedManifest(filePath, content);
    return;
  }

  const currentSha = sha256(current);
  const renderedSha = sha256(content);
  const previous = readLastRenderedManifest(filePath);
  const onlyGeneratedContentChanged = previous?.renderedSha256 === currentSha;
  if (onlyGeneratedContentChanged) {
    fs.writeFileSync(filePath, content);
    writeLastRenderedManifest(filePath, content);
    return;
  }

  if (!options.force) {
    throw new Error(
      `projection drift: ${filePath} differs from rendered AgentSpec output. ` +
        `current=${currentSha.slice(0, 12)} rendered=${renderedSha.slice(0, 12)}. ` +
        `Run doctor, inspect diff, then rerun with --force to backup and overwrite.`,
    );
  }

  const bak = backupPath(filePath);
  fs.copyFileSync(filePath, bak);
  fs.writeFileSync(filePath, content);
  writeLastRenderedManifest(filePath, content);
  console.log(chalk.yellow(`backup ${bak}`));
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMergeJson(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out: JsonObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = key in out ? deepMergeJson(out[key], value) : value;
  }
  return out;
}

function assertOpenClawPatchIsSafe(patch: unknown): void {
  if (!isPlainObject(patch)) throw new Error('OpenClaw patch must be a JSON object');
  const forbidden = ['auth', 'authProfiles', 'credentials'];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      throw new Error(`OpenClaw patch must not modify ${key}`);
    }
  }
}

function filterOpenClawRuntimePatch(patch: unknown): {
  runtimePatch: JsonObject;
  skippedTopLevelKeys: string[];
} {
  assertOpenClawPatchIsSafe(patch);
  const runtimePatch: JsonObject = {};
  const skippedTopLevelKeys: string[] = [];

  for (const [key, value] of Object.entries(patch as JsonObject)) {
    if (OPENCLAW_RUNTIME_TOP_LEVEL_KEYS.has(key)) {
      runtimePatch[key] = value;
    } else {
      skippedTopLevelKeys.push(key);
    }
  }

  return { runtimePatch, skippedTopLevelKeys };
}

function runLaunchctl(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync('launchctl', args, { encoding: 'utf8' });
}

function probeOpenClawRuntime(botId: string): void {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (uid === null) {
    throw new Error('OpenClaw startup probe requires a uid-capable host');
  }

  const label = `gui/${uid}/ai.openclaw.${botId}`;
  const kick = runLaunchctl(['kickstart', '-k', label]);
  if (kick.status !== 0) {
    throw new Error(
      `OpenClaw startup probe failed to kickstart ${label}: ${kick.stderr || kick.stdout}`,
    );
  }

  spawnSync('sleep', ['5']);

  const printed = runLaunchctl(['print', label]);
  if (printed.status !== 0) {
    throw new Error(
      `OpenClaw startup probe failed to inspect ${label}: ${printed.stderr || printed.stdout}`,
    );
  }

  const text = `${printed.stdout}\n${printed.stderr}`;
  const state = text.match(/^\s*state = (.+)$/m)?.[1]?.trim();
  const pid = text.match(/^\s*pid = (\d+)$/m)?.[1];
  const lastExit = text.match(/^\s*last exit code = (.+)$/m)?.[1]?.trim();
  const hasBadExit = lastExit != null && !['0', '(never exited)'].includes(lastExit);

  if (state !== 'running' || !pid || hasBadExit) {
    throw new Error(
      `OpenClaw startup probe failed for ${botId}: state=${state ?? 'unknown'} pid=${
        pid ?? 'none'
      } lastExit=${lastExit ?? 'unknown'}`,
    );
  }
}

async function applyOpenClawConfig(options: {
  botId: string;
  semoRoot?: string;
  openclawHomeDir?: string;
  dryRun: boolean;
  json: boolean;
  probe: boolean;
}): Promise<void> {
  const { spec, artifacts } = await loadRenderedAgent({
    botId: options.botId,
    targets: ['openclaw'],
    semoRoot: options.semoRoot,
    openclawHomeDir: options.openclawHomeDir,
  });
  const patchArtifact = artifacts.find((artifact) => artifact.target === 'openclaw');
  if (!patchArtifact) {
    throw new Error(`OpenClaw projection skipped for ${options.botId}`);
  }
  const sidecarArtifacts = artifacts.filter(
    (artifact) => artifact.target === 'openclaw' && artifact.path !== patchArtifact.path,
  );

  const patch = JSON.parse(patchArtifact.content) as unknown;
  const { runtimePatch, skippedTopLevelKeys } = filterOpenClawRuntimePatch(patch);

  const configPath = path.join(path.dirname(patchArtifact.path), 'openclaw.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`OpenClaw config not found: ${configPath}`);
  }

  const currentText = fs.readFileSync(configPath, 'utf8');
  const current = JSON.parse(currentText) as unknown;
  const next = deepMergeJson(current, runtimePatch);
  const nextText = `${JSON.stringify(next, null, 2)}\n`;
  const result = {
    botId: options.botId,
    configPath,
    patchPath: patchArtifact.path,
    changed: currentText !== nextText,
    currentSha256: sha256(currentText),
    nextSha256: sha256(nextText),
    skippedTopLevelKeys,
    spec,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.cyan(`OpenClaw apply: ${options.botId}`));
    console.log(`config ${configPath}`);
    console.log(`patch  ${patchArtifact.path}`);
    if (skippedTopLevelKeys.length > 0) {
      console.log(chalk.yellow(`skipped runtime keys: ${skippedTopLevelKeys.join(', ')}`));
    }
    console.log(result.changed ? chalk.yellow('status changed') : chalk.green('status in-sync'));
  }

  if (options.dryRun) return;

  fs.writeFileSync(patchArtifact.path, patchArtifact.content);
  for (const artifact of sidecarArtifacts) {
    fs.writeFileSync(artifact.path, artifact.content);
  }

  if (!result.changed) {
    if (options.probe) {
      probeOpenClawRuntime(options.botId);
      console.log(chalk.green(`startup probe ok: ${options.botId}`));
    }
    return;
  }

  const bak = backupPath(configPath);
  fs.copyFileSync(configPath, bak);
  fs.writeFileSync(configPath, nextText, { mode: fs.statSync(configPath).mode });
  console.log(chalk.yellow(`backup ${bak}`));

  if (options.probe) {
    try {
      probeOpenClawRuntime(options.botId);
      console.log(chalk.green(`startup probe ok: ${options.botId}`));
    } catch (err) {
      fs.copyFileSync(bak, configPath);
      throw new Error(
        `startup probe failed; rolled back ${configPath} from ${bak}. ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
}

async function loadRenderedAgent(options: {
  botId: string;
  targets: AgentRendererTarget[];
  semoRoot?: string;
  sessionDir?: string;
  mailboxDir?: string;
  codexSkillsDir?: string;
  openclawHomeDir?: string;
}): Promise<{
  spec: unknown;
  artifacts: Array<{ path: string; content: string; target: string }>;
}> {
  const connected = await isDbConnected();
  if (!connected) {
    throw new Error(
      'Team DB 연결 실패. 현재 render는 agent_definitions/bot_status 기반 Team projection만 지원합니다.',
    );
  }

  const [botStatus, delegations, common] = await Promise.all([
    getBotStatusProjection(options.botId),
    getDelegations(options.botId),
    loadCommonAgentsModule(),
  ]);
  const sourceBotId = botStatus?.derived_from ?? options.botId;
  const agent = await getAgentByName(sourceBotId);

  if (!agent) {
    throw new Error(`agent_definitions 에 "${sourceBotId}" 없음`);
  }

  const legacyAgentPath = path.join(
    os.homedir(),
    '.claude',
    'agents',
    sourceBotId,
    `${sourceBotId}.md`,
  );
  const usesLegacyAgentFile = fs.existsSync(legacyAgentPath);
  const agentContent = usesLegacyAgentFile
    ? fs.readFileSync(legacyAgentPath, 'utf8')
    : agent.content;
  const botStatusForSpec =
    usesLegacyAgentFile && botStatus ? { ...botStatus, role: undefined } : botStatus;

  const spec = common.buildAgentSpec({
    agent: {
      name: options.botId,
      displayName: agent.display_name,
      content: agentContent,
      metadata: agent.metadata,
    },
    botStatus: botStatusForSpec,
    delegations: delegations.map((d) => ({
      ...d,
      priority: typeof d.priority === 'string' ? Number(d.priority) : d.priority,
    })),
  });

  const artifacts = common.renderAgentSpec(spec, options.targets, {
    semoRoot: options.semoRoot ?? process.cwd(),
    sessionDir: options.sessionDir ?? path.join(os.homedir(), '.semo', 'sessions'),
    mailboxDir: options.mailboxDir ?? path.join(os.homedir(), '.semo', 'mailbox'),
    codexSkillsDir: options.codexSkillsDir ?? path.join(os.homedir(), '.codex', 'skills'),
    openclawHomeDir: options.openclawHomeDir ?? os.homedir(),
  });
  return { spec, artifacts };
}

async function syncAgents(options: {
  ids?: string;
  targets: AgentRendererTarget[];
  semoRoot?: string;
  sessionDir?: string;
  mailboxDir?: string;
  codexSkillsDir?: string;
  openclawHomeDir?: string;
  dryRun: boolean;
  force: boolean;
}): Promise<void> {
  const connected = await isDbConnected();
  if (!connected) {
    throw new Error(
      'Team DB 연결 실패. 현재 sync는 agent_definitions/bot_status 기반 Team projection만 지원합니다.',
    );
  }

  const ids = options.ids
    ? options.ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : (await getAgents()).map((a) => a.name);

  for (const botId of ids) {
    await renderAgent({
      botId,
      targets: options.targets,
      write: !options.dryRun,
      json: false,
      semoRoot: options.semoRoot,
      sessionDir: options.sessionDir,
      mailboxDir: options.mailboxDir,
      codexSkillsDir: options.codexSkillsDir,
      openclawHomeDir: options.openclawHomeDir,
      force: options.force,
    });
  }
}

function listFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.endsWith('.agent-spec-last-rendered.json')) continue;
      files.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(root);
  return files.sort();
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

async function loadAllowedProjectionDiffs(): Promise<string[]> {
  if (!(await isDbConnected())) return [];
  const result = await getPool().query(
    `SELECT content, metadata
       FROM ${DB_SCHEMA}.knowledge_base
      WHERE domain = 'semicolony'
        AND key = 'process'
        AND sub_key = 'agent-spec-projection-allowed-diffs'
      LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return [];

  const allowed = new Set<string>();
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) add(item);
      return;
    }
    if (typeof value === 'string' && value.trim()) allowed.add(value.trim());
  };

  try {
    add(JSON.parse(row.content));
  } catch {
    add(
      String(row.content)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#')),
    );
  }
  add(row.metadata?.allowed_diffs);
  return [...allowed];
}

function isAllowedDiff(
  row: Omit<ProjectionDiffRow, 'allowed'>,
  allowedPatterns: string[],
): boolean {
  const candidates = [
    row.path,
    `${row.botId}/${row.path}`,
    `${row.status}:${row.path}`,
    `${row.status}:${row.botId}/${row.path}`,
  ];
  return allowedPatterns.some((pattern) =>
    candidates.some((candidate) => wildcardMatch(pattern, candidate)),
  );
}

async function diffAgents(options: {
  ids: string;
  legacyScript: string;
  semoRoot?: string;
  sessionDir?: string;
  mailboxDir?: string;
  json: boolean;
  keepTmp: boolean;
}): Promise<void> {
  const ids = parseIds(options.ids);
  if (ids.length === 0) throw new Error('--ids must include at least one bot id');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-agent-factory-diff-'));
  const legacyRoot = path.join(tmpRoot, 'legacy');
  const rendererRoot = path.join(tmpRoot, 'renderer');
  const sharedMailboxDir = path.join(tmpRoot, 'mailbox');
  const legacySessionDir = path.join(legacyRoot, 'sessions');
  const rendererSessionDir = path.join(rendererRoot, 'sessions');
  fs.mkdirSync(legacySessionDir, { recursive: true });
  fs.mkdirSync(rendererSessionDir, { recursive: true });
  fs.mkdirSync(sharedMailboxDir, { recursive: true });

  const legacyScript = path.resolve(options.legacyScript);
  const legacy = spawnSync(
    process.execPath,
    [legacyScript, '--all', '--session-dir', legacySessionDir, '--mailbox-dir', sharedMailboxDir],
    {
      cwd: options.semoRoot ?? process.cwd(),
      encoding: 'utf8',
      env: process.env,
    },
  );
  if (legacy.status !== 0) {
    throw new Error(
      `legacy generation failed (${legacy.status ?? 'signal'}): ${legacy.stderr || legacy.stdout}`,
    );
  }

  for (const botId of ids) {
    await renderAgent({
      botId,
      targets: ['claude-code'],
      write: true,
      json: false,
      semoRoot: options.semoRoot,
      sessionDir: rendererSessionDir,
      mailboxDir: sharedMailboxDir,
      force: true,
      quiet: true,
    });
  }

  const allowedPatterns = await loadAllowedProjectionDiffs();
  const rows: ProjectionDiffRow[] = [];

  for (const botId of ids) {
    const legacyBotRoot = path.join(legacySessionDir, botId);
    const rendererBotRoot = path.join(rendererSessionDir, botId);
    const files = new Set([...listFiles(legacyBotRoot), ...listFiles(rendererBotRoot)]);
    for (const relativePath of [...files].sort()) {
      const legacyPath = path.join(legacyBotRoot, relativePath);
      const rendererPath = path.join(rendererBotRoot, relativePath);
      const legacyExists = fs.existsSync(legacyPath);
      const rendererExists = fs.existsSync(rendererPath);
      let row: Omit<ProjectionDiffRow, 'allowed'> | null = null;
      if (!legacyExists) {
        row = { botId, path: relativePath, status: 'missing-in-legacy' };
      } else if (!rendererExists) {
        row = { botId, path: relativePath, status: 'missing-in-renderer' };
      } else {
        const legacyContent = fs.readFileSync(legacyPath);
        const rendererContent = fs.readFileSync(rendererPath);
        if (!legacyContent.equals(rendererContent)) {
          row = {
            botId,
            path: relativePath,
            status: 'different',
            legacySha256: sha256(legacyContent.toString('utf8')),
            rendererSha256: sha256(rendererContent.toString('utf8')),
          };
        }
      }
      if (row) rows.push({ ...row, allowed: isAllowedDiff(row, allowedPatterns) });
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ tmpRoot, allowedPatterns, diffs: rows }, null, 2));
  } else {
    console.log(chalk.cyan(`legacy:  ${legacySessionDir}`));
    console.log(chalk.cyan(`renderer: ${rendererSessionDir}`));
    if (rows.length === 0) {
      console.log(chalk.green('byte-equal: legacy and AgentSpec renderer outputs match'));
    } else {
      for (const row of rows) {
        const color = row.allowed ? chalk.yellow : chalk.red;
        const hashes =
          row.legacySha256 && row.rendererSha256
            ? ` legacy=${row.legacySha256.slice(0, 12)} renderer=${row.rendererSha256.slice(0, 12)}`
            : '';
        console.log(
          `${color(row.allowed ? 'allowed' : 'regress')} ${row.status.padEnd(19)} ${row.botId}/${row.path}${hashes}`,
        );
      }
    }
  }

  if (!options.keepTmp) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } else {
    console.log(chalk.gray(`kept tmpdir: ${tmpRoot}`));
  }

  if (rows.length === 0) return;
  process.exitCode = rows.every((row) => row.allowed) ? 1 : 2;
}

async function doctorAgents(options: {
  ids?: string;
  targets: AgentRendererTarget[];
  semoRoot?: string;
  sessionDir?: string;
  mailboxDir?: string;
  codexSkillsDir?: string;
  openclawHomeDir?: string;
  json: boolean;
}): Promise<void> {
  const ids = options.ids
    ? options.ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : (await getAgents()).map((a) => a.name);
  const rows: Array<{ botId: string; target: string; path: string; status: string }> = [];

  for (const botId of ids) {
    const { artifacts } = await loadRenderedAgent({
      botId,
      targets: options.targets,
      semoRoot: options.semoRoot,
      sessionDir: options.sessionDir,
      mailboxDir: options.mailboxDir,
      codexSkillsDir: options.codexSkillsDir,
      openclawHomeDir: options.openclawHomeDir,
    });
    for (const artifact of artifacts) {
      let status = 'missing';
      if (fs.existsSync(artifact.path)) {
        const current = fs.readFileSync(artifact.path, 'utf8');
        if (current === artifact.content) {
          status = 'in-sync';
        } else {
          const previous = readLastRenderedManifest(artifact.path);
          status = previous?.renderedSha256 === sha256(current) ? 'stale-generated' : 'drift';
        }
      }
      rows.push({ botId, target: artifact.target, path: artifact.path, status });
    }
  }

  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  for (const row of rows) {
    const color =
      row.status === 'in-sync'
        ? chalk.green
        : row.status === 'stale-generated'
          ? chalk.cyan
          : row.status === 'missing'
            ? chalk.yellow
            : chalk.red;
    console.log(`${color(row.status.padEnd(8))} ${row.botId} ${row.target} ${row.path}`);
  }
  if (rows.some((r) => r.status === 'drift')) process.exitCode = 2;
}

export function registerAgentFactoryCommands(program: Command): void {
  const cmd = program
    .command('agent-factory')
    .description('포터블 봇 CRUD (KbStore + OperationalStore, Solo/Team 양쪽 동작)');

  cmd
    .command('create')
    .description('신규 봇 생성')
    .requiredOption('--id <botId>', '봇 ID (불변)')
    .requiredOption('--role <role>', '역할')
    .option('--template <botId>', '복사 베이스')
    .option('--delegations <json>', 'JSON 배열', '[]')
    .option('--kb-domains <csv>', '쉼표구분', 'semicolon')
    .option('--slack-username <name>', 'Slack 표시명')
    .option('--slack-icon <emoji>', 'Slack 아이콘')
    .option('--dry-run', '계획만 출력')
    .action(async (options) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        const input: CreateInput = {
          botId: options.id,
          role: options.role,
          templateBotId: options.template,
          delegations: JSON.parse(options.delegations),
          kbDomains: options.kbDomains.split(',').map((s: string) => s.trim()),
          slackUsername: options.slackUsername,
          slackIconEmoji: options.slackIcon,
          dryRun: !!options.dryRun,
        };
        await createBot(stores, input);
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('delete')
    .description('봇 삭제 (기본 retire; --force 로 완전 삭제)')
    .requiredOption('--id <botId>', '봇 ID')
    .option('--force', 'cascade 삭제')
    .action(async (options) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        await deleteBot(stores, options.id, !!options.force);
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('show')
    .description('봇 상태 + delegation 조회')
    .requiredOption('--id <botId>', '봇 ID')
    .action(async (options) => {
      const cfg = loadProfile();
      const stores = await openStores(cfg);
      try {
        await showBot(stores, options.id);
      } finally {
        await stores.close();
      }
    });

  cmd
    .command('render')
    .description('Team AgentSpec 렌더링 (ClaudeCode/Codex/OpenClaw artifacts)')
    .requiredOption('--id <botId>', '봇 ID')
    .option(
      '--targets <csv>',
      'claude-code,codex-skill,openclaw',
      'claude-code,codex-skill,openclaw',
    )
    .option('--semo-root <path>', 'SEMO repo root')
    .option('--session-dir <path>', 'ClaudeCode session dir')
    .option('--mailbox-dir <path>', 'SEMO mailbox dir')
    .option('--codex-skills-dir <path>', 'Codex skills dir')
    .option('--openclaw-home-dir <path>', 'OpenClaw profile parent dir')
    .option('--write', 'artifact 파일 쓰기')
    .option('--force', 'drift 파일을 백업 후 덮어쓰기')
    .option('--json', 'spec + artifacts JSON 출력')
    .action(async (options) => {
      try {
        await renderAgent({
          botId: options.id,
          targets: parseTargets(options.targets),
          write: !!options.write,
          json: !!options.json,
          semoRoot: options.semoRoot,
          sessionDir: options.sessionDir,
          mailboxDir: options.mailboxDir,
          codexSkillsDir: options.codexSkillsDir,
          openclawHomeDir: options.openclawHomeDir,
          force: !!options.force,
        });
      } catch (err) {
        console.error(chalk.red(`render 실패: ${err instanceof Error ? err.message : err}`));
        process.exitCode = 1;
      } finally {
        await closeConnection();
      }
    });

  cmd
    .command('sync')
    .description('여러 AgentSpec projection artifact 동기화')
    .option('--ids <csv>', '봇 ID 목록. 생략하면 agent_definitions 전체')
    .option(
      '--targets <csv>',
      'claude-code,openclaw 기본. codex-skill은 Codex 설치 환경에서 명시 opt-in',
      'claude-code,openclaw',
    )
    .option('--semo-root <path>', 'SEMO repo root')
    .option('--session-dir <path>', 'ClaudeCode session dir')
    .option('--mailbox-dir <path>', 'SEMO mailbox dir')
    .option('--codex-skills-dir <path>', 'Codex skills dir')
    .option('--openclaw-home-dir <path>', 'OpenClaw profile parent dir')
    .option('--dry-run', '파일 쓰지 않고 계획만 출력')
    .option('--force', 'drift 파일을 백업 후 덮어쓰기')
    .action(async (options) => {
      try {
        await syncAgents({
          ids: options.ids,
          targets: parseTargets(options.targets),
          semoRoot: options.semoRoot,
          sessionDir: options.sessionDir,
          mailboxDir: options.mailboxDir,
          codexSkillsDir: options.codexSkillsDir,
          openclawHomeDir: options.openclawHomeDir,
          dryRun: !!options.dryRun,
          force: !!options.force,
        });
      } catch (err) {
        console.error(chalk.red(`sync 실패: ${err instanceof Error ? err.message : err}`));
        process.exitCode = 1;
      } finally {
        await closeConnection();
      }
    });

  cmd
    .command('diff')
    .description('legacy generate-bot-env 출력과 AgentSpec renderer 출력 byte diff')
    .requiredOption('--ids <csv>', '비교할 봇 ID 목록')
    .option('--legacy-script <path>', 'legacy generator script', 'scripts/generate-bot-env.js')
    .option('--semo-root <path>', 'SEMO repo root')
    .option('--json', 'JSON 출력')
    .option('--keep-tmp', 'diff tmpdir 삭제하지 않기')
    .action(async (options) => {
      try {
        await diffAgents({
          ids: options.ids,
          legacyScript: options.legacyScript,
          semoRoot: options.semoRoot,
          json: !!options.json,
          keepTmp: !!options.keepTmp,
        });
      } catch (err) {
        console.error(chalk.red(`diff 실패: ${err instanceof Error ? err.message : err}`));
        process.exitCode = 2;
      } finally {
        await closeConnection();
      }
    });

  cmd
    .command('openclaw-apply')
    .description('AgentSpec OpenClaw patch를 실제 openclaw.json에 deep-merge 적용')
    .requiredOption('--id <botId>', '봇 ID')
    .option('--semo-root <path>', 'SEMO repo root')
    .option('--openclaw-home-dir <path>', 'OpenClaw profile parent dir')
    .option('--dry-run', '파일 쓰지 않고 적용 결과만 출력')
    .option('--no-probe', '적용 후 launchctl startup probe 건너뛰기')
    .option('--json', 'JSON 출력')
    .action(async (options) => {
      try {
        await applyOpenClawConfig({
          botId: options.id,
          semoRoot: options.semoRoot,
          openclawHomeDir: options.openclawHomeDir,
          dryRun: !!options.dryRun,
          json: !!options.json,
          probe: options.probe !== false,
        });
      } catch (err) {
        console.error(
          chalk.red(`openclaw-apply 실패: ${err instanceof Error ? err.message : err}`),
        );
        process.exitCode = 1;
      } finally {
        await closeConnection();
      }
    });

  cmd
    .command('doctor')
    .description('AgentSpec projection drift 검사 (파일 쓰기 없음)')
    .option('--ids <csv>', '봇 ID 목록. 생략하면 agent_definitions 전체')
    .option('--targets <csv>', 'claude-code,openclaw 기본', 'claude-code,openclaw')
    .option('--semo-root <path>', 'SEMO repo root')
    .option('--session-dir <path>', 'ClaudeCode session dir')
    .option('--mailbox-dir <path>', 'SEMO mailbox dir')
    .option('--codex-skills-dir <path>', 'Codex skills dir')
    .option('--openclaw-home-dir <path>', 'OpenClaw profile parent dir')
    .option('--json', 'JSON 출력')
    .action(async (options) => {
      try {
        await doctorAgents({
          ids: options.ids,
          targets: parseTargets(options.targets),
          semoRoot: options.semoRoot,
          sessionDir: options.sessionDir,
          mailboxDir: options.mailboxDir,
          codexSkillsDir: options.codexSkillsDir,
          openclawHomeDir: options.openclawHomeDir,
          json: !!options.json,
        });
      } catch (err) {
        console.error(chalk.red(`doctor 실패: ${err instanceof Error ? err.message : err}`));
        process.exitCode = 1;
      } finally {
        await closeConnection();
      }
    });
}
