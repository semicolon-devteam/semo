/**
 * MCP Registry — 봇별 MCP 서버 접근 매트릭스
 *
 * 각 MCP 서버를 한 번 정의하고, 봇별 접근 수준(full/read_write/read_only/none)에 따라
 * 허용 도구 목록과 서버 설정을 자동 결정한다.
 */

import type { McpStdioServerConfig, McpServerConfig } from '@anthropic-ai/claude-agent-sdk';
import type { Pool } from 'pg';
import * as path from 'path';
import * as os from 'os';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

// ── 타입 ──

export type McpAccessLevel = 'full' | 'read_write' | 'read_only' | 'none';

export interface McpServerDefinition {
  create: () => McpServerConfig | null;
  toolsByAccess: Record<McpAccessLevel, string[]>;
}

interface BotMcpAccess {
  serverName: string;
  accessLevel: McpAccessLevel;
}

// ── Supabase MCP 도구 목록 ──

const SUPABASE_PROJECT_REF = 'zorienqtiaxyuozhxwdj';

const SUPABASE_TOOLS = {
  execute_sql: 'mcp__supabase__execute_sql',
  apply_migration: 'mcp__supabase__apply_migration',
  list_tables: 'mcp__supabase__list_tables',
  list_extensions: 'mcp__supabase__list_extensions',
  list_migrations: 'mcp__supabase__list_migrations',
  get_logs: 'mcp__supabase__get_logs',
  list_projects: 'mcp__supabase__list_projects',
  get_project: 'mcp__supabase__get_project',
  search_docs: 'mcp__supabase__search_docs',
} as const;

// ── Stitch MCP 도구 목록 ──

const STITCH_TOOLS = {
  list_projects: 'mcp__stitch__list_projects',
  create_project: 'mcp__stitch__create_project',
  get_project: 'mcp__stitch__get_project',
  list_screens: 'mcp__stitch__list_screens',
  get_screen: 'mcp__stitch__get_screen',
  generate_screen_from_text: 'mcp__stitch__generate_screen_from_text',
  edit_screens: 'mcp__stitch__edit_screens',
  generate_variants: 'mcp__stitch__generate_variants',
  list_design_systems: 'mcp__stitch__list_design_systems',
  create_design_system: 'mcp__stitch__create_design_system',
  apply_design_system: 'mcp__stitch__apply_design_system',
  update_design_system: 'mcp__stitch__update_design_system',
} as const;

// ── Slack MCP 도구 목록 ──

const SLACK_TOOLS = {
  list_channels: 'mcp__slack__slack_list_channels',
  get_channel_history: 'mcp__slack__slack_get_channel_history',
  get_thread_replies: 'mcp__slack__slack_get_thread_replies',
  get_users: 'mcp__slack__slack_get_users',
  get_user_profile: 'mcp__slack__slack_get_user_profile',
  search_messages: 'mcp__slack__slack_search_messages',
  post_message: 'mcp__slack__slack_post_message',
  reply_to_thread: 'mcp__slack__slack_reply_to_thread',
  add_reaction: 'mcp__slack__slack_add_reaction',
} as const;

const SLACK_READ_TOOLS = [
  SLACK_TOOLS.list_channels,
  SLACK_TOOLS.get_channel_history,
  SLACK_TOOLS.get_thread_replies,
  SLACK_TOOLS.get_users,
  SLACK_TOOLS.get_user_profile,
  SLACK_TOOLS.search_messages,
];

// ── 서버 정의 ──

