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

// 환경 변수
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7";
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "C09KNL91QBZ";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// 서버 초기화
const server = new Server(
  {
    name: "semo-integrations",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// === Tools ===

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // === Slack Integration ===
      {
        name: "slack_send_message",
        description: "Slack 채널에 메시지를 전송합니다. (semo-integrations/slack/notify)",
        inputSchema: {
          type: "object",
          properties: {
            channel: {
              type: "string",
              description: "채널 ID 또는 이름 (예: 'C09KNL91QBZ' 또는 '#_협업')",
            },
            text: {
              type: "string",
              description: "메시지 텍스트",
            },
            blocks: {
              type: "string",
              description: "Block Kit JSON (선택사항)",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "slack_lookup_user",
        description: "Slack 사용자 ID를 조회합니다. 멘션용 ID를 얻을 때 사용합니다.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "사용자 display_name, name, 또는 real_name",
            },
          },
          required: ["name"],
        },
      },
      // === GitHub Integration ===
      {
        name: "github_create_issue",
        description: "GitHub 이슈를 생성합니다. (semo-integrations/github/issues)",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "레포지토리 (예: 'semicolon-devteam/semo')",
            },
            title: {
              type: "string",
              description: "이슈 제목",
            },
            body: {
              type: "string",
              description: "이슈 본문",
            },
            labels: {
              type: "string",
              description: "라벨 (쉼표 구분)",
            },
          },
          required: ["repo", "title", "body"],
        },
      },
      {
        name: "github_create_pr",
        description: "GitHub PR을 생성합니다. (semo-integrations/github/pr)",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "레포지토리 (예: 'semicolon-devteam/semo')",
            },
            title: {
              type: "string",
              description: "PR 제목",
            },
            body: {
              type: "string",
              description: "PR 본문",
            },
            head: {
              type: "string",
              description: "소스 브랜치",
            },
            base: {
              type: "string",
              description: "타겟 브랜치 (기본: main)",
            },
          },
          required: ["repo", "title", "head"],
        },
      },
      // === Supabase Integration ===
      {
        name: "supabase_query",
        description: "Supabase 테이블을 조회합니다. (semo-integrations/supabase/query)",
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "테이블 이름",
            },
            select: {
              type: "string",
              description: "조회할 컬럼 (기본: *)",
            },
            filter: {
              type: "string",
              description: "필터 조건 (예: 'id.eq.1')",
            },
            limit: {
              type: "number",
              description: "결과 개수 제한",
            },
          },
          required: ["table"],
        },
      },
      // === SEMO Orchestration ===
      {
        name: "semo_route",
        description: "SEMO Orchestrator - 요청을 분석하여 적절한 Skill로 라우팅합니다.",
        inputSchema: {
          type: "object",
          properties: {
            request: {
              type: "string",
              description: "사용자 요청",
            },
          },
          required: ["request"],
        },
      },
    ],
  };
});

