export interface KbEntry {
  kbId?: number;
  domain: string;
  key: string;
  subKey?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  updatedAt?: string;
  similarityPct?: number;
}

export interface SearchOpts {
  topK: number;
  minScore?: number;
  domain?: string;
  createdBy?: string;
}

export interface UpsertInput {
  domain: string;
  key: string;
  subKey?: string;
  content: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface DeleteInput {
  domain: string;
  key: string;
  subKey?: string;
}

export type KbChangeEvent =
  | { type: 'upsert'; domain: string; key: string; subKey?: string; kbId?: number }
  | { type: 'delete'; domain: string; key: string; subKey?: string; kbId?: number };

export type Unsubscribe = () => void;
