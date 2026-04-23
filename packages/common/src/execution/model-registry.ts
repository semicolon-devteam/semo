/**
 * 모델 레지스트리 — 논리명(orchestrator/planner/coder/reviewer/etc.) → 실제 모델 ID 매핑.
 *
 * SoT 우선순위:
 * 1. KbStore 엔트리 `semo models/catalog` (운영에서 재배포 없이 변경)
 * 2. 생성자에 주입된 defaults
 * 3. 어댑터 내부 기본값 상수(최후의 보루)
 *
 * 사용 예:
 *   const registry = new ModelRegistry({ kbStore, defaults: { orchestrator: 'claude-opus-4-7' } });
 *   const id = await registry.get('planner');  // 'claude-sonnet-4-6'
 *
 * 신규 코드는 모델 리터럴 대신 `registry.get(logicalName)` 만 사용한다.
 */

export type LogicalModel =
  | 'orchestrator'
  | 'planner'
  | 'coder'
  | 'reviewer'
  | 'fast'
  | 'local'
  | string;

export interface ModelCatalog {
  /** logicalName → providerQualifiedId, 예: "anthropic:claude-opus-4-7" 또는 "claude-opus-4-7" */
  [logical: string]: string;
}

export interface KbStoreLike {
  get(domain: string, key: string, subKey?: string): Promise<{ content: string | null } | null>;
}

export interface ModelRegistryOptions {
  kbStore?: KbStoreLike;
  /** KB 미스/실패 시 폴백 맵. */
  defaults?: ModelCatalog;
  /** KB 캐시 TTL. 기본 60초. */
  ttlMs?: number;
}

export class ModelRegistry {
  private readonly kbStore?: KbStoreLike;
  private readonly defaults: ModelCatalog;
  private readonly ttlMs: number;
  private cache: { at: number; catalog: ModelCatalog } | null = null;

  constructor(opts: ModelRegistryOptions = {}) {
    this.kbStore = opts.kbStore;
    this.defaults = opts.defaults ?? {};
    this.ttlMs = opts.ttlMs ?? 60_000;
  }

  async get(logical: LogicalModel, adapterDefault?: string): Promise<string> {
    const catalog = await this.loadCatalog();
    return catalog[logical] ?? this.defaults[logical] ?? adapterDefault ?? logical;
  }

  /** 캐시 무효화. 운영 중 KB 변경 즉시 반영 시 호출. */
  invalidate(): void {
    this.cache = null;
  }

  private async loadCatalog(): Promise<ModelCatalog> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) return this.cache.catalog;
    if (!this.kbStore) return { ...this.defaults };
    try {
      const entry = await this.kbStore.get('semo', 'models', 'catalog');
      const parsed = entry?.content ? parseCatalog(entry.content) : {};
      const merged: ModelCatalog = { ...this.defaults, ...parsed };
      this.cache = { at: Date.now(), catalog: merged };
      return merged;
    } catch {
      return { ...this.defaults };
    }
  }
}

function parseCatalog(raw: string): ModelCatalog {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const out: ModelCatalog = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return parseKvBlock(trimmed);
  }
}

/** 간단한 `key: value` 라인 파서 — KB 엔트리가 JSON이 아닌 마크다운일 때 폴백. */
function parseKvBlock(raw: string): ModelCatalog {
  const out: ModelCatalog = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]?\s*([a-zA-Z0-9_-]+)\s*[:=]\s*([^\s#]+)/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** 프로세스 기본 ModelRegistry 싱글턴. 초기화는 명시적으로 한다. */
let _default: ModelRegistry | null = null;
export function setDefaultModelRegistry(registry: ModelRegistry): void {
  _default = registry;
}
export function getDefaultModelRegistry(): ModelRegistry {
  if (!_default) _default = new ModelRegistry();
  return _default;
}