const MCP_SERVERS: Record<string, McpServerDefinition> = {
  slack: {
    create: (): McpStdioServerConfig | null => {
      const token = process.env.SLACK_BOT_TOKEN;
      const teamId = process.env.SLACK_TEAM_ID;
      if (!token) return null;
      return {
        command: 'npx',
        args: ['-y', '@anthropic-ai/mcp-server-slack'],
        env: {
          SLACK_BOT_TOKEN: token,
          ...(teamId ? { SLACK_TEAM_ID: teamId } : {}),
        },
      };
    },
    toolsByAccess: {
      full: Object.values(SLACK_TOOLS),
      read_write: [...SLACK_READ_TOOLS, SLACK_TOOLS.add_reaction],
      read_only: SLACK_READ_TOOLS,
      none: [],
    },
  },

  supabase: {
    create: (): McpStdioServerConfig | null => {
      const token = process.env.SUPABASE_ACCESS_TOKEN;
      if (!token) return null;
      return {
        command: 'npx',
        args: ['-y', '@supabase/mcp-server-supabase', '--project-ref', SUPABASE_PROJECT_REF],
        env: { SUPABASE_ACCESS_TOKEN: token },
      };
    },
    toolsByAccess: {
      full: Object.values(SUPABASE_TOOLS),
      read_write: [
        SUPABASE_TOOLS.execute_sql,
        SUPABASE_TOOLS.list_tables,
        SUPABASE_TOOLS.list_extensions,
        SUPABASE_TOOLS.list_migrations,
        SUPABASE_TOOLS.get_logs,
        SUPABASE_TOOLS.search_docs,
      ],
      read_only: [
        SUPABASE_TOOLS.list_tables,
        SUPABASE_TOOLS.list_extensions,
        SUPABASE_TOOLS.get_logs,
        SUPABASE_TOOLS.search_docs,
      ],
      none: [],
    },
  },

  stitch: {
    create: (): McpStdioServerConfig | null => {
      if (!process.env.STITCH_API_KEY) return null;
      return {
        command: 'npx',
        args: ['@_davideast/stitch-mcp', 'proxy'],
        env: {
          STITCH_API_KEY: process.env.STITCH_API_KEY,
          CLOUDSDK_CONFIG: path.join(os.homedir(), '.stitch-mcp', 'config'),
          GOOGLE_CLOUD_PROJECT: 'gen-lang-client-0353417824',
        },
      };
    },
    toolsByAccess: {
      full: Object.values(STITCH_TOOLS),
      read_write: Object.values(STITCH_TOOLS),
      read_only: [
        STITCH_TOOLS.list_projects,
        STITCH_TOOLS.get_project,
        STITCH_TOOLS.list_screens,
        STITCH_TOOLS.get_screen,
        STITCH_TOOLS.list_design_systems,
      ],
      none: [],
    },
  },
};

// ── 봇별 접근 매트릭스 (DB-driven, fallback 포함) ──

const FALLBACK_MCP_ACCESS: Record<string, BotMcpAccess[]> = {
  semiclaw: [
    { serverName: 'slack', accessLevel: 'read_write' },
    { serverName: 'supabase', accessLevel: 'read_only' },
  ],
  planclaw: [{ serverName: 'slack', accessLevel: 'read_only' }],
  designclaw: [
    { serverName: 'slack', accessLevel: 'read_only' },
    { serverName: 'stitch', accessLevel: 'full' },
  ],
  workclaw: [
    { serverName: 'slack', accessLevel: 'read_only' },
    { serverName: 'supabase', accessLevel: 'read_write' },
  ],
  reviewclaw: [{ serverName: 'slack', accessLevel: 'read_only' }],
  infraclaw: [
    { serverName: 'slack', accessLevel: 'read_only' },
    { serverName: 'supabase', accessLevel: 'full' },
  ],
  growthclaw: [{ serverName: 'slack', accessLevel: 'read_only' }],
  incubator: [{ serverName: 'slack', accessLevel: 'read_only' }],
};

let _botMcpAccess: Record<string, BotMcpAccess[]> = { ...FALLBACK_MCP_ACCESS };

export async function loadMcpAccessFromDb(pool: Pool): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT bot_id, config->'mcp_access' AS mcp_access
       FROM ${DB_SCHEMA}.bot_status
       WHERE config->'mcp_access' IS NOT NULL
         AND jsonb_array_length(config->'mcp_access') > 0`,
    );
    if (result.rows.length > 0) {
      const loaded: Record<string, BotMcpAccess[]> = {};
      for (const row of result.rows) {
        const entries = row.mcp_access as Array<{ server: string; access: string }>;
        loaded[row.bot_id] = entries.map((e) => ({
          serverName: e.server,
          accessLevel: e.access as McpAccessLevel,
        }));
      }
      _botMcpAccess = loaded;
      console.log(`[mcp-config] Loaded MCP access for ${result.rows.length} bots from DB`);
    }
  } catch (err) {
    console.warn('[mcp-config] DB load failed, using fallback:', err);
  }
}

// ── 공개 API ──

export function resolveMcpForBot(botId: string): {
  servers: Record<string, McpServerConfig>;
  allowedTools: string[];
} {
  const accessList = _botMcpAccess[botId] || [];
  const servers: Record<string, McpServerConfig> = {};
  const allowedTools: string[] = [];

  for (const { serverName, accessLevel } of accessList) {
    if (accessLevel === 'none') continue;
    const def = MCP_SERVERS[serverName];
    if (!def) continue;
    const config = def.create();
    if (!config) continue;
    servers[serverName] = config;
    allowedTools.push(...def.toolsByAccess[accessLevel]);
  }

  return { servers, allowedTools };
}
