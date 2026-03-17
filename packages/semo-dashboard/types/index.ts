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
    decisions: string;
    team: string;
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
