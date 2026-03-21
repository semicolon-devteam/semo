/**
 * MCP KB Server — Tool definitions (7 tools)
 */

export const KB_TOOLS = [
  {
    name: "kb_search",
    description:
      "KB 하이브리드 검색 (벡터 유사도 + 텍스트). 팀 Knowledge Base에서 관련 항목을 검색합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "검색 쿼리 (자연어 또는 키워드)",
        },
        domain: {
          type: "string",
          description:
            "KB 도메인 필터 (team, project, decision, infra, process 등). 생략 시 전체 검색",
        },
        limit: {
          type: "number",
          description: "결과 개수 (기본: 10)",
        },
        mode: {
          type: "string",
          enum: ["semantic", "text", "hybrid"],
          description: "검색 모드 (기본: hybrid)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "kb_get",
    description:
      "KB 정확 조회. domain + key로 단일 항목을 가져옵니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "KB 도메인 (예: team, project, decision)",
        },
        key: {
          type: "string",
          description: "항목 키",
        },
      },
      required: ["domain", "key"],
    },
  },
  {
    name: "kb_list",
    description:
      "KB 항목 목록 조회. 도메인별 엔트리 목록을 반환합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "KB 도메인 필터. 생략 시 전체 목록",
        },
        limit: {
          type: "number",
          description: "결과 개수 (기본: 50)",
        },
      },
      required: [],
    },
  },
  {
    name: "kb_upsert",
    description:
      "KB 항목 쓰기 (upsert). domain+key 기준으로 생성 또는 갱신합니다. OpenAI 임베딩이 자동 생성됩니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "KB 도메인 (예: decision, project)",
        },
        key: {
          type: "string",
          description: "항목 키",
        },
        content: {
          type: "string",
          description: "항목 본문 (마크다운 가능)",
        },
        metadata: {
          type: "object",
          description: "추가 메타데이터 (JSON)",
        },
      },
      required: ["domain", "key", "content"],
    },
  },
  {
    name: "kb_bot_status",
    description:
      "OpenClaw 봇 상태 조회. 7개 봇의 온라인/오프라인 상태, 마지막 활동 시각 등을 반환합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "kb_ontology",
    description:
      "온톨로지 스키마 조회. KB 도메인의 JSON Schema 정의를 반환합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description:
            "특정 도메인 스키마 조회. 생략 시 전체 도메인 목록",
        },
      },
      required: [],
    },
  },
  {
    name: "kb_digest",
    description:
      "KB 변경 다이제스트. 지정한 시각 이후 변경된 KB 항목을 반환합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: {
          type: "string",
          description: "ISO 8601 타임스탬프 (예: 2026-03-20T00:00:00Z). 이 시각 이후 변경된 항목을 반환",
        },
        domain: {
          type: "string",
          description: "도메인 필터. 생략 시 전체 도메인",
        },
      },
      required: ["since"],
    },
  },
];
