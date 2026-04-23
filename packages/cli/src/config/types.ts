/**
 * config.toml 스키마 버전. 구 config 호환을 위한 forward-compat 기준점.
 *
 * 변경 시 CHANGELOG:
 * - 1.0 (2026-04-22): 초기 스키마 (profile + kb + ops + messaging + execution + network)
 */
export const CURRENT_CONFIG_SCHEMA_VERSION = '1.0';

/** 이 CLI 가 읽을 수 있는 최대 schema major. 초과 시 loadProfile 이 경고 + custom fallback. */
export const SUPPORTED_CONFIG_SCHEMA_MAJOR = 1;

export type ProfileName = 'team' | 'solo-offline' | 'solo-connected' | 'custom';

export type KbDriver = 'postgres' | 'sqlite' | 'obsidian' | 'notion';

export type OpsDriver = 'postgres' | 'sqlite' | 'memory';

export type MessagingSource = 'slack' | 'discord' | 'stdin' | 'http' | 'obsidian-file';

export type ExecutionTargetKind =
  | 'claude-code'
  | 'anthropic-api'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'mlx';

export type SeatStrategy = 'pool' | 'dedicated';

export type NetworkMode = 'offline' | 'lan' | 'tailscale';

export interface KbConfig {
  driver: KbDriver;
  sqlite_path?: string;
  obsidian_vault?: string;
  notion_database_id?: string;
  notion_token?: string;
  postgres_url?: string;
  embedding_dim?: number;
}

export interface OpsConfig {
  driver: OpsDriver;
  sqlite_path?: string;
  postgres_url?: string;
}

export interface MessagingConfig {
  sources: MessagingSource[];
}

export interface ExecutionConfig {
  target: ExecutionTargetKind;
  model?: string;
  seat_strategy?: SeatStrategy;
  ollama_host?: string;
  mlx_host?: string;
  api_key_env?: string;
}

export interface NetworkConfig {
  mode: NetworkMode;
  listen?: string;
  /** HTTP/WS 엔드포인트 공유 bearer 토큰. `mode=lan|tailscale` 에서 강권. */
  auth_token?: string;
  /** 토큰을 환경변수에서 읽을 때 사용할 변수명. `auth_token` 우선. */
  auth_token_env?: string;
}

/** 임베딩 공급자. 생략 시 KB 는 FTS5 텍스트 검색만 수행. */
export type EmbeddingProviderKind = 'none' | 'openai' | 'ollama';

export interface EmbeddingConfig {
  provider: EmbeddingProviderKind;
  model?: string;
  /** Ollama host. 생략 시 OLLAMA_HOST 환경변수 또는 기본 127.0.0.1:11434. */
  host?: string;
  /** 출력 차원. 모델별 기본값(nomic-embed-text=768, bge-m3=1024, openai-3-small=1024) 있음. */
  dim?: number;
  /** OpenAI 키 환경변수명. provider=openai 에서만 사용. 기본 OPENAI_API_KEY. */
  api_key_env?: string;
}

export interface SemoConfig {
  /** config.toml schema 버전. 누락 시 '1.0' 으로 간주 (forward-compat). */
  schema_version: string;
  profile: ProfileName;
  kb: KbConfig;
  ops: OpsConfig;
  messaging: MessagingConfig;
  execution: ExecutionConfig;
  network: NetworkConfig;
  /** 임베딩 공급자 설정 (optional). 미지정 시 KB 는 FTS5 텍스트 검색만. */
  embedding?: EmbeddingConfig;
  /** 최초 로드 원본 파일 경로 (디버깅/표시용) */
  readonly _source?: string;
  /** 로드 중 감지된 forward-compat 경고. describeConfig 에서 노출. */
  readonly _warnings?: readonly string[];
}
