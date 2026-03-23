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
  ontoListTypes,
  ontoListServices,
  ontoListInstances,
  ontoListSchema,
  kbDigest,
  logQuery,
  workspaceCheck,
  workspaceList,
  workspaceRules,
} from "./lib/kb.js";
import { KB_TOOLS } from "./tools.js";

// ============================================================
// Server
// ============================================================

const server = new Server(
  { name: "semo-kb", version: "1.2.0" },
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
          service: args?.service as string | undefined,
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
          service: args?.service as string | undefined,
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
        const action = (args?.action as string) || "list";
        const domain = args?.domain as string | undefined;

        switch (action) {
          case "show": {
            if (!domain) throw new Error("action='show'에는 domain 파라미터가 필요합니다");
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

          case "services": {
            const services = await ontoListServices(pool);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { count: services.length, services },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "types": {
            const types = await ontoListTypes(pool);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      count: types.length,
                      types: types.map((t) => ({
                        type_key: t.type_key,
                        description: t.description,
                        version: t.version,
                      })),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "instances": {
            const instances = await ontoListInstances(pool);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      count: instances.length,
                      instances: instances.map((i) => ({
                        domain: i.domain,
                        description: i.description,
                        scoped_domains: i.scoped_domains,
                        entry_count: i.entry_count,
                      })),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "schema": {
            const typeKey = args?.type as string;
            if (!typeKey) throw new Error("action='schema'에는 type 파라미터가 필요합니다");
            const schemaEntries = await ontoListSchema(pool, typeKey);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      type: typeKey,
                      count: schemaEntries.length,
                      keys: schemaEntries.map((s) => ({
                        key: s.scheme_key,
                        description: s.scheme_description,
                        required: s.required,
                        hint: s.value_hint,
                      })),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "list":
          default: {
            // If domain is provided, show that domain's detail (backward compat)
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

            // Group by service (_global treated as global)
            const global = all.filter((d) => !d.service || d.service === "_global");
            const byService: Record<string, typeof all> = {};
            for (const d of all) {
              if (d.service && d.service !== "_global") {
                if (!byService[d.service]) byService[d.service] = [];
                byService[d.service].push(d);
              }
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      count: all.length,
                      global: global.map((d) => ({
                        domain: d.domain,
                        entity_type: d.entity_type,
                        description: d.description,
                        version: d.version,
                      })),
                      services: Object.entries(byService).map(([svc, domains]) => ({
                        service: svc,
                        domains: domains.map((d) => ({
                          domain: d.domain,
                          entity_type: d.entity_type,
                          description: d.description,
                        })),
                      })),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }
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

      // ── kb_log_query ─────────────────────────────────────────
      case "kb_log_query": {
        const bot_id = args?.bot_id as string;
        const query = args?.query as string;
        if (!bot_id || !query)
          throw new Error("bot_id, query 파라미터가 필요합니다");

        const result = await logQuery(pool, {
          bot_id,
          query,
          response: args?.response as string | undefined,
          user_id: args?.user_id as string | undefined,
          user_name: args?.user_name as string | undefined,
          channel: args?.channel as string | undefined,
          channel_id: args?.channel_id as string | undefined,
          thread_id: args?.thread_id as string | undefined,
          model: args?.model as string | undefined,
          latency_ms: args?.latency_ms as number | undefined,
          token_input: args?.token_input as number | undefined,
          token_output: args?.token_output as number | undefined,
          metadata: args?.metadata as Record<string, unknown> | undefined,
        });

        return {
          content: [
            {
              type: "text",
              text: result.success
                ? "query log 기록 완료"
                : `query log 실패 (무시됨): ${result.error}`,
            },
          ],
        };
      }

      // ── kb_workspace_standard ──────────────────────────────────
      case "kb_workspace_standard": {
        const action = (args?.action as string) || "check";

        switch (action) {
          case "check": {
            const pathArg = args?.path as string;
            if (!pathArg) throw new Error("action='check'에는 path 파라미터가 필요합니다");
            const result = await workspaceCheck(pool, pathArg, args?.bot_id as string | undefined);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }

          case "list": {
            const rows = await workspaceList(pool, {
              level: args?.level as string | undefined,
              category: args?.category as string | undefined,
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      count: rows.length,
                      rules: rows.map((r) => ({
                        path_pattern: r.path_pattern,
                        entry_type: r.entry_type,
                        level: r.level,
                        severity: r.severity,
                        category: r.category,
                        bot_scope: r.bot_scope,
                        description: r.description,
                      })),
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          case "rules": {
            const pathArg = args?.path as string;
            if (!pathArg) throw new Error("action='rules'에는 path 파라미터가 필요합니다");
            const rules = await workspaceRules(pool, pathArg);
            if (!rules) {
              return {
                content: [{ type: "text", text: `규칙 없음: ${pathArg}` }],
              };
            }
            return {
              content: [{ type: "text", text: JSON.stringify(rules, null, 2) }],
            };
          }

          default:
            throw new Error(`kb_workspace_standard: 알 수 없는 action '${action}'`);
        }
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
  console.error("[semo-kb] MCP Server v1.2.0 started");
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
