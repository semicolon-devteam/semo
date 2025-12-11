#!/usr/bin/env node
/**
 * SEMO MCP Server
 *
 * Claude Code에서 MCP 프로토콜을 통해 SEMO 에이전트/스킬을 사용할 수 있게 합니다.
 *
 * 설치:
 *   npx @semicolon/semo-mcp
 *
 * Claude Code 설정:
 *   .claude/mcp.json:
 *   {
 *     "mcpServers": {
 *       "semo": {
 *         "command": "npx",
 *         "args": ["-y", "@semicolon/semo-mcp"]
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

// 서버 초기화
const server = new Server(
  {
    name: "semo",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// === Tools ===

// 사용 가능한 도구 목록
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "semo_route",
        description:
          "SEMO Orchestrator - 요청을 분석하여 적절한 Agent/Skill로 라우팅합니다.",
        inputSchema: {
          type: "object",
          properties: {
            request: {
              type: "string",
              description: "사용자 요청 (예: '[next] API 버그 수정해줘')",
            },
          },
          required: ["request"],
        },
      },
      {
        name: "semo_slack",
        description: "Slack 채널에 메시지를 전송합니다.",
        inputSchema: {
          type: "object",
          properties: {
            channel: {
              type: "string",
              description: "Slack 채널 (예: '#_협업')",
            },
            message: {
              type: "string",
              description: "전송할 메시지",
            },
          },
          required: ["channel", "message"],
        },
      },
      {
        name: "semo_feedback",
        description: "SEMO에 대한 피드백을 제출합니다.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["bug", "feature", "improvement"],
              description: "피드백 유형",
            },
            title: {
              type: "string",
              description: "피드백 제목",
            },
            description: {
              type: "string",
              description: "상세 설명",
            },
          },
          required: ["type", "title", "description"],
        },
      },
    ],
  };
});

// 도구 실행
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "semo_route": {
      const userRequest = args?.request as string;

      // 접두사 파싱
      const prefixMatch = userRequest.match(/^\[([^\]]+)\]/);
      const prefix = prefixMatch ? prefixMatch[1] : null;

      // 라우팅 로직
      let targetPackage = "core";
      if (prefix) {
        const validPackages = [
          "next",
          "backend",
          "po",
          "qa",
          "pm",
          "design",
          "infra",
          "ms",
          "mvp",
          "meta",
          "core",
        ];
        if (validPackages.includes(prefix)) {
          targetPackage = prefix;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `[SEMO] Orchestrator: 의도 분석 완료 → ${targetPackage} 패키지

[SEMO] Agent 위임: semo-${targetPackage} (사유: 접두사 [${prefix || "없음"}] 감지)

요청: ${userRequest}`,
          },
        ],
      };
    }

    case "semo_slack": {
      const channel = args?.channel as string;
      const message = args?.message as string;

      // TODO: 실제 Slack API 연동
      return {
        content: [
          {
            type: "text",
            text: `[SEMO] Slack 메시지 전송 예정:
채널: ${channel}
메시지: ${message}

(실제 전송은 SLACK_WEBHOOK_URL 환경변수 설정 필요)`,
          },
        ],
      };
    }

    case "semo_feedback": {
      const type = args?.type as string;
      const title = args?.title as string;
      const description = args?.description as string;

      // TODO: GitHub Issue 생성
      return {
        content: [
          {
            type: "text",
            text: `[SEMO] 피드백 접수됨:
유형: ${type}
제목: ${title}
설명: ${description}

(GitHub Issue 생성은 GITHUB_TOKEN 환경변수 설정 필요)`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// === Resources ===

// 리소스 목록
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "semo://agents",
        name: "SEMO Agents",
        description: "사용 가능한 SEMO Agent 목록",
        mimeType: "application/json",
      },
      {
        uri: "semo://skills",
        name: "SEMO Skills",
        description: "사용 가능한 SEMO Skill 목록",
        mimeType: "application/json",
      },
      {
        uri: "semo://commands",
        name: "SEMO Commands",
        description: "사용 가능한 SEMO 커맨드 목록",
        mimeType: "application/json",
      },
    ],
  };
});

// 리소스 읽기
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "semo://agents":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                agents: [
                  { name: "orchestrator", description: "요청 라우팅" },
                  { name: "compliance-checker", description: "규칙 준수 검증" },
                  { name: "sax-architect", description: "패키지 구조 설계" },
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
                skills: [
                  { name: "notify-slack", description: "Slack 알림 전송" },
                  { name: "feedback", description: "피드백 수집" },
                  { name: "version-manager", description: "버전 관리" },
                  { name: "sax-help", description: "도움말" },
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
  console.error("[SEMO MCP] Server started");
}

main().catch((error) => {
  console.error("[SEMO MCP] Fatal error:", error);
  process.exit(1);
});
