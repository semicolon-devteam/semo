import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse as parseToml } from 'smol-toml';
import {
  CURRENT_CONFIG_SCHEMA_VERSION,
  SUPPORTED_CONFIG_SCHEMA_MAJOR,
  type SemoConfig,
  type ProfileName,
  type KbConfig,
  type OpsConfig,
  type MessagingConfig,
  type ExecutionConfig,
  type NetworkConfig,
  type EmbeddingConfig,
} from './types.js';

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.semo', 'config.toml');

function expand(p: string | undefined): string | undefined {
  if (!p) return p;
  if (p.startsWith('~/.semo/') || p === '~/.semo') {
    const semoRoot = process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
    const rest = p === '~/.semo' ? '' : p.slice('~/.semo/'.length);
    return rest ? path.join(semoRoot, rest) : semoRoot;
  }
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

const PROFILE_PRESETS: Record<
  ProfileName,
  Omit<SemoConfig, 'profile' | '_source' | '_warnings' | 'schema_version'>
> = {
  team: {
    kb: { driver: 'postgres' },
    ops: { driver: 'postgres' },
    messaging: { sources: ['slack', 'discord'] },
    execution: { target: 'claude-code', seat_strategy: 'pool' },
    network: { mode: 'lan' },
  },
  'solo-offline': {
    kb: { driver: 'sqlite', sqlite_path: '~/.semo/kb.db' },
    ops: { driver: 'sqlite', sqlite_path: '~/.semo/ops.db' },
    messaging: { sources: ['stdin'] },
    execution: { target: 'ollama', model: 'qwen2.5-coder:14b' },
    network: { mode: 'offline', listen: '127.0.0.1:3939' },
  },
  'solo-connected': {
    kb: { driver: 'sqlite', sqlite_path: '~/.semo/kb.db' },
    ops: { driver: 'sqlite', sqlite_path: '~/.semo/ops.db' },
    messaging: { sources: ['http', 'obsidian-file'] },
    execution: { target: 'anthropic-api', api_key_env: 'ANTHROPIC_API_KEY' },
    network: { mode: 'tailscale', listen: '0.0.0.0:3939' },
  },
  custom: {
    kb: { driver: 'sqlite' },
    ops: { driver: 'sqlite' },
    messaging: { sources: ['stdin'] },
    execution: { target: 'ollama' },
    network: { mode: 'offline' },
  },
};

/** 파일에서 raw TOML 읽어서 SemoConfig로 머지 */
function applyOverrides(
  preset: Omit<SemoConfig, 'profile' | '_source' | '_warnings' | 'schema_version'>,
  raw: Record<string, unknown>,
): Omit<SemoConfig, 'profile' | '_source' | '_warnings' | 'schema_version'> {
  const kb = { ...preset.kb, ...(raw.kb as Partial<KbConfig> | undefined) };
  const ops = { ...preset.ops, ...(raw.ops as Partial<OpsConfig> | undefined) };
  const messaging = {
    ...preset.messaging,
    ...(raw.messaging as Partial<MessagingConfig> | undefined),
  };
  const execution = {
    ...preset.execution,
    ...(raw.execution as Partial<ExecutionConfig> | undefined),
  };
  const network = { ...preset.network, ...(raw.network as Partial<NetworkConfig> | undefined) };
  const embedding = raw.embedding
    ? ({ ...(raw.embedding as Partial<EmbeddingConfig>) } as EmbeddingConfig)
    : undefined;

  kb.sqlite_path = expand(kb.sqlite_path);
  kb.obsidian_vault = expand(kb.obsidian_vault);
  ops.sqlite_path = expand(ops.sqlite_path);

  return { kb, ops, messaging, execution, network, embedding };
}

/**
 * raw.schema_version 을 해석해 [version, warnings] 반환.
 * - 누락/빈 문자열 → '1.0' 가정 (구 config 호환)
 * - major 버전이 SUPPORTED_CONFIG_SCHEMA_MAJOR 초과 → 경고 수집 (로드는 계속)
 */
function resolveSchemaVersion(raw: Record<string, unknown>): {
  version: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const declared = typeof raw.schema_version === 'string' ? raw.schema_version.trim() : '';
  if (!declared) {
    return { version: '1.0', warnings };
  }
  const major = parseInt(declared.split('.')[0] ?? '', 10);
  if (!Number.isFinite(major)) {
    warnings.push(
      `schema_version='${declared}' 파싱 실패, '${CURRENT_CONFIG_SCHEMA_VERSION}' 로 fallback`,
    );
    return { version: CURRENT_CONFIG_SCHEMA_VERSION, warnings };
  }
  if (major > SUPPORTED_CONFIG_SCHEMA_MAJOR) {
    warnings.push(
      `config schema_version='${declared}' 이 CLI(${CURRENT_CONFIG_SCHEMA_VERSION}) 보다 큽니다. 신규 필드 무시될 수 있음 — semo update 권장`,
    );
  }
  return { version: declared, warnings };
}

/**
 * config.toml 위치 결정 — OSS 격리 install 호환 (Codex 리뷰 2026-04-28).
 * 우선순위: 명시 인자 > SEMO_CONFIG_PATH > SEMO_HOME/config.toml > ~/.semo/config.toml
 */
export function resolveConfigPath(configPath?: string): string {
  if (configPath) return configPath;
  if (process.env.SEMO_CONFIG_PATH) return process.env.SEMO_CONFIG_PATH;
  const semoHome = process.env.SEMO_HOME;
  if (semoHome) return path.join(semoHome, 'config.toml');
  return DEFAULT_CONFIG_PATH;
}

/**
 * ~/.semo/config.toml 로드. 파일이 없으면 profile=team 기본값 반환.
 * SEMO_HOME / SEMO_CONFIG_PATH 환경변수로 경로 오버라이드 가능.
 *
 * forward-compat: schema_version 이 누락되면 '1.0' 으로 간주하고,
 * 누락된 섹션은 프로파일 프리셋으로 채워 넣는다. 구 config 가 신버전 CLI 에서 깨지지 않도록.
 */
export function loadProfile(configPath?: string): SemoConfig {
  const resolvedPath = resolveConfigPath(configPath);

  if (!fs.existsSync(resolvedPath)) {
    return {
      schema_version: CURRENT_CONFIG_SCHEMA_VERSION,
      profile: 'team',
      ...PROFILE_PRESETS.team,
      _source: '<default:team>',
    };
  }

  const text = fs.readFileSync(resolvedPath, 'utf8');
  const raw = parseToml(text) as Record<string, unknown>;
  const profile = ((raw.profile as string | undefined) ?? 'team') as ProfileName;
  const preset = PROFILE_PRESETS[profile] ?? PROFILE_PRESETS.custom;
  const merged = applyOverrides(preset, raw);
  const { version, warnings } = resolveSchemaVersion(raw);

  return {
    schema_version: version,
    profile,
    ...merged,
    _source: resolvedPath,
    _warnings: warnings.length ? Object.freeze(warnings) : undefined,
  };
}

/** `semo config show` 용 포맷팅 */
export function describeConfig(cfg: SemoConfig): string {
  const embeddingLine = cfg.embedding
    ? `embedding: ${cfg.embedding.provider}${cfg.embedding.model ? ` / ${cfg.embedding.model}` : ''}${cfg.embedding.dim ? ` (${cfg.embedding.dim}d)` : ''}`
    : `embedding: <none — FTS5 only>`;
  const lines = [
    `schema   : ${cfg.schema_version}`,
    `profile  : ${cfg.profile}`,
    `source   : ${cfg._source ?? '<default>'}`,
    ``,
    `kb       : ${cfg.kb.driver}${cfg.kb.sqlite_path ? ` (${cfg.kb.sqlite_path})` : ''}`,
    `ops      : ${cfg.ops.driver}${cfg.ops.sqlite_path ? ` (${cfg.ops.sqlite_path})` : ''}`,
    `messaging: ${cfg.messaging.sources.join(', ')}`,
    `execution: ${cfg.execution.target}${cfg.execution.model ? ` / ${cfg.execution.model}` : ''}`,
    `network  : ${cfg.network.mode}${cfg.network.listen ? ` (${cfg.network.listen})` : ''}${authState(cfg.network)}`,
    embeddingLine,
  ];
  if (cfg._warnings?.length) {
    lines.push('', 'warnings:');
    for (const w of cfg._warnings) lines.push(`  ⚠ ${w}`);
  }
  return lines.join('\n');
}

function authState(n: NetworkConfig): string {
  if (n.auth_token) return ' [auth:token]';
  if (n.auth_token_env) return ` [auth:$${n.auth_token_env}]`;
  return n.mode === 'offline' ? '' : ' [auth:none — LAN/Tailscale 에서는 토큰 권장]';
}

/**
 * `NetworkConfig` 의 `auth_token` 을 런타임 값으로 반환.
 * `auth_token` 이 직접 있으면 그걸, 없으면 `auth_token_env` 환경변수를 읽는다.
 */
export function resolveAuthToken(n: NetworkConfig): string | undefined {
  if (n.auth_token) return n.auth_token;
  if (n.auth_token_env) return process.env[n.auth_token_env] ?? undefined;
  return undefined;
}
