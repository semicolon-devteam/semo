#!/usr/bin/env node
/**
 * SEMO MCP Server
 *
 * Gemini 하이브리드 전략에 따른 Black Box 영역
 * - semo-integrations (GitHub, Slack, Supabase) 도구를 MCP로 제공
 * - 토큰/시크릿 격리로 보안 강화
 *
 * 설치:
 *   npx @semicolon/semo-mcp
 *
 * Claude Code 설정 (.claude/settings.json):
 *   {
 *     "mcpServers": {
 *       "semo-integrations": {
 *         "command": "npx",
 *         "args": ["-y", "@semicolon/semo-mcp"],
 *         "env": {
 *           "GITHUB_TOKEN": "${GITHUB_TOKEN}",
 *           "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { decrypt } from "./crypto.js";

// 토큰 로드 (CI/CD 생성 파일 우선, 없으면 환경변수)
function loadTokens(): { SLACK_BOT_TOKEN: string; GITHUB_APP_TOKEN: string } {
  try {
    // CI/CD에서 생성된 암호화 토큰 (배포 패키지용)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const generated = require("./tokens.generated.js");
    if (generated.ENCRYPTED_TOKENS?.SLACK_BOT_TOKEN) {
      return generated.ENCRYPTED_TOKENS;
    }
  } catch {
    // tokens.generated.js 없음 - 로컬 개발 환경
  }

  // 로컬 개발용 (환경변수 기반)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fallback = require("./tokens.js");
  return fallback.ENCRYPTED_TOKENS;
}

// Slack 토큰 조회 (암호화된 토큰 복호화 또는 환경변수)
function getSlackToken(): string {
  // 1. 환경변수 우선 (사용자 커스텀)
  if (process.env.SLACK_BOT_TOKEN) {
    return process.env.SLACK_BOT_TOKEN;
  }

  // 2. 암호화된 팀 토큰 (패키지 내장)
  try {
    const tokens = loadTokens();
    if (tokens.SLACK_BOT_TOKEN) {
      return decrypt(tokens.SLACK_BOT_TOKEN);
    }
  } catch {
    // 토큰 로드 실패
  }

  return "";
}

// 서버 초기화
const server = new Server(
  {
    name: "semo-integrations",
    version: "3.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// === Tools ===
// v3.0.1: semo_get_slack_token 복원 (암호화된 팀 토큰 제공)
// GitHub/Supabase는 gh/supabase CLI 사용

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // === Slack Token (팀 공용 토큰 제공) ===
      {
        name: "semo_get_slack_token",
        description: "MCP 서버에서 관리하는 Slack Bot Token을 조회합니다. notify-slack 스킬에서 curl 호출 시 사용합니다.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      // === SEMO Remote (semo-remote 패키지) ===
      {
        name: "semo_remote_request",
        description: "원격 요청을 생성합니다. 모바일 PWA에서 응답을 기다립니다. (semo-remote 패키지 전용)",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "현재 세션 ID",
            },
            type: {
              type: "string",
              enum: ["permission", "user_question", "text_input", "selection"],
              description: "요청 유형",
            },
            message: {
              type: "string",
              description: "표시할 메시지",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description: "선택지 (selection 타입 시)",
            },
            tool_name: {
              type: "string",
              description: "도구 이름 (permission 타입 시)",
            },
          },
          required: ["session_id", "type", "message"],
        },
      },
      {
        name: "semo_remote_respond",
        description: "원격 요청에 응답합니다. (모바일 PWA에서 호출)",
        inputSchema: {
          type: "object",
          properties: {
            request_id: {
              type: "string",
              description: "요청 ID",
            },
            response: {
              type: "string",
              description: "응답 내용",
            },
            status: {
              type: "string",
              enum: ["approved", "denied", "responded"],
              description: "응답 상태",
            },
          },
          required: ["request_id", "status"],
        },
      },
      {
        name: "semo_remote_pending",
        description: "대기 중인 원격 요청을 조회합니다.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "세션 ID로 필터 (선택)",
            },
            limit: {
              type: "number",
              description: "결과 개수 (기본: 10)",
            },
          },
          required: [],
        },
      },
    ],
  };
});

// DB 연결 가능 여부 확인 (Remote 도구용)
function isDbEnabled(): boolean {
  return !!process.env.SEMO_DB_PASSWORD;
}

// 도구 실행
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // === Slack Token Tool ===
    case "semo_get_slack_token": {
      const token = getSlackToken();
      if (token) {
        return {
          content: [
            {
              type: "text",
              text: `token:${token}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Slack Token 조회 실패\n\n❌ SLACK_BOT_TOKEN 환경변수 또는 암호화된 토큰이 설정되지 않았습니다.`,
            },
          ],
        };
      }
    }

    // === SEMO Remote Tools ===
    case "semo_remote_request": {
      if (!isDbEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] ❌ DB 연결이 필요합니다.\nSEMO_DB_PASSWORD 환경변수를 설정하세요.`,
            },
          ],
        };
      }

      const sessionId = args?.session_id as string;
      const reqType = args?.type as string;
      const message = args?.message as string;
      const options = args?.options as string[] | undefined;
      const toolName = args?.tool_name as string | undefined;

      try {
        const { Pool } = await import("pg");
        const pool = new Pool({
          host: process.env.SEMO_DB_HOST || "3.38.162.21",
          port: parseInt(process.env.SEMO_DB_PORT || "5432"),
          database: process.env.SEMO_DB_NAME || "appdb",
          user: process.env.SEMO_DB_USER || "app",
          password: process.env.SEMO_DB_PASSWORD,
        });

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분

        const result = await pool.query(`
          INSERT INTO remote_requests
            (session_id, type, tool_name, message, options, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [sessionId, reqType, toolName, message, options ? JSON.stringify(options) : null, expiresAt.toISOString()]);

        await pool.end();

        const requestId = result.rows[0]?.id;

        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] ✅ 원격 요청 생성됨\n\nID: ${requestId}\n유형: ${reqType}\n메시지: ${message}\n만료: 5분`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] ❌ 요청 생성 실패: ${error}`,
            },
          ],
        };
      }
    }

    case "semo_remote_respond": {
      if (!isDbEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] ❌ DB 연결이 필요합니다.`,
            },
          ],
        };
      }

      const requestId = args?.request_id as string;
      const response = args?.response as string | undefined;
      const status = args?.status as string;

      try {
        const { Pool } = await import("pg");
        const pool = new Pool({
          host: process.env.SEMO_DB_HOST || "3.38.162.21",
          port: parseInt(process.env.SEMO_DB_PORT || "5432"),
          database: process.env.SEMO_DB_NAME || "appdb",
          user: process.env.SEMO_DB_USER || "app",
          password: process.env.SEMO_DB_PASSWORD,
        });

        await pool.query(`
          UPDATE remote_requests
          SET status = $2, response = $3, responded_at = NOW()
          WHERE id = $1 AND status = 'pending'
        `, [requestId, status, response]);

        await pool.end();

        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] ✅ 응답 처리됨\n\nID: ${requestId}\n상태: ${status}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] ❌ 응답 처리 실패: ${error}`,
            },
          ],
        };
      }
    }

    case "semo_remote_pending": {
      if (!isDbEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] ❌ DB 연결이 필요합니다.`,
            },
          ],
        };
      }

      const sessionId = args?.session_id as string | undefined;
      const limit = (args?.limit as number) || 10;

      try {
        const { Pool } = await import("pg");
        const pool = new Pool({
          host: process.env.SEMO_DB_HOST || "3.38.162.21",
          port: parseInt(process.env.SEMO_DB_PORT || "5432"),
          database: process.env.SEMO_DB_NAME || "appdb",
          user: process.env.SEMO_DB_USER || "app",
          password: process.env.SEMO_DB_PASSWORD,
        });

        let query = `
          SELECT id, session_id, type, tool_name, message, created_at
          FROM remote_requests
          WHERE status = 'pending'
            AND (expires_at IS NULL OR expires_at > NOW())
        `;
        const params: (string | number)[] = [];

        if (sessionId) {
          params.push(sessionId);
          query += ` AND session_id = $${params.length}`;
        }

        params.push(limit);
        query += ` ORDER BY created_at ASC LIMIT $${params.length}`;

        const result = await pool.query(query, params);
        await pool.end();

        if (result.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO Remote] ✅ 대기 중인 요청 없음`,
              },
            ],
          };
        }

        const formatted = result.rows.map((r: { id: string; type: string; message: string; created_at: Date }) =>
          `• ${r.id.substring(0, 8)}... [${r.type}] ${r.message.substring(0, 50)}`
        ).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] 대기 중인 요청 (${result.rows.length}건)\n\n${formatted}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Remote] ❌ 조회 실패: ${error}`,
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// === Resources ===

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "semo://integrations",
        name: "SEMO Integrations",
        description: "사용 가능한 외부 연동 목록",
        mimeType: "application/json",
      },
      {
        uri: "semo://skills",
        name: "SEMO Skills",
        description: "사용 가능한 Skill 목록 (White Box)",
        mimeType: "application/json",
      },
      {
        uri: "semo://commands",
        name: "SEMO Commands",
        description: "사용 가능한 커맨드 목록",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "semo://integrations":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                version: "3.1.0",
                layer: "Layer 2 (External Connections)",
                type: "Black Box (MCP)",
                integrations: [
                  {
                    name: "slack-token",
                    description: "Slack API 호출용 팀 공용 토큰 제공",
                    tools: ["semo_get_slack_token"],
                    usage: "notify-slack 스킬에서 자동으로 호출됨",
                  },
                  {
                    name: "remote",
                    modules: ["request", "respond", "pending"],
                    tools: ["semo_remote_request", "semo_remote_respond", "semo_remote_pending"],
                  },
                ],
                removed_v3: {
                  reason: "스킬에서 CLI 직접 호출 방식으로 전환",
                  tools: [
                    { name: "supabase_query", migration: "supabase CLI" },
                    { name: "semo_route", migration: "Orchestrator 서브에이전트" },
                    { name: "slack_send_message", migration: "skill:notify-slack 사용" },
                    { name: "slack_lookup_user", migration: "skill:notify-slack 사용" },
                    { name: "slack_list_channels", migration: "skill:notify-slack 사용" },
                    { name: "slack_find_channel", migration: "skill:notify-slack 사용" },
                    { name: "github_create_issue", migration: "gh issue create" },
                    { name: "github_create_pr", migration: "gh pr create" },
                  ],
                },
              },
              null,
              2
            ),
          },
        ],
      };

    case "semo://skills":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                layer: "Layer 1 (Capabilities)",
                type: "White Box (Filesystem)",
                skills: [
                  { name: "coder", modules: ["implement", "scaffold", "review", "verify"] },
                  { name: "tester", modules: ["execute", "report", "validate"] },
                  { name: "planner", modules: ["epic", "task", "sprint", "roadmap"] },
                  { name: "writer", modules: ["spec", "docx", "handoff"] },
                  { name: "deployer", modules: ["deploy", "rollback", "compose"] },
                ],
              },
              null,
              2
            ),
          },
        ],
      };

    case "semo://commands":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                commands: [
                  { name: "/SEMO:help", description: "도움말" },
                  { name: "/SEMO:slack", description: "Slack 메시지" },
                  { name: "/SEMO:feedback", description: "피드백 제출" },
                  { name: "/SEMO:update", description: "업데이트" },
                  { name: "/SEMO:audit", description: "품질 감사" },
                  { name: "/SEMO:health", description: "환경 검증" },
                ],
              },
              null,
              2
            ),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[SEMO MCP] Server v3.1.0 started");
  console.error("[SEMO MCP] Integrations: slack-token, remote");
  console.error("[SEMO MCP] v3.1.0: Long-term Memory 기능 제거");
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.error("[SEMO MCP] Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("[SEMO MCP] Terminating...");
  process.exit(0);
});

main().catch((error) => {
  console.error("[SEMO MCP] Fatal error:", error);
  process.exit(1);
});