// 도구 실행
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // === Slack Tools ===
    case "slack_send_message": {
      const channel = (args?.channel as string) || SLACK_CHANNEL_ID;
      const text = args?.text as string;
      const blocksJson = args?.blocks as string;

      try {
        const body: Record<string, unknown> = { channel, text };
        if (blocksJson) {
          body.blocks = JSON.parse(blocksJson);
        }

        const response = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(body),
        });

        const result = await response.json() as { ok: boolean; error?: string; ts?: string };

        if (result.ok) {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Integration: slack/notify 완료\n\n✅ 메시지 전송 성공\n채널: ${channel}\nts: ${result.ts}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Integration: slack/notify 실패\n\n❌ 오류: ${result.error}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: slack/notify 오류\n\n❌ ${error}`,
            },
          ],
        };
      }
    }

    case "slack_lookup_user": {
      const searchName = args?.name as string;

      try {
        const response = await fetch("https://slack.com/api/users.list", {
          headers: {
            "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
          },
        });

        const result = await response.json() as {
          ok: boolean;
          members?: Array<{
            id: string;
            name: string;
            real_name: string;
            deleted: boolean;
            is_bot: boolean;
            profile: { display_name: string };
          }>;
        };

        if (result.ok && result.members) {
          const user = result.members.find(
            (m) =>
              !m.deleted &&
              !m.is_bot &&
              (m.profile.display_name.toLowerCase() === searchName.toLowerCase() ||
                m.name.toLowerCase() === searchName.toLowerCase() ||
                m.real_name.toLowerCase() === searchName.toLowerCase())
          );

          if (user) {
            return {
              content: [
                {
                  type: "text",
                  text: `[SEMO] Slack 사용자 조회 완료\n\nID: ${user.id}\n이름: ${user.profile.display_name || user.name}\n멘션: <@${user.id}>`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `[SEMO] 사용자 '${searchName}'을 찾을 수 없습니다.`,
                },
              ],
            };
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Slack API 오류`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] 오류: ${error}`,
            },
          ],
        };
      }
    }

    // === GitHub Tools ===
    case "github_create_issue": {
      const repo = args?.repo as string;
      const title = args?.title as string;
      const body = args?.body as string;
      const labels = args?.labels as string;

      if (!GITHUB_TOKEN) {
        // gh CLI 사용 (토큰 없는 경우)
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: github/issues\n\n다음 명령어로 이슈를 생성하세요:\n\ngh issue create --repo ${repo} --title "${title}" --body "${body}"${labels ? ` --label "${labels}"` : ""}`,
            },
          ],
        };
      }

      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: {
            "Authorization": `token ${GITHUB_TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            title,
            body,
            labels: labels ? labels.split(",").map((l) => l.trim()) : undefined,
          }),
        });

        const result = await response.json() as { html_url?: string; number?: number; message?: string };

        if (result.html_url) {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Integration: github/issues 완료\n\n✅ 이슈 생성됨: #${result.number}\n${result.html_url}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Integration: github/issues 실패\n\n❌ ${result.message}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: github/issues 오류\n\n❌ ${error}`,
            },
          ],
        };
      }
    }

    case "github_create_pr": {
      const repo = args?.repo as string;
      const title = args?.title as string;
      const body = (args?.body as string) || "";
      const head = args?.head as string;
      const base = (args?.base as string) || "main";

      if (!GITHUB_TOKEN) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: github/pr\n\n다음 명령어로 PR을 생성하세요:\n\ngh pr create --repo ${repo} --title "${title}" --body "${body}" --head ${head} --base ${base}`,
            },
          ],
        };
      }

      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
          method: "POST",
          headers: {
            "Authorization": `token ${GITHUB_TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/vnd.github.v3+json",
          },
          body: JSON.stringify({ title, body, head, base }),
        });

        const result = await response.json() as { html_url?: string; number?: number; message?: string };

        if (result.html_url) {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Integration: github/pr 완료\n\n✅ PR 생성됨: #${result.number}\n${result.html_url}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Integration: github/pr 실패\n\n❌ ${result.message}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: github/pr 오류\n\n❌ ${error}`,
            },
          ],
        };
      }
    }

    // === Supabase Tools ===
    case "supabase_query": {
      const table = args?.table as string;
      const select = (args?.select as string) || "*";
      const filter = args?.filter as string;
      const limit = args?.limit as number;

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: supabase/query\n\n❌ SUPABASE_URL 및 SUPABASE_KEY 환경변수가 필요합니다.`,
            },
          ],
        };
      }

      try {
        let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
        if (filter) url += `&${filter}`;
        if (limit) url += `&limit=${limit}`;

        const response = await fetch(url, {
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
          },
        });

        const result = await response.json();

        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: supabase/query 완료\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: supabase/query 오류\n\n❌ ${error}`,
            },
          ],
        };
      }
    }

    // === SEMO Orchestration ===
    case "semo_route": {
      const userRequest = args?.request as string;

      // 의도 분류
      const intents = [
        { pattern: /슬랙|slack|알림|notify/i, skill: "slack/notify" },
        { pattern: /이슈|issue|버그|bug/i, skill: "github/issues" },
        { pattern: /pr|pull.?request|머지/i, skill: "github/pr" },
        { pattern: /쿼리|query|조회|supabase/i, skill: "supabase/query" },
        { pattern: /구현|implement|코드|개발/i, skill: "coder/implement" },
        { pattern: /테스트|test|검증/i, skill: "tester/execute" },
        { pattern: /기획|epic|스프린트/i, skill: "planner/epic" },
      ];

      let matchedSkill = "orchestrator";
      for (const intent of intents) {
        if (intent.pattern.test(userRequest)) {
          matchedSkill = intent.skill;
          break;
        }
      }

      // 플랫폼 자동 감지 (coder인 경우)
      let platform = "";
      if (matchedSkill.startsWith("coder/")) {
        platform = " (platform: auto-detect)";
      }

      return {
        content: [
          {
            type: "text",
            text: `[SEMO] Orchestrator: 의도 분석 완료 → ${matchedSkill}${platform}

[SEMO] Skill 위임: semo-skills/${matchedSkill}

요청: ${userRequest}`,
          },
        ],
      };
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
                layer: "Layer 2 (External Connections)",
                type: "Black Box (MCP)",
                integrations: [
                  {
                    name: "github",
                    modules: ["issues", "pr", "actions"],
                    tools: ["github_create_issue", "github_create_pr"],
                  },
                  {
                    name: "slack",
                    modules: ["notify", "feedback"],
                    tools: ["slack_send_message", "slack_lookup_user"],
                  },
                  {
                    name: "supabase",
                    modules: ["query", "sync"],
                    tools: ["supabase_query"],
                  },
                ],
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
  console.error("[SEMO MCP] Server v2.0.0 started (Hybrid Strategy)");
  console.error("[SEMO MCP] Integrations: github, slack, supabase");
}

main().catch((error) => {
  console.error("[SEMO MCP] Fatal error:", error);
  process.exit(1);
});
