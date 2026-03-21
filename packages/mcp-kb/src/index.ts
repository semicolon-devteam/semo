#!/usr/bin/env node
/**
 * SEMO KB MCP Server
 *
 * Knowledge Base 실시간 벡터 검색 MCP 서버.
 * .claude/memory/*.md 파일 생성을 대체하여 DB 직접 조회로 통일.
 *
 * 환경변수 (자동 로드: ~/.semo.env):
 *   DATABASE_URL  — PostgreSQL 연결 (필수)
 *   OPENAI_API_KEY — 임베딩 생성 (선택, 없으면 텍스트 검색만)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { getPool, closePool } from "./lib/database.js";
import {
  kbSearch,
  kbGet,
  kbList,
  kbUpsert,
  fetchBotStatus,
  ontoList,
  ontoShow,
  kbDigest,
} from "./lib/kb.js";
import { KB_TOOLS } from "./tools.js";

// ============================================================
// Server
// ============================================================

const server = new Server(
  { name: "semo-kb", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// --- List Tools ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: KB_TOOLS };
});

// --- Call Tool ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const pool = getPool();

  try {
    switch (name) {
      // ── kb_search ──────────────────────────────────────────
      case "kb_search": {
        const query = args?.query as string;
        if (!query) throw new Error("query 파라미터가 필요합니다");

        const results = await kbSearch(pool, query, {
          domain: args?.domain as string | undefined,
          limit: (args?.limit as number) || 10,
          mode: (args?.mode as "semantic" | "text" | "hybrid") || "hybrid",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: results.length,
                  results: results.map((r) => ({
                    domain: r.domain,
                    key: r.key,
                    content: r.content,
                    score: r.score,
                    updated_at: r.updated_at,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // ── kb_get ─────────────────────────────────────────────
      case "kb_get": {
        const domain = args?.domain as string;
        const key = args?.key as string;
        if (!domain || !key)
          throw new Error("domain, key 파라미터가 필요합니다");

        const entry = await kbGet(pool, domain, key);
        if (!entry) {
          return {
            content: [
              { type: "text", text: `항목 없음: ${domain}/${key}` },
            ],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
        };
      }

      // ── kb_list ────────────────────────────────────────────
      case "kb_list": {
        const entries = await kbList(pool, {
          domain: args?.domain as string | undefined,
          limit: (args?.limit as number) || 50,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: entries.length,
                  entries: entries.map((e) => ({
                    domain: e.domain,
                    key: e.key,
                    content:
                      e.content.length > 200
                        ? e.content.substring(0, 200) + "..."
                        : e.content,
                    version: e.version,
                    updated_at: e.updated_at,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // ── kb_upsert ──────────────────────────────────────────
      case "kb_upsert": {
        const domain = args?.domain as string;
        const key = args?.key as string;
        const content = args?.content as string;
        if (!domain || !key || !content)
          throw new Error("domain, key, content 파라미터가 필요합니다");

        const result = await kbUpsert(pool, {
          domain,
          key,
          content,
          metadata: args?.metadata as Record<string, unknown> | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `upsert 실패: ${result.error}`,
              },
            ],
          };
        }

        let msg = `upsert 완료: ${domain}/${key} (임베딩 ${process.env.OPENAI_API_KEY ? "생성됨" : "건너뜀 (OPENAI_API_KEY 없음)"})`;
        if (result.warnings && result.warnings.length > 0) {
          msg += `\n\n온톨로지 힌트:\n${result.warnings.join('\n')}`;
        }

        return {
          content: [
            {
              type: "text",
              text: msg,
            },
          ],
        };
      }

      // ── kb_bot_status ──────────────────────────────────────
      case "kb_bot_status": {
        const rows = await fetchBotStatus(pool);

        if (rows.length === 0) {
          return {
            content: [{ type: "text", text: "봇 상태 데이터 없음" }],
          };
        }

        const table = rows.map((r) => ({
          bot_id: r.bot_id,
          name: [r.emoji, r.name].filter(Boolean).join(" ") || r.bot_id,
          role: r.role,
          status: r.status,
          last_active: r.last_active,
          session_count: r.session_count,
        }));

        return {
          content: [
            { type: "text", text: JSON.stringify(table, null, 2) },
          ],
        };
      }

      // ── kb_ontology ────────────────────────────────────────
      case "kb_ontology": {
        const domain = args?.domain as string | undefined;

        if (domain) {
          const onto = await ontoShow(pool, domain);
          if (!onto) {
            return {
              content: [
                { type: "text", text: `온톨로지 도메인 없음: ${domain}` },
              ],
            };
          }
          return {
            content: [
              { type: "text", text: JSON.stringify(onto, null, 2) },
            ],
          };
        }

        const all = await ontoList(pool);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: all.length,
                  domains: all.map((d) => ({
                    domain: d.domain,
                    description: d.description,
                    version: d.version,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // ── kb_digest ──────────────────────────────────────────
      case "kb_digest": {
        const since = args?.since as string;
        if (!since) throw new Error("since 파라미터가 필요합니다");

        const digest = await kbDigest(pool, since, args?.domain as string | undefined);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  since: digest.since,
                  changeCount: digest.changes.length,
                  changes: digest.changes.map((c) => ({
                    domain: c.domain,
                    key: c.key,
                    change_type: c.change_type,
                    version: c.version,
                    content:
                      c.content.length > 300
                        ? c.content.substring(0, 300) + "..."
                        : c.content,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `[semo-kb] 오류: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================
// Lifecycle
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[semo-kb] MCP Server v1.0.0 started");
}

async function shutdown() {
  console.error("[semo-kb] Shutting down...");
  await closePool();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  console.error("[semo-kb] Fatal error:", error);
  process.exit(1);
});
