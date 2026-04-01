// Bot Types
export interface Bot {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'online' | 'offline';
  lastActive: string;
  sessionCount: number;
  workspacePath: string;
}

export interface BotDetail {
  config: {
    soul: string;
    agents: string;
    user: string;
  };
  files: BotFile[];
  memory: {
    kbEntries: { domain: string; key: string; content: string }[];
    dailyLogs: DailyLog[];
  };
  activity: {
    sessions: Session[];
    cronJobs: CronJob[];
  };
}

export interface BotFile {
  path: string;
  type: 'file' | 'directory';
}

export interface FileTreeEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface DailyLog {
  date: string;
  content: string;
}

// OpenClaw Types
export interface Session {
  sessionKey: string;
  label: string;
  kind: 'main' | 'isolated';
  chatType: string; // 'slack' | 'telegram' | ...
  lastActivity: string;
  messageCount: number;
}

export interface CronJob {
  jobId: string;
  name: string;
  schedule: {
    kind: 'cron' | 'every' | 'at';
    [key: string]: unknown;
  };
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  sessionTarget?: string;
  payload?: {
    kind?: string;
    message?: string;
    timeoutSeconds?: number;
    [key: string]: unknown;
  };
}

// Ontology Types
export interface OntologyEntry {
  kb_id: string;
  domain: string;
  key: string;
  content: string;
  created_by?: string;
}

export interface KBDomain {
  domain: string;
  description?: string;
  service?: string | null;
  entity_type?: string | null;
  entry_count: number;
}

// Audit Types
export interface AuditCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface BotAudit {
  botId: string;
  rating: 'GOOD' | 'NEEDS-WORK' | 'POOR';
  score: number;
  checks: AuditCheck[];
  createdAt: string;
}

// KB Types
export interface KBItem {
  domain: string;
  key: string;
  value: unknown;
  valueSummary?: string;
  similarity?: number;
  ownerBot: string;
  createdAt: string;
  updatedAt: string;
}

export interface KBSearchResult extends KBItem {
  similarity: number;
}

export interface KBEntry {
  id: string;
  title: string;
  content: string;
  bot_id: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  similarity_pct?: number;
}

// Bot Skill Types
export interface BotSkill {
  name: string;           // e.g. "axoracle-blog"
  fullName: string;       // e.g. "growthclaw/axoracle-blog"
  source: 'synced' | 'workspace-only' | 'db-only';
  isActive: boolean;
  category: string | null;
  package: string | null;
  updatedAt: string | null;
  hasReferences: boolean;
}

// DB Explorer Types
export interface DBTable {
  table_schema: string;
  table_name: string;
  row_count_estimate: number;
}

export interface DBColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}

export interface DBConstraint {
  constraint_name: string;
  constraint_type: string;
  columns: string[];
  foreign_table_schema?: string;
  foreign_table_name?: string;
  foreign_columns?: string[];
}

export interface DBIndex {
  indexname: string;
  indexdef: string;
  is_unique: boolean;
}

export interface DBTableDetail {
  schema: string;
  table: string;
  columns: DBColumn[];
  constraints: DBConstraint[];
  indexes: DBIndex[];
}

export interface DBDataResult {
  rows: Record<string, unknown>[];
  columns: string[];
  totalRows: number;
  page: number;
  pageSize: number;
}

export interface DBQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

// Milestone / Roadmap Types
export interface MilestoneMetadata {
  project: string;
  title: string;
  start_date: string;   // ISO date: "2026-01-15"
  end_date: string;      // ISO date: "2026-02-28"
  status: 'planned' | 'in-progress' | 'completed';
  order?: number;
}

export interface Milestone {
  kb_id: string;
  key: string;
  content: string;
  metadata: MilestoneMetadata;
  updated_at: string;
}

// Sync Types
export type SyncTrigger = 'SessionStart' | 'SessionStop' | 'BotHook' | 'Manual';
export type SyncDirection = 'DB→Local' | 'Local→DB' | 'OpenClaw→DB';

