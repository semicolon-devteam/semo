#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const crypto_js_1 = require("./crypto.js");
const memory_js_1 = require("./memory.js");
// 토큰 로드 (CI/CD 생성 파일 우선, 없으면 환경변수)
function loadTokens() {
    try {
        // CI/CD에서 생성된 암호화 토큰 (배포 패키지용)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const generated = require("./tokens.generated.js");
        if (generated.ENCRYPTED_TOKENS?.SLACK_BOT_TOKEN) {
            return generated.ENCRYPTED_TOKENS;
        }
    }
    catch {
        // tokens.generated.js 없음 - 로컬 개발 환경
    }
    // 로컬 개발용 (환경변수 기반)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fallback = require("./tokens.js");
    return fallback.ENCRYPTED_TOKENS;
}
// Slack 토큰 조회 (암호화된 토큰 복호화 또는 환경변수)
function getSlackToken() {
    // 1. 환경변수 우선 (사용자 커스텀)
    if (process.env.SLACK_BOT_TOKEN) {
        return process.env.SLACK_BOT_TOKEN;
    }
    // 2. 암호화된 팀 토큰 (패키지 내장)
    try {
        const tokens = loadTokens();
        if (tokens.SLACK_BOT_TOKEN) {
            return (0, crypto_js_1.decrypt)(tokens.SLACK_BOT_TOKEN);
        }
    }
    catch {
        // 토큰 로드 실패
    }
    return "";
}
// 서버 초기화
const server = new index_js_1.Server({
    name: "semo-integrations",
    version: "3.0.1",
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
// === Tools ===
// v3.0.1: semo_get_slack_token 복원 (암호화된 팀 토큰 제공)
// GitHub/Supabase는 gh/supabase CLI 사용
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    // === 자동 로깅: 모든 MCP 툴 호출 기록 ===
    if ((0, memory_js_1.isMemoryEnabled)()) {
        const sessionId = process.env.SEMO_SESSION_ID || (0, crypto_1.randomUUID)();
        const userId = process.env.SEMO_USER_ID || "00000000-0000-0000-0000-000000000000";
        // 메모리 툴 자체는 로깅하지 않음 (무한 루프 방지)
        if (!name.startsWith("semo_")) {
            (0, memory_js_1.logInteraction)({
                userId,
                sessionId,
                role: "assistant",
                content: `[MCP Tool] ${name}`,
                skillName: name,
                skillArgs: args,
                metadata: { type: "mcp_tool_call" },
            }).catch(() => { }); // fire-and-forget
        }
    }
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
            }
            else {
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
        // === SEMO Memory Tools ===
        case "semo_remember": {
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.\nSEMO_DB_PASSWORD 환경변수를 설정하세요.`,
                        },
                    ],
                };
            }
            const userId = args?.user_id;
            const text = args?.text;
            const type = args?.type || "semantic";
            const importance = args?.importance || 1.0;
            const memoryId = await (0, memory_js_1.rememberFact)({
                userId,
                text,
                type: type,
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
            }
            else {
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
                        },
                    ],
                };
            }
            const userId = args?.user_id;
            const query = args?.query;
            const limit = args?.limit || 10;
            const results = await (0, memory_js_1.searchMemory)({ userId, query, limit });
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
            const formatted = results.map((r, i) => `${i + 1}. [${r.memoryType}] (유사도: ${(r.similarity * 100).toFixed(1)}%)\n   ${r.memoryText.substring(0, 200)}${r.memoryText.length > 200 ? "..." : ""}`).join("\n\n");
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
                        },
                    ],
                };
            }
            const userId = args?.user_id;
            const key = args?.key;
            const value = args?.value;
            const category = args?.category || "general";
            await (0, memory_js_1.saveUserFact)({ userId, factKey: key, factValue: value, category });
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
                        },
                    ],
                };
            }
            const userId = args?.user_id;
            const category = args?.category;
            const facts = await (0, memory_js_1.getUserFacts)({ userId, category });
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
                        },
                    ],
                };
            }
            const userId = args?.user_id;
            const sessionId = args?.session_id;
            const limit = args?.limit || 20;
            const history = await (0, memory_js_1.getRecentInteractions)({ userId, sessionId, limit });
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Memory] ❌ 장기 기억 비활성화\n\nSEMO_DB_PASSWORD 환경변수를 설정하세요.\n\n필요한 환경변수:\n• SEMO_DB_HOST (기본: 3.38.162.21)\n• SEMO_DB_PORT (기본: 5432)\n• SEMO_DB_NAME (기본: appdb)\n• SEMO_DB_USER (기본: app)\n• SEMO_DB_PASSWORD (필수)`,
                        },
                    ],
                };
            }
            const status = await (0, memory_js_1.getSystemStatus)();
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
                        },
                    ],
                };
            }
            const openaiKey = args?.openai_api_key || process.env.OPENAI_API_KEY;
            const limit = args?.limit || 10;
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
            const result = await (0, memory_js_1.processPendingEmbeddings)({ openaiApiKey: openaiKey, limit });
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Memory] ❌ 장기 기억이 비활성화되어 있습니다.`,
                        },
                    ],
                };
            }
            const userId = args?.user_id;
            const query = args?.query;
            const openaiKey = args?.openai_api_key || process.env.OPENAI_API_KEY;
            const limit = args?.limit || 10;
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
            const results = await (0, memory_js_1.searchMemoryWithEmbedding)({ userId, query, openaiApiKey: openaiKey, limit });
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
            const formatted = results.map((r, i) => `${i + 1}. [${r.memoryType}] (유사도: ${(r.similarity * 100).toFixed(1)}%)\n   ${r.memoryText.substring(0, 200)}${r.memoryText.length > 200 ? "..." : ""}`).join("\n\n");
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Remote] ❌ DB 연결이 필요합니다.\nSEMO_DB_PASSWORD 환경변수를 설정하세요.`,
                        },
                    ],
                };
            }
            const sessionId = args?.session_id;
            const reqType = args?.type;
            const message = args?.message;
            const options = args?.options;
            const toolName = args?.tool_name;
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
            }
            catch (error) {
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Remote] ❌ DB 연결이 필요합니다.`,
                        },
                    ],
                };
            }
            const requestId = args?.request_id;
            const response = args?.response;
            const status = args?.status;
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
            }
            catch (error) {
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
            if (!(0, memory_js_1.isMemoryEnabled)()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Remote] ❌ DB 연결이 필요합니다.`,
                        },
                    ],
                };
            }
            const sessionId = args?.session_id;
            const limit = args?.limit || 10;
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
                const params = [];
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
                const formatted = result.rows.map((r) => `• ${r.id.substring(0, 8)}... [${r.type}] ${r.message.substring(0, 50)}`).join("\n");
                return {
                    content: [
                        {
                            type: "text",
                            text: `[SEMO Remote] 대기 중인 요청 (${result.rows.length}건)\n\n${formatted}`,
                        },
                    ],
                };
            }
            catch (error) {
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
server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => {
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
server.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    switch (uri) {
        case "semo://integrations":
            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify({
                            version: "3.0.1",
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
                                    name: "memory",
                                    modules: ["remember", "recall", "facts", "history", "embeddings"],
                                    tools: ["semo_remember", "semo_recall", "semo_save_fact", "semo_get_facts", "semo_get_history", "semo_memory_status", "semo_process_embeddings", "semo_recall_smart"],
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
                        }, null, 2),
                    },
                ],
            };
        case "semo://skills":
            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify({
                            layer: "Layer 1 (Capabilities)",
                            type: "White Box (Filesystem)",
                            skills: [
                                { name: "coder", modules: ["implement", "scaffold", "review", "verify"] },
                                { name: "tester", modules: ["execute", "report", "validate"] },
                                { name: "planner", modules: ["epic", "task", "sprint", "roadmap"] },
                                { name: "writer", modules: ["spec", "docx", "handoff"] },
                                { name: "deployer", modules: ["deploy", "rollback", "compose"] },
                            ],
                        }, null, 2),
                    },
                ],
            };
        case "semo://commands":
            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify({
                            commands: [
                                { name: "/SEMO:help", description: "도움말" },
                                { name: "/SEMO:slack", description: "Slack 메시지" },
                                { name: "/SEMO:feedback", description: "피드백 제출" },
                                { name: "/SEMO:update", description: "업데이트" },
                                { name: "/SEMO:audit", description: "품질 감사" },
                                { name: "/SEMO:health", description: "환경 검증" },
                            ],
                        }, null, 2),
                    },
                ],
            };
        default:
            throw new Error(`Unknown resource: ${uri}`);
    }
});
// 서버 시작
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    // 메모리 시스템 상태 로깅
    const memoryStatus = (0, memory_js_1.isMemoryEnabled)() ? "enabled" : "disabled (set SEMO_DB_PASSWORD)";
    console.error("[SEMO MCP] Server v3.0.1 started");
    console.error("[SEMO MCP] Integrations: slack-token, memory, remote");
    console.error("[SEMO MCP] v3.0.1: semo_get_slack_token 복원 (팀 토큰 제공)");
    console.error(`[SEMO MCP] Long-term Memory: ${memoryStatus}`);
    // 세션 시작 로깅 (메모리 활성화 시)
    if ((0, memory_js_1.isMemoryEnabled)()) {
        const sessionId = process.env.SEMO_SESSION_ID || (0, crypto_1.randomUUID)();
        const userId = process.env.SEMO_USER_ID || "00000000-0000-0000-0000-000000000000";
        await (0, memory_js_1.upsertSession)({
            sessionId,
            userId,
            projectPath: process.cwd(),
            metadata: { gitBranch: process.env.GIT_BRANCH },
        });
        // 시작 로그
        await (0, memory_js_1.logInteraction)({
            userId,
            sessionId,
            role: "assistant",
            content: "[SEMO MCP] Server started",
            metadata: { event: "server_start", version: "3.0.0" },
        });
    }
}
// Graceful shutdown
process.on("SIGINT", async () => {
    console.error("[SEMO MCP] Shutting down...");
    await (0, memory_js_1.closePool)();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    console.error("[SEMO MCP] Terminating...");
    await (0, memory_js_1.closePool)();
    process.exit(0);
});
main().catch((error) => {
    console.error("[SEMO MCP] Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map