// Bot Types
export interface Bot {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'active' | 'idle' | 'error';
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

export interface DailyLog {
  date: string;
  content: string;
}

// OpenClaw Types
export interface Session {
  sessionKey: string;
  label: string;
  kind: 'main' | 'isolated';
  agentId: string;
  lastActive: string;
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
