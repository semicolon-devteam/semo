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

import { randomUUID } from "crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { decrypt } from "./crypto.js";
import {
  isMemoryEnabled,
  logInteraction,
  upsertSession,
  rememberFact,
  searchMemory,
  saveUserFact,
  getUserFacts,
  getRecentInteractions,
  getSystemStatus,
  closePool,
  processPendingEmbeddings,
  searchMemoryWithEmbedding,
} from "./memory.js";

// 토큰 로드 (CI/CD 생성 파일 우선, 없으면 기본 파일)
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

const ENCRYPTED_TOKENS = loadTokens();

function hasEncryptedToken(name: "SLACK_BOT_TOKEN" | "GITHUB_APP_TOKEN"): boolean {
  return !!ENCRYPTED_TOKENS[name];
}

// === 토큰 관리 ===
// 우선순위: 환경변수 > 암호화된 팀 토큰

// Slack 토큰 (팀 공용 토큰 자동 사용)
function getSlackToken(): string {
  // 1. 환경변수 우선
  if (process.env.SLACK_BOT_TOKEN) {
    return process.env.SLACK_BOT_TOKEN;
  }
  // 2. 암호화된 팀 토큰 사용
  if (hasEncryptedToken("SLACK_BOT_TOKEN")) {
    const decrypted = decrypt(ENCRYPTED_TOKENS.SLACK_BOT_TOKEN);
    if (decrypted) return decrypted;
  }
  // 3. 폴백 (개발용)
  return "";
}

// GitHub 토큰 (개인 토큰 필요)
function getGithubToken(): string {
  // 1. 환경변수 우선 (개인 토큰)
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  // 2. 암호화된 팀 토큰 (있는 경우)
  if (hasEncryptedToken("GITHUB_APP_TOKEN")) {
    const decrypted = decrypt(ENCRYPTED_TOKENS.GITHUB_APP_TOKEN);
    if (decrypted) return decrypted;
  }
  return "";
}

// 환경 변수
const SLACK_BOT_TOKEN = getSlackToken();
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "C09KNL91QBZ";
const GITHUB_TOKEN = getGithubToken();
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
      {
        name: "slack_list_channels",
        description: "Slack 채널 목록을 조회합니다. 채널명으로 검색하거나 전체 목록을 가져옵니다.",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "검색할 채널명 (부분 일치, 선택사항)",
            },
            limit: {
              type: "number",
              description: "반환할 최대 채널 수 (기본: 100)",
            },
          },
          required: [],
        },
      },
      {
        name: "slack_find_channel",
        description: "채널명으로 Slack 채널을 찾고, 없으면 Fallback 채널을 반환합니다. notify-slack에서 동적 채널 조회에 사용합니다.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "찾을 채널명 (예: 'semo', 'cm-labor-union')",
            },
            fallback: {
              type: "string",
              description: "Fallback 채널 (기본: '#_협업')",
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
      // === SEMO Memory (Long-term Memory) ===
      {
        name: "semo_remember",
        description: "중요한 정보를 장기 기억에 저장합니다. 사용자 선호도, 프로젝트 컨텍스트, 결정 사항 등을 저장할 때 사용합니다.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "사용자 ID (UUID)",
            },
            text: {
              type: "string",
              description: "저장할 정보",
            },
            type: {
              type: "string",
              enum: ["episodic", "semantic", "procedural"],
              description: "메모리 유형 (episodic: 경험, semantic: 지식, procedural: 절차)",
            },
            importance: {
              type: "number",
              description: "중요도 (0.0 ~ 2.0, 기본: 1.0)",
            },
          },
          required: ["user_id", "text"],
        },
      },
      {
        name: "semo_recall",
        description: "장기 기억에서 관련 정보를 검색합니다. 이전 대화, 사용자 선호도, 프로젝트 컨텍스트를 찾을 때 사용합니다.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "사용자 ID (UUID)",
            },
            query: {
              type: "string",
              description: "검색 쿼리",
            },
            limit: {
              type: "number",
              description: "결과 개수 (기본: 10)",
            },
          },
          required: ["user_id", "query"],
        },
      },
      {
        name: "semo_save_fact",
        description: "사용자에 대한 구조화된 정보를 저장합니다. (예: 선호 언어, 이름, 팀 등)",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "사용자 ID (UUID)",
            },
            key: {
              type: "string",
              description: "팩트 키 (예: 'preferred_language', 'team_name')",
            },
            value: {
              type: "string",
              description: "팩트 값",
            },
            category: {
              type: "string",
              description: "카테고리 (예: 'preference', 'profile', 'project')",
            },
          },
          required: ["user_id", "key", "value"],
        },
      },
      {
        name: "semo_get_facts",
        description: "사용자에 대한 저장된 팩트를 조회합니다.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "사용자 ID (UUID)",
            },
            category: {
              type: "string",
              description: "필터할 카테고리 (선택)",
            },
          },
          required: ["user_id"],
        },
      },
      {
        name: "semo_get_history",
        description: "최근 상호작용 히스토리를 조회합니다.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "사용자 ID (UUID)",
            },
            session_id: {
              type: "string",
              description: "세션 ID로 필터 (선택)",
            },
            limit: {
              type: "number",
              description: "결과 개수 (기본: 20)",
            },
          },
          required: ["user_id"],
        },
      },
      {
        name: "semo_memory_status",
        description: "SEMO 장기 기억 시스템 상태를 확인합니다.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      // === SEMO Embedding Pipeline ===
      {
        name: "semo_process_embeddings",
        description: "대기 중인 메모리에 대해 벡터 임베딩을 생성합니다. OpenAI API 키가 필요합니다.",
        inputSchema: {
          type: "object",
          properties: {
            openai_api_key: {
              type: "string",
              description: "OpenAI API 키 (또는 OPENAI_API_KEY 환경변수 사용)",
            },
            limit: {
              type: "number",
              description: "처리할 최대 개수 (기본: 10)",
            },
          },
          required: [],
        },
      },
      {
        name: "semo_recall_smart",
        description: "벡터 임베딩을 활용한 스마트 검색 (하이브리드: 벡터 + 텍스트 유사도). OpenAI API 키가 필요합니다.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "사용자 ID (UUID)",
            },
            query: {
              type: "string",
              description: "검색 쿼리",
            },
            openai_api_key: {
              type: "string",
              description: "OpenAI API 키 (또는 OPENAI_API_KEY 환경변수 사용)",
            },
            limit: {
              type: "number",
              description: "결과 개수 (기본: 10)",
            },
          },
          required: ["user_id", "query"],
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

