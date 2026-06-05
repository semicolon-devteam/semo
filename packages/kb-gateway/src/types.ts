/**
 * KB Gateway 요청/응답 타입.
 * 모든 엔드포인트는 JSON 바디, X-Bot-Id + X-Signature(HMAC) 헤더로 호출한다.
 */

export interface KBItem {
  kb_id: number;
  domain: string;
  key: string; // combined key/sub_key 형태 ("section/track/phase")
  content: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  updated_at?: string;
  similarity_pct?: number;
}

export interface KbGetRequest {
  domain: string;
  key: string;
}

export interface KbSearchRequest {
  query: string;
  top_k?: number;
  min_score?: number;
  domain?: string;
  created_by?: string;
}

export interface KbUpsertRequest {
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
}

export interface KbEmbedRequest {
  texts: string[];
}

export interface KbEmbedResponse {
  provider: string;
  dim: number;
  embeddings: number[][];
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}

// ── 멀티테넌트 (SemiColony) ──────────────────────────────────────────────

export type GatewayScope = 'tenant-local' | 'platform-global';

/**
 * 인증 후 요청에 부착되는 컨텍스트.
 *  - kind='tenant'  : Bearer 자격증명(sck_...)으로 해석된 외부 Colony. tenantId/tenantSlug 보유.
 *  - kind='internal': 기존 공유 HMAC 으로 인증된 내부 봇/CLI. botId 보유, platform-global 전체 접근.
 */
export interface TenantContext {
  kind: 'tenant' | 'internal';
  tenantId: string | null;
  tenantSlug: string | null;
  botId?: string;
  scopes: string[];
}

export interface PersonaResolveRequest {
  /** 해소할 에이전트 slug(botId). tenant 는 자기 prefix(ag-{slug}-)만 허용. 내부는 전체. */
  slug?: string;
}

export interface PersonaResolveResponse {
  slug: string;
  display_name: string | null;
  soul_md: string;
  version: number;
}
