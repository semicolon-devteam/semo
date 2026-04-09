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
  name: string; // e.g. "axoracle-blog"
  fullName: string; // e.g. "growthclaw/axoracle-blog"
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
  start_date: string; // ISO date: "2026-01-15"
  end_date: string; // ISO date: "2026-02-28"
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

// Service Preset Types

export type ServicePresetId = 'standard' | 'infra-ready' | 'parallel';

export type ServiceTrack = 'plan' | 'infra';
export type ServiceInfraRequestStatus = 'pending' | 'acknowledged' | 'in-progress' | 'completed';
export type ServiceInfraCategory = 'oauth' | 'push' | 'api' | 'storage' | 'dns' | 'cicd' | 'other';

export interface ServiceInfraRequest {
  request_id: string;
  service_id: string;
  source_phase: number;
  source_section_id: string | null;
  category: ServiceInfraCategory;
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high';
  status: ServiceInfraRequestStatus;
  slack_thread_ts: string | null;
  created_at: string;
  updated_at: string;
}

// ── Deploy Verification ──

export type DeployCheckStatus = 'pass' | 'fail' | 'skip';

export interface DeployCheckResult {
  status: DeployCheckStatus;
  detail: string;
  [key: string]: unknown;
}

export interface DeployVerificationChecks {
  ci_build: DeployCheckResult;
  pod_status: DeployCheckResult;
  health_endpoint: DeployCheckResult;
  tls_cert: DeployCheckResult;
  k8s_secret?: DeployCheckResult;
}

export type DeployVerificationOverall = 'pass' | 'fail';

export interface DeployVerification {
  verification_id: string;
  service_id: string;
  infra_phase: number;
  checks: DeployVerificationChecks;
  overall_status: DeployVerificationOverall;
  verified_by: string;
  created_at: string;
}

export interface ServiceInfraConfig {
  repo_url: string;
  live_url: string;
  deploy_pipeline?: string;
  dns_configured?: boolean;
  provisioned_by?: string;
  provisioned_at?: string;
}

export interface ServicePresetConfig {
  infra?: ServiceInfraConfig;
  skip_cc?: number[];
  bot_hints?: Partial<Record<number, string>>;
}

// Service Pipeline Types (formerly GFP — Greenfield Project Pipeline)

export interface ServiceQAItem {
  id: string; // e.g., "q01", "q02"
  question: string;
  sub_bullets?: string[];
  answer: string | null;
  answered_at: string | null; // ISO timestamp
  answered_via: 'dashboard' | 'slack' | null;
}

export type ServiceProjectStatus = 'active' | 'paused' | 'completed';
export type ServiceSectionStatus = 'draft' | 'pending-review' | 'approved' | 'rejected';
export type ServiceSectionSource =
  | 'planclaw'
  | 'imported'
  | 'growthclaw'
  | 'manual'
  | 'designclaw'
  | 'semiclaw'
  | 'infraclaw'
  | 'workclaw';
export type ServiceMaterialType = 'planning-doc' | 'stitch-export' | 'design-prototype';
export type ServiceResearchTaskType =
  | 'competitor-analysis'
  | 'market-research'
  | 'ux-pattern'
  | 'keyword-research'
  | 'design-reference';
export type ServiceResearchStatus = 'queued' | 'dispatched' | 'completed';

// GFP Phase 4 Design Sub-Steps
export type DesignStep = 1 | 2 | 3 | 4 | 5;

export const DESIGN_STEPS = [
  {
    step: 1 as const,
    label: '레퍼런스 탐색',
    prefixes: ['ref-'] as const,
    icon: 'magnifying-glass',
  },
  {
    step: 2 as const,
    label: '디자인 시스템',
    prefixes: ['ds-', 'screen-', 'design-'] as const,
    icon: 'palette',
  },
  {
    step: 3 as const,
    label: '구현',
    prefixes: ['impl-', 'stitch-prompt-', 'stitch-result-'] as const,
    icon: 'code',
  },
  { step: 4 as const, label: '리뷰', prefixes: ['review-'] as const, icon: 'eye' },
  { step: 5 as const, label: '핸드오프', prefixes: ['handoff-'] as const, icon: 'arrow-right' },
] as const;