// 도구 실행
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // === 자동 로깅: 모든 MCP 툴 호출 기록 ===
  if (isMemoryEnabled()) {
    const sessionId = process.env.SEMO_SESSION_ID || randomUUID();
    const userId = process.env.SEMO_USER_ID || "00000000-0000-0000-0000-000000000000";

    // 메모리 툴 자체는 로깅하지 않음 (무한 루프 방지)
    if (!name.startsWith("semo_")) {
      logInteraction({
        userId,
        sessionId,
        role: "assistant",
        content: `[MCP Tool] ${name}`,
        skillName: name,
        skillArgs: args as Record<string, unknown>,
        metadata: { type: "mcp_tool_call" },
      }).catch(() => {}); // fire-and-forget
    }
  }

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

    case "slack_list_channels": {
      const search = args?.search as string | undefined;
      const limit = (args?.limit as number) || 100;

      try {
        const response = await fetch(
          `https://slack.com/api/conversations.list?types=public_channel&limit=${Math.min(limit, 1000)}`,
          {
            headers: {
              "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
            },
          }
        );

        const result = await response.json() as {
          ok: boolean;
          error?: string;
          channels?: Array<{
            id: string;
            name: string;
            is_archived: boolean;
            num_members: number;
          }>;
        };

        if (result.ok && result.channels) {
          let channels = result.channels.filter((c) => !c.is_archived);

          if (search) {
            const searchLower = search.toLowerCase().replace(/^#_?/, "");
            channels = channels.filter((c) =>
              c.name.toLowerCase().includes(searchLower)
            );
          }

          const channelList = channels
            .slice(0, limit)
            .map((c) => `#${c.name} (${c.id}, ${c.num_members}명)`)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Slack 채널 목록 (${channels.length}개)\n\n${channelList || "검색 결과 없음"}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Slack 채널 조회 실패: ${result.error}`,
              },
            ],
          };
        }
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

    case "slack_find_channel": {
      const channelName = args?.name as string;
      const fallback = (args?.fallback as string) || "#_협업";

      try {
        const response = await fetch(
          "https://slack.com/api/conversations.list?types=public_channel&limit=1000",
          {
            headers: {
              "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
            },
          }
        );

        const result = await response.json() as {
          ok: boolean;
          error?: string;
          channels?: Array<{
            id: string;
            name: string;
            is_archived: boolean;
          }>;
        };

        if (result.ok && result.channels) {
          const activeChannels = result.channels.filter((c) => !c.is_archived);
          const searchName = channelName.toLowerCase().replace(/^#_?/, "");

          // 1차: 정확히 일치 (#{name})
          let found = activeChannels.find((c) => c.name.toLowerCase() === searchName);

          // 2차: 언더스코어 접두사 (#{_name})
          if (!found) {
            found = activeChannels.find((c) => c.name.toLowerCase() === `_${searchName}`);
          }

          // 3차: 부분 일치
          if (!found) {
            found = activeChannels.find((c) => c.name.toLowerCase().includes(searchName));
          }

          if (found) {
            return {
              content: [
                {
                  type: "text",
                  text: `[SEMO] 채널 찾음\n\n채널: #${found.name}\nID: ${found.id}\n상태: 사용 가능`,
                },
              ],
            };
          } else {
            // Fallback 채널 찾기
            const fallbackName = fallback.replace(/^#_?/, "");
            const fallbackChannel = activeChannels.find(
              (c) => c.name.toLowerCase() === fallbackName || c.name.toLowerCase() === `_${fallbackName}`
            );

            if (fallbackChannel) {
              return {
                content: [
                  {
                    type: "text",
                    text: `[SEMO] 채널 '${channelName}' 없음 → Fallback 사용\n\n채널: #${fallbackChannel.name}\nID: ${fallbackChannel.id}\n원래 요청: ${channelName}`,
                  },
                ],
              };
            } else {
              return {
                content: [
                  {
                    type: "text",
                    text: `[SEMO] 채널 '${channelName}' 및 Fallback '${fallback}' 모두 없음`,
                  },
                ],
              };
            }
          }
        } else {
          return {
            content: [
              {
                type: "text",
                text: `[SEMO] Slack API 오류: ${result.error}`,
              },
            ],
          };
        }
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

      // API 토큰이 있으면 직접 API 호출
      if (GITHUB_TOKEN) {
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

      // 토큰 없으면 gh CLI 사용 (직접 실행)
      try {
        const { execSync } = await import("child_process");
        const labelFlag = labels ? ` --label "${labels}"` : "";
        // body를 파일로 저장하여 긴 텍스트 처리
        const fs = await import("fs");
        const os = await import("os");
        const path = await import("path");
        const tmpFile = path.join(os.tmpdir(), `semo-issue-${Date.now()}.md`);
        fs.writeFileSync(tmpFile, body);

        const cmd = `gh issue create --repo ${repo} --title "${title.replace(/"/g, '\\"')}" --body-file "${tmpFile}"${labelFlag}`;
        const result = execSync(cmd, { encoding: "utf-8" });

        // 임시 파일 정리
        fs.unlinkSync(tmpFile);

        // gh issue create는 URL을 반환함
        const urlMatch = result.match(/https:\/\/github\.com\/[^\s]+/);
        const issueUrl = urlMatch ? urlMatch[0] : result.trim();
        const issueNumberMatch = issueUrl.match(/\/issues\/(\d+)/);
        const issueNumber = issueNumberMatch ? issueNumberMatch[1] : "?";

        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: github/issues 완료\n\n✅ 이슈 생성됨: #${issueNumber}\n${issueUrl}`,
            },
          ],
        };
      } catch (error) {
        // gh CLI 실패 시 명령어 안내
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: github/issues 오류\n\n❌ gh CLI 실행 실패: ${error}\n\n수동으로 이슈를 생성하세요:\ngh issue create --repo ${repo} --title "${title}" --body "..."${labels ? ` --label "${labels}"` : ""}`,
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

      // API 토큰이 있으면 직접 API 호출
      if (GITHUB_TOKEN) {
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

      // 토큰 없으면 gh CLI 사용 (직접 실행)
      try {
        const { execSync } = await import("child_process");
        const fs = await import("fs");
        const os = await import("os");
        const path = await import("path");
        const tmpFile = path.join(os.tmpdir(), `semo-pr-${Date.now()}.md`);
        fs.writeFileSync(tmpFile, body);

        const cmd = `gh pr create --repo ${repo} --title "${title.replace(/"/g, '\\"')}" --body-file "${tmpFile}" --head ${head} --base ${base}`;
        const result = execSync(cmd, { encoding: "utf-8" });

        fs.unlinkSync(tmpFile);

        const urlMatch = result.match(/https:\/\/github\.com\/[^\s]+/);
        const prUrl = urlMatch ? urlMatch[0] : result.trim();
        const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
        const prNumber = prNumberMatch ? prNumberMatch[1] : "?";

        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: github/pr 완료\n\n✅ PR 생성됨: #${prNumber}\n${prUrl}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO] Integration: github/pr 오류\n\n❌ gh CLI 실행 실패: ${error}\n\n수동으로 PR을 생성하세요:\ngh pr create --repo ${repo} --title "${title}" --body "..." --head ${head} --base ${base}`,
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

    // === SEMO Memory Tools ===
    case "semo_remember": {
      if (!isMemoryEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.\nSEMO_DB_PASSWORD 환경변수를 설정하세요.`,
            },
          ],
        };
      }

      const userId = args?.user_id as string;
      const text = args?.text as string;
      const type = (args?.type as string) || "semantic";
      const importance = (args?.importance as number) || 1.0;

      const memoryId = await rememberFact({
        userId,
        text,
        type: type as "episodic" | "semantic" | "procedural",
        importance,
      });

      if (memoryId) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ✅ 장기 기억에 저장됨\n\nID: ${memoryId}\n유형: ${type}\n중요도: ${importance}\n내용: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 저장 실패`,
            },
          ],
        };
      }
    }

    case "semo_recall": {
      if (!isMemoryEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
            },
          ],
        };
      }

      const userId = args?.user_id as string;
      const query = args?.query as string;
      const limit = (args?.limit as number) || 10;

      const results = await searchMemory({ userId, query, limit });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] 검색 결과 없음\n\n쿼리: "${query}"`,
            },
          ],
        };
      }

      const formatted = results.map((r, i) =>
        `${i + 1}. [${r.memoryType}] (유사도: ${(r.similarity * 100).toFixed(1)}%)\n   ${r.memoryText.substring(0, 200)}${r.memoryText.length > 200 ? "..." : ""}`
      ).join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `[SEMO Memory] 검색 결과 (${results.length}건)\n\n쿼리: "${query}"\n\n${formatted}`,
          },
        ],
      };
    }

    case "semo_save_fact": {
      if (!isMemoryEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
            },
          ],
        };
      }

      const userId = args?.user_id as string;
      const key = args?.key as string;
      const value = args?.value as string;
      const category = (args?.category as string) || "general";

      await saveUserFact({ userId, factKey: key, factValue: value, category });

      return {
        content: [
          {
            type: "text",
            text: `[SEMO Memory] ✅ 팩트 저장됨\n\n키: ${key}\n값: ${value}\n카테고리: ${category}`,
          },
        ],
      };
    }

    case "semo_get_facts": {
      if (!isMemoryEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
            },
          ],
        };
      }

      const userId = args?.user_id as string;
      const category = args?.category as string | undefined;

      const facts = await getUserFacts({ userId, category });

      if (facts.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] 저장된 팩트 없음${category ? ` (카테고리: ${category})` : ""}`,
            },
          ],
        };
      }

      const formatted = facts.map(f => `• ${f.key}: ${f.value} [${f.category}]`).join("\n");

      return {
        content: [
          {
            type: "text",
            text: `[SEMO Memory] 사용자 팩트 (${facts.length}건)\n\n${formatted}`,
          },
        ],
      };
    }

    case "semo_get_history": {
      if (!isMemoryEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
            },
          ],
        };
      }

      const userId = args?.user_id as string;
      const sessionId = args?.session_id as string | undefined;
      const limit = (args?.limit as number) || 20;

      const history = await getRecentInteractions({ userId, sessionId, limit });

      if (history.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] 상호작용 히스토리 없음`,
            },
          ],
        };
      }

      const formatted = history.map(h => {
        const role = h.role === "user" ? "👤" : "🤖";
        const skill = h.skillName ? ` [${h.skillName}]` : "";
        const preview = h.content.substring(0, 100).replace(/\n/g, " ");
        return `${role}${skill} ${preview}${h.content.length > 100 ? "..." : ""}`;
      }).join("\n");

      return {
        content: [
          {
            type: "text",
            text: `[SEMO Memory] 최근 상호작용 (${history.length}건)\n\n${formatted}`,
          },
        ],
      };
    }

    case "semo_memory_status": {
      if (!isMemoryEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 장기 기억 비활성화\n\nSEMO_DB_PASSWORD 환경변수를 설정하세요.\n\n필요한 환경변수:\n• SEMO_DB_HOST (기본: 3.38.162.21)\n• SEMO_DB_PORT (기본: 5432)\n• SEMO_DB_NAME (기본: appdb)\n• SEMO_DB_USER (기본: app)\n• SEMO_DB_PASSWORD (필수)`,
            },
          ],
        };
      }

      const status = await getSystemStatus();

      if (!status) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 상태 조회 실패 (DB 연결 오류)`,
            },
          ],
        };
      }

      const formatted = Object.entries(status)
        .map(([k, v]) => `• ${k}: ${v.toLocaleString()}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `[SEMO Memory] ✅ 장기 기억 시스템 상태\n\n${formatted}`,
          },
        ],
      };
    }

    // === SEMO Embedding Pipeline Tools ===
    case "semo_process_embeddings": {
      if (!isMemoryEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
            },
          ],
        };
      }

      const openaiKey = (args?.openai_api_key as string) || process.env.OPENAI_API_KEY;
      const limit = (args?.limit as number) || 10;

      if (!openaiKey) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ OpenAI API 키가 필요합니다.\n\nopenai_api_key 파라미터 또는 OPENAI_API_KEY 환경변수를 설정하세요.`,
            },
          ],
        };
      }

      const result = await processPendingEmbeddings({ openaiApiKey: openaiKey, limit });

      return {
        content: [
          {
            type: "text",
            text: `[SEMO Memory] 임베딩 처리 완료\n\n✅ 성공: ${result.processed}건\n❌ 실패: ${result.failed}건`,
          },
        ],
      };
    }

    case "semo_recall_smart": {
      if (!isMemoryEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
            },
          ],
        };
      }

      const userId = args?.user_id as string;
      const query = args?.query as string;
      const openaiKey = (args?.openai_api_key as string) || process.env.OPENAI_API_KEY;
      const limit = (args?.limit as number) || 10;

      if (!openaiKey) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] ❌ OpenAI API 키가 필요합니다.\n\nopenai_api_key 파라미터 또는 OPENAI_API_KEY 환경변수를 설정하세요.\n\n💡 일반 텍스트 검색은 semo_recall을 사용하세요.`,
            },
          ],
        };
      }

      const results = await searchMemoryWithEmbedding({ userId, query, openaiApiKey: openaiKey, limit });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `[SEMO Memory] 스마트 검색 결과 없음\n\n쿼리: "${query}"`,
            },
          ],
        };
      }

      const formatted = results.map((r, i) =>
        `${i + 1}. [${r.memoryType}] (유사도: ${(r.similarity * 100).toFixed(1)}%)\n   ${r.memoryText.substring(0, 200)}${r.memoryText.length > 200 ? "..." : ""}`
      ).join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `[SEMO Memory] 스마트 검색 결과 (${results.length}건)\n\n쿼리: "${query}"\n🔍 하이브리드 검색 (벡터 + 텍스트)\n\n${formatted}`,
          },
        ],
      };
    }

    // === SEMO Remote Tools ===
    case "semo_remote_request": {
      if (!isMemoryEnabled()) {
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
      if (!isMemoryEnabled()) {
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
      if (!isMemoryEnabled()) {
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
                    tools: ["slack_send_message", "slack_lookup_user", "slack_list_channels", "slack_find_channel"],
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

  // 메모리 시스템 상태 로깅
  const memoryStatus = isMemoryEnabled() ? "enabled" : "disabled (set SEMO_DB_PASSWORD)";
  console.error("[SEMO MCP] Server v2.1.0 started (Hybrid Strategy)");
  console.error("[SEMO MCP] Integrations: github, slack, supabase, memory");
  console.error(`[SEMO MCP] Long-term Memory: ${memoryStatus}`);

  // 세션 시작 로깅 (메모리 활성화 시)
  if (isMemoryEnabled()) {
    const sessionId = process.env.SEMO_SESSION_ID || randomUUID();
    const userId = process.env.SEMO_USER_ID || "00000000-0000-0000-0000-000000000000";

    await upsertSession({
      sessionId,
      userId,
      projectPath: process.cwd(),
      metadata: { gitBranch: process.env.GIT_BRANCH },
    });

    // 시작 로그
    await logInteraction({
      userId,
      sessionId,
      role: "assistant",
      content: "[SEMO MCP] Server started",
      metadata: { event: "server_start", version: "2.1.0" },
    });
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.error("[SEMO MCP] Shutting down...");
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("[SEMO MCP] Terminating...");
  await closePool();
  process.exit(0);
});

main().catch((error) => {
  console.error("[SEMO MCP] Fatal error:", error);
  process.exit(1);
});