export interface SyncFlow {
  id: string;
  name: string;
  trigger: SyncTrigger;
  direction: SyncDirection;
  command: string;
  table: string;
  description: string;
  filePaths?: string[];
}

export interface SyncBotStatus {
  bot_id: string;
  name: string;
  status: 'online' | 'offline';
  last_active: string;
  synced_at: string;
}

export interface SyncStatus {
  bots: SyncBotStatus[];
  lastMigration: string | null;
  serverTime: string;
}

// Test Management Types
export interface TestSuite {
  suite_id: string;
  name: string;
  layer: string;
  runner_type: string;
  schedule: string | null;
  enabled: boolean;
  last_run_status: string | null;
  last_run_at: string | null;
  last_pass: number | null;
  last_fail: number | null;
  last_warn: number | null;
}

export interface TestRun {
  run_id: string;
  suite_id: string;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
  total_pass: number;
  total_fail: number;
  total_warn: number;
  status: string;
  summary: string | null;
}

export interface TestResult {
  case_id: string;
  label: string;
  status: string;
  detail: string | null;
  duration_ms: number | null;
}

// GFP (Greenfield Project Pipeline) Types

export interface GfpQAItem {
  id: string;            // e.g., "q01", "q02"
  question: string;
  sub_bullets?: string[];
  answer: string | null;
  answered_at: string | null;   // ISO timestamp
  answered_via: 'dashboard' | 'slack' | null;
}

export type GfpProjectStatus = 'active' | 'paused' | 'completed';
export type GfpSectionStatus = 'draft' | 'pending-review' | 'approved' | 'rejected';
export type GfpSectionSource = 'planclaw' | 'imported' | 'growthclaw' | 'manual' | 'designclaw';
export type GfpMaterialType = 'planning-doc' | 'stitch-export' | 'design-prototype';
export type GfpResearchTaskType = 'competitor-analysis' | 'market-research' | 'ux-pattern' | 'keyword-research' | 'design-reference';
export type GfpResearchStatus = 'queued' | 'dispatched' | 'completed';

// GFP Phase 4 Design Sub-Steps
export type DesignStep = 1 | 2 | 3 | 4 | 5;

export const DESIGN_STEPS = [
  { step: 1 as const, label: '레퍼런스 탐색', prefix: 'ref-', icon: 'magnifying-glass' },
  { step: 2 as const, label: '디자인 시스템', prefix: 'ds-', icon: 'palette' },
  { step: 3 as const, label: '구현', prefix: 'impl-', icon: 'code' },
  { step: 4 as const, label: '리뷰', prefix: 'review-', icon: 'eye' },
  { step: 5 as const, label: '핸드오프', prefix: 'handoff-', icon: 'arrow-right' },
] as const;

export interface GfpProject {
  gfp_id: string;
  project_name: string;
  service_domain: string | null;
  owner_name: string;
  owner_contact: string | null;
  current_phase: number;
  status: GfpProjectStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GfpPhaseSection {
  section_id: string;
  gfp_id: string;
  phase: number;
  section_key: string;
  title: string;
  content: string;
  ordinal: number;
  status: GfpSectionStatus;
  reviewer_note: string | null;
  source: GfpSectionSource;
  kb_written_at: string | null;
  qa_items: GfpQAItem[] | null;
  slack_thread_ts: string | null;
  created_at: string;
  updated_at: string;
}

export interface GfpMaterial {
  material_id: string;
  gfp_id: string;
  content: string;
  phase_mapping: GfpPhaseMapping[] | null;
  material_type: GfpMaterialType;
  created_at: string;
}

export interface GfpPhaseMapping {
  phase: number;
  coverage: number;
  sections: { key: string; title: string; content: string }[];
  gaps: string[];
}

export interface GfpResearchTask {
  task_id: string;
  gfp_id: string;
  task_type: GfpResearchTaskType;
  reference_urls: string[];
  input_prompt: string;
  status: GfpResearchStatus;
  result: string | null;
  created_at: string;
  updated_at: string;
}
