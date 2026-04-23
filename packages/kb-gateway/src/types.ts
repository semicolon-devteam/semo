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