/** Check if a section_key belongs to a given step definition */
export function matchesStep(sectionKey: string, step: (typeof DESIGN_STEPS)[number]): boolean {
  return step.prefixes.some((p) => sectionKey.startsWith(p));
}

export type ServiceLifecycle = 'build' | 'ops' | 'sunset';

export interface ServiceProject {
  service_id: string;
  project_name: string;
  service_domain: string | null;
  owner_name: string;
  owner_contact: string | null;
  current_phase: number;
  infra_phase: number | null;
  status: ServiceProjectStatus;
  lifecycle: ServiceLifecycle;
  launched_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ServiceSection {
  section_id: string;
  service_id: string;
  phase: number;
  track: ServiceTrack;
  section_key: string;
  title: string;
  content: string;
  ordinal: number;
  status: ServiceSectionStatus;
  reviewer_note: string | null;
  source: ServiceSectionSource;
  kb_written_at: string | null;
  qa_items: ServiceQAItem[] | null;
  slack_thread_ts: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceMaterial {
  material_id: string;
  service_id: string;
  content: string;
  phase_mapping: ServicePhaseMapping[] | null;
  material_type: ServiceMaterialType;
  created_at: string;
}

export interface ServicePhaseMapping {
  phase: number;
  coverage: number;
  sections: { key: string; title: string; content: string }[];
  gaps: string[];
}

export interface ServiceResearchTask {
  task_id: string;
  service_id: string;
  task_type: ServiceResearchTaskType;
  reference_urls: string[];
  input_prompt: string;
  status: ServiceResearchStatus;
  result: string | null;
  created_at: string;
  updated_at: string;
}

// GFP PO Profile — Phase 0 RPG-style profiling
export type PoTechLevel = 'non-technical' | 'basic' | 'intermediate' | 'advanced';
export type PoDesignSensitivity = 'low' | 'medium' | 'high';
export type PoDomainArea = 'business' | 'engineering' | 'design' | 'product';
export type PoInteractionStyle = 'concise' | 'detailed';
export type PoDecisionStyle = 'options' | 'recommendation';

export interface PoProfile {
  tech_level: PoTechLevel;
  design_sensitivity: PoDesignSensitivity;
  domain_area: PoDomainArea;
  interaction_style: PoInteractionStyle;
  decision_style: PoDecisionStyle;
}

// ── Sandbox Types ──

export type SandboxDepth = 'plan-only' | 'full' | 'e2e';
export type SandboxMode = 'mock' | 'live';
export type SandboxVirtualPOMode = 'auto-pilot' | 'semi-auto' | 'interactive';

export interface SandboxVirtualPO {
  mode: SandboxVirtualPOMode;
  persona_id: string;
  rejection_rate?: number;
  /** Phase별 거절 가중치 (기본 1.0, 높을수록 해당 phase에서 거절 확률 상승) */
  phase_rejection_weights?: Partial<Record<number, number>>;
}

export interface SandboxRunStats {
  started_at: string;
  completed_at?: string;
  phases_completed: number;
  sections_generated: number;
  sections_reviewed: number;
  rejections: number;
  cost_usd?: number;
}

export interface SandboxConfig {
  enabled: true;
  depth: SandboxDepth;
  mode: SandboxMode;
  virtual_po: SandboxVirtualPO;
  scenario_id: string;
  auto_advance: boolean;
  slack_suppress: boolean;
  timing: {
    phase_delay_ms: number;
    section_delay_ms: number;
  };
  run_stats?: SandboxRunStats;
}

export interface SandboxPersona {
  id: string;
  name: string;
  po_profile: PoProfile;
  domain_context: string;
}

export interface SandboxScenarioMockSection {
  section_key: string;
  title: string;
  content: string;
  source: ServiceSectionSource;
}

export interface SandboxScenario {
  id: string;
  project_name: string;
  persona_id: string;
  preset: ServicePresetId;
  initial_description: string;
  /** Phase별 Mock 섹션 콘텐츠 */
  mock_sections: Partial<Record<number, SandboxScenarioMockSection[]>>;
  /** Phase별 예상 최소 섹션 수 (검증용) */
  expected_section_counts: Partial<Record<number, number>>;
  /** infra-ready 프리셋용 인프라 설정 */
  infra_config?: ServiceInfraConfig;
}

// ── Gfp* backward-compat aliases (deprecated — use Service* instead) ──

/** @deprecated Use ServiceProject */
export type GfpProject = ServiceProject;
/** @deprecated Use ServiceSection */
export type GfpPhaseSection = ServiceSection;
/** @deprecated Use ServiceMaterial */
export type GfpMaterial = ServiceMaterial;
/** @deprecated Use ServiceResearchTask */
export type GfpResearchTask = ServiceResearchTask;
/** @deprecated Use ServiceInfraRequest */
export type GfpInfraRequest = ServiceInfraRequest;
/** @deprecated Use ServicePresetId */
export type GfpPresetId = ServicePresetId;
/** @deprecated Use ServiceTrack */
export type GfpTrack = ServiceTrack;
/** @deprecated Use ServiceProjectStatus */
export type GfpProjectStatus = ServiceProjectStatus;
/** @deprecated Use ServiceSectionStatus */
export type GfpSectionStatus = ServiceSectionStatus;
/** @deprecated Use ServiceSectionSource */
export type GfpSectionSource = ServiceSectionSource;
/** @deprecated Use ServiceInfraCategory */
export type GfpInfraCategory = ServiceInfraCategory;
/** @deprecated Use ServiceInfraRequestStatus */
export type GfpInfraRequestStatus = ServiceInfraRequestStatus;
/** @deprecated Use ServicePresetConfig */
export type GfpPresetConfig = ServicePresetConfig;
/** @deprecated Use ServiceInfraConfig */
export type GfpInfraConfig = ServiceInfraConfig;
/** @deprecated Use ServiceQAItem */
export type GfpQAItem = ServiceQAItem;
/** @deprecated Use ServicePhaseMapping */
export type GfpPhaseMapping = ServicePhaseMapping;
/** @deprecated Use ServiceMaterialType */
export type GfpMaterialType = ServiceMaterialType;
/** @deprecated Use ServiceResearchTaskType */
export type GfpResearchTaskType = ServiceResearchTaskType;
/** @deprecated Use ServiceResearchStatus */
export type GfpResearchStatus = ServiceResearchStatus;

// ── Service Iterations (ops mode) ──

export type IterationStatus = 'planned' | 'active' | 'completed';

export interface ServiceIteration {
  iteration_id: string;
  service_id: string;
  title: string;
  goal: string | null;
  status: IterationStatus;
  started_at: string | null;
  completed_at: string | null;
  retrospective: string | null;
  created_at: string;
  updated_at: string;
}

// ── Service Features (ops mode) ──

export type ServiceFeatureCategory = 'core' | 'growth' | 'infra' | 'ux' | 'integration';
export type ServiceFeatureStatus =
  | 'planned'
  | 'in-spec'
  | 'spec-ready'
  | 'in-dev'
  | 'in-test'
  | 'active'
  | 'deprecated';

export interface ServiceFeature {
  feature_id: string;
  service_id: string;
  name: string;
  description: string | null;
  category: ServiceFeatureCategory;
  status: ServiceFeatureStatus;
  parent_id: string | null;
  iteration_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Service Incidents (ops mode) ──

export type ServiceIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ServiceIncidentStatus = 'open' | 'investigating' | 'resolved' | 'postmortem';

export interface ServiceIncident {
  incident_id: string;
  service_id: string;
  iteration_id: string | null;
  severity: ServiceIncidentSeverity;
  title: string;
  description: string | null;
  root_cause: string | null;
  resolution: string | null;
  status: ServiceIncidentStatus;
  occurred_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Service KPI Metrics ──

export type KPISignal = 'green' | 'yellow' | 'red' | 'neutral';
export type KPICategory = 'common' | 'service-specific' | 'search' | 'engagement';
export type KPISource = 'bot' | 'manual' | 'api' | 'import';

export interface ServiceKPIMetric {
  metric_id: string;
  service_id: string;
  iteration_id: string | null;
  period: string;
  metric_name: string;
  metric_label: string | null;
  category: KPICategory;
  current_value: number | null;
  baseline_value: number | null;
  target_value: number | null;
  unit: string | null;
  wow_change: number | null;
  signal: KPISignal;
  achieved: boolean;
  source: KPISource;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Service Action Items ──

export type ActionItemStatus = 'open' | 'completed' | 'cancelled';
export type ActionItemPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ActionItemSource = 'manual' | 'bot' | 'dashboard' | 'import';

export interface ServiceActionItem {
  action_item_id: string;
  service_id: string;
  iteration_id: string | null;
  description: string;
  assignee: string | null;
  deadline: string | null;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  category: string | null;
  source: ActionItemSource;
  related_url: string | null;
  sort_order: number;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Feature Spec (구조화된 기능 명세) ──

export interface AcceptanceCriterion {
  id: string;
  criterion: string;
  verified: boolean;
  verified_at?: string;
}

export interface UserStory {
  id: string;
  as_a: string;
  i_want: string;
  so_that: string;
  acceptance_ids: string[];
}

export interface TestScenario {
  id: string;
  title: string;
  preconditions?: string;
  steps: string[];
  expected: string;
  acceptance_ids: string[];
  last_result?: 'pass' | 'fail' | 'skip';
  last_tested_at?: string;
  last_tested_by?: string;
}

export interface FeatureSpec {
  summary?: string;
  estimated_effort?: 'small' | 'medium' | 'large';
  acceptance_criteria: AcceptanceCriterion[];
  user_stories: UserStory[];
  test_scenarios: TestScenario[];
  source_url?: string;
  screenshot_key?: string;
  spec_status: 'draft' | 'pending-review' | 'approved';
  spec_generated_by?: string;
  spec_generated_at?: string;
  spec_approved_at?: string;
}

// ── Feature Discovery Sessions ──

export type DiscoverySessionStatus =
  | 'crawling'
  | 'candidates_ready'
  | 'reviewing'
  | 'confirmed'
  | 'failed';

export interface DiscoveredFeature {
  name: string;
  description: string;
  category: string;
  source_url?: string;
  screenshot_key?: string;
  confidence: 'high' | 'medium' | 'low';
  nav_path?: string[];
  visible_elements?: string[];
  suggested_children?: Omit<DiscoveredFeature, 'suggested_children'>[];
}

export interface FeatureDiscoverySession {
  session_id: string;
  service_id: string;
  source_url: string;
  status: DiscoverySessionStatus;
  candidates: DiscoveredFeature[];
  confirmed: DiscoveredFeature[];
  screenshots: Record<string, string>;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ── Feature Conversation Sessions ──

export type ConversationMode = 'create' | 'enrich';
export type ConversationStatus = 'collecting' | 'reviewing' | 'confirmed' | 'cancelled';

export interface FeatureConversationSession {
  session_id: string;
  service_id: string;
  mode: ConversationMode;
  status: ConversationStatus;
  features: Array<{
    name: string;
    description: string;
    category: string;
    spec?: Partial<FeatureSpec>;
  }>;
  slack_channel: string | null;
  slack_thread_ts: string | null;
  created_at: string;
  updated_at: string;
}
