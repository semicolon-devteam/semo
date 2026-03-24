import { query } from './db';
import type { SyncFlow, SyncStatus, SyncBotStatus } from '@/types';

export const SYNC_FLOWS: SyncFlow[] = [
  {
    id: 'ctx-sync-kb',
    name: 'KB 동기화',
    trigger: 'SessionStart',
    direction: 'DB→Local',
    command: 'semo context sync',
    table: 'knowledge_base',
    description: 'Core DB의 knowledge_base 테이블에서 team/project/infra/process 도메인 데이터를 .claude/memory/ 파일로 동기화',
    filePaths: ['.claude/memory/team.md', '.claude/memory/projects.md', '.claude/memory/infra.md', '.claude/memory/process.md'],
  },
  {
    id: 'ctx-sync-bots',
    name: '봇 상태 동기화',
    trigger: 'SessionStart',
    direction: 'DB→Local',
    command: 'semo context sync',
    table: 'bot_status',
    description: '봇별 온/오프라인 상태, 마지막 활동 시각을 .claude/memory/bots.md로 동기화',
    filePaths: ['.claude/memory/bots.md'],
  },
  {
    id: 'ctx-sync-onto',
    name: '온톨로지 동기화',
    trigger: 'SessionStart',
    direction: 'DB→Local',
    command: 'semo context sync',
    table: 'ontology',
    description: '팀 온톨로지(용어 정의)를 .claude/memory/ontology.md로 동기화',
    filePaths: ['.claude/memory/ontology.md'],
  },
  {
    id: 'ctx-sync-cache',
    name: '글로벌 캐시',
    trigger: 'SessionStart',
    direction: 'DB→Local',
    command: 'semo context sync',
    table: 'skill/command/agent_definitions',
    description: 'skill, command, agent 정의를 글로벌 캐시 디렉토리로 동기화',
    filePaths: ['.claude/skills/', '.claude/commands/', '.claude/agents/'],
  },
  {
    id: 'skill-to-db',
    name: '봇 스킬 → DB',
    trigger: 'SessionStart',
    direction: 'Local→DB',
    command: 'semo context sync',
    table: 'skill_definitions',
    description: '로컬 스킬 파일을 파싱하여 DB의 skill_definitions 테이블에 업서트',
  },
  {
    id: 'kb-digest',
    name: 'KB 다이제스트',
    trigger: 'BotHook',
    direction: 'DB→Local',
    command: 'semo context sync --digest',
    table: 'knowledge_base',
    description: '봇 세션 시작 시 최근 KB 변경사항을 kb-digest.md로 생성',
    filePaths: ['.claude/memory/kb-digest.md'],
  },
  {
    id: 'ctx-push',
    name: '결정사항 Push',
    trigger: 'SessionStop',
    direction: 'Local→DB',
    command: 'semo context push',
    table: 'knowledge_base (decision)',
    description: 'decisions.md 변경분을 KB의 decision 도메인으로 저장',
    filePaths: ['.claude/memory/decisions.md'],
  },
  {
    id: 'bot-online',
    name: '봇 온라인',
    trigger: 'BotHook',
    direction: 'OpenClaw→DB',
    command: 'semo bots set-status',
    table: 'bot_status',
    description: '봇 세션 시작 시 bot_status를 online으로 업데이트',
  },
  {
    id: 'bot-offline',
    name: '봇 오프라인',
    trigger: 'BotHook',
    direction: 'OpenClaw→DB',
    command: 'semo bots set-status',
    table: 'bot_status',
    description: '봇 세션 종료 시 bot_status를 offline으로 업데이트',
  },
  {
    id: 'bot-sync',
    name: '봇 메타 동기화',
    trigger: 'SessionStart',
    direction: 'Local→DB',
    command: 'semo bots sync',
    table: 'bot_status',
    description: '봇 설정 파일(soul, agents 등)의 메타데이터를 DB에 동기화',
  },
  {
    id: 'sessions-sync',
    name: '세션 동기화',
    trigger: 'Manual',
    direction: 'OpenClaw→DB',
    command: 'semo sessions sync',
    table: 'bot_sessions',
    description: 'OpenClaw 플랫폼의 세션 데이터를 DB에 동기화 (수동 실행)',
  },
  {
    id: 'sessions-push',
    name: '로컬 세션 추적',
    trigger: 'SessionStart',
    direction: 'Local→DB',
    command: 'semo sessions push',
    table: 'bot_sessions',
    description: '로컬 Claude Code 세션 시작/종료를 bot_sessions 테이블에 기록',
  },
];

export async function fetchRecentRecords(
  table: string,
  limit = 10
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  // Only allow known sync tables
  const allowedTables: Record<string, { schema: string; table: string; orderBy: string }> = {
    knowledge_base: { schema: 'semo', table: 'knowledge_base', orderBy: 'updated_at' },
    bot_status: { schema: 'semo', table: 'bot_status', orderBy: 'synced_at' },
    ontology: { schema: 'semo', table: 'ontology', orderBy: 'updated_at' },
    skill_definitions: { schema: 'semo', table: 'skill_definitions', orderBy: 'updated_at' },
    command_definitions: { schema: 'public', table: 'command_definitions', orderBy: 'updated_at' },
    agent_definitions: { schema: 'public', table: 'agent_definitions', orderBy: 'updated_at' },
    bot_sessions: { schema: 'semo', table: 'bot_sessions', orderBy: 'synced_at' },
  };

  const target = allowedTables[table];
  if (!target) return { columns: [], rows: [] };

  try {
    const result = await query(
      `SELECT * FROM "${target.schema}"."${target.table}" ORDER BY "${target.orderBy}" DESC LIMIT $1`,
      [limit]
    );
    return {
      columns: result.fields.map((f) => f.name),
      rows: result.rows,
    };
  } catch {
    return { columns: [], rows: [] };
  }
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const botsResult = await query<SyncBotStatus>(
    `SELECT bot_id, name, status, last_active, synced_at
     FROM semo.bot_status
     ORDER BY name`
  );

  let lastMigration: string | null = null;
  try {
    const migResult = await query<{ executed_at: string }>(
      `SELECT executed_at FROM semo.schema_migrations ORDER BY executed_at DESC LIMIT 1`
    );
    if (migResult.rows.length > 0) {
      lastMigration = migResult.rows[0].executed_at;
    }
  } catch {
    // table may not exist
  }

  return {
    bots: botsResult.rows,
    lastMigration,
    serverTime: new Date().toISOString(),
  };
}
